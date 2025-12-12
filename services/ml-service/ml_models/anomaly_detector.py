import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
from typing import Tuple, List, Dict, Optional
import logging
from collections import deque
from datetime import datetime, timedelta
import re

logger = logging.getLogger(__name__)

class AnomalyDetector:
    def __init__(self, model_dir="./models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

        self.max_buffer_size = int(os.getenv("ANOMALY_BUFFER_SIZE", "4000"))
        self.retrain_min_samples = int(os.getenv("ANOMALY_RETRAIN_MIN_SAMPLES", "100"))
        self.retrain_interval = timedelta(minutes=int(os.getenv("ANOMALY_RETRAIN_INTERVAL_MIN", "15")))
        
        self.default_device_id = "__global__"
        self.device_states: Dict[str, Dict] = {}
        
        self.latest_sensor_values: Dict[str, Dict[str, float]] = {}
        
        self.is_trained = False

    def _new_state(self) -> Dict:
        return {
            "model": IsolationForest(
                contamination=0.02,
                n_estimators=200,
                max_samples='auto',
                random_state=42,
                n_jobs=-1
            ),
            "scaler": StandardScaler(),
            "is_trained": False,
            "feature_names": ['temperature', 'humidity', 'gas_ppm', 'smoke'],
            "buffer": deque(maxlen=self.max_buffer_size),
            "last_retrain_at": datetime.min,
        }

    def _sanitize_device_id(self, device_id: str) -> str:
        safe = re.sub(r"[^A-Za-z0-9_\-]", "_", device_id)
        return safe or self.default_device_id

    def _device_dir(self, device_id: str) -> str:
        safe_id = self._sanitize_device_id(device_id)
        path = os.path.join(self.model_dir, safe_id)
        os.makedirs(path, exist_ok=True)
        return path

    def _get_device_id(self, device_id: Optional[str]) -> str:
        return device_id or self.default_device_id

    def _get_state(self, device_id: Optional[str]) -> Dict:
        key = self._get_device_id(device_id)
        if key not in self.device_states:
            self.device_states[key] = self._new_state()
            self._try_load_device_state(key)
        return self.device_states[key]

    def _record_sample(self, device_id: str, value: float, sensor_type: str):
        """Lưu mẫu vào buffer để train sau này."""
        try:
            state = self._get_state(device_id)
            sample = {
                "value": float(value),
                "sensor_type": sensor_type,
                "device_id": device_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            state["buffer"].append(sample)
        except Exception:
            pass

    def train(self, training_data: List[dict], device_id: Optional[str] = None):
        """
        Multivariate Training: Gom nhóm dữ liệu theo thời gian để học mối tương quan.
        """
        try:
            if not training_data:
                return False

            groups = {}
            if device_id:
                groups = {self._get_device_id(device_id): training_data}
            else:
                for sample in training_data:
                    dev_id = sample.get('device_id') or self.default_device_id
                    groups.setdefault(dev_id, []).append(sample)

            success = False
            
            for dev_id, samples in groups.items():
                if len(samples) < 50: 
                    continue

                state = self._get_state(dev_id)
                required_features = state["feature_names"]

                df = pd.DataFrame(samples)
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df['ts_rounded'] = df['timestamp'].dt.round('1s')

                df_pivot = df.pivot_table(
                    index='ts_rounded',
                    columns='sensor_type',
                    values='value',
                    aggfunc='mean'
                )

                for col in required_features:
                    if col not in df_pivot.columns:
                        df_pivot[col] = 0.0
                
                df_pivot = df_pivot[required_features]

                df_pivot = df_pivot.fillna(method='ffill').fillna(method='bfill').fillna(0)

                X = df_pivot.values

                if len(X) < 20: continue

                try:
                    X_scaled = state["scaler"].fit_transform(X)
                except Exception:
                    state["scaler"] = StandardScaler()
                    X_scaled = state["scaler"].fit_transform(X)

                state["model"].fit(X_scaled)
                state["is_trained"] = True
                
                self._save_device_state(dev_id, state)
                success = True
                logger.info(f"Successfully trained multivariate model for {dev_id} with {len(X)} samples")

            if success:
                self.is_trained = True
            return success

        except Exception as e:
            logger.error(f"Error training multivariate detector: {e}")
            return False

    def predict(
        self,
        value: float,
        sensor_type: str,
        device_id: Optional[str] = None
    ) -> Tuple[float, bool]:
        """
        Dự đoán dựa trên vector đa biến.
        Khi một sensor gửi dữ liệu đến, ta lấy các giá trị sensor khác từ bộ nhớ đệm (latest_values)
        để ghép thành 1 vector hoàn chỉnh rồi hỏi Model.
        """
        try:
            dev_id = self._get_device_id(device_id)
            
            self._record_sample(dev_id, value, sensor_type)
            self._maybe_retrain(dev_id)

            state = self._get_state(dev_id)
            if not state["is_trained"]:
                return 0.0, False

            if dev_id not in self.latest_sensor_values:
                self.latest_sensor_values[dev_id] = {
                    'temperature': 30.0, 'humidity': 60.0, 'gas_ppm': 300.0, 'smoke': 0.0
                }
            
            self.latest_sensor_values[dev_id][sensor_type] = float(value)

            feature_order = state["feature_names"]
            vector = []
            for feature in feature_order:
                val = self.latest_sensor_values[dev_id].get(feature, 0.0)
                vector.append(val)
            
            features = np.array([vector], dtype=float)

            try:
                if hasattr(state["scaler"], "scale_"):
                    features = state["scaler"].transform(features)
            except Exception:
                pass

            raw_score = state["model"].decision_function(features)[0]
            
            normalized = 0.5 - (raw_score) 
            anomaly_score = float(max(0.0, min(1.0, normalized)))
            
            is_anomaly = anomaly_score > 0.75
            
            return anomaly_score, bool(is_anomaly)

        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return 0.0, False

    def _maybe_retrain(self, device_id: str):
        state = self._get_state(device_id)
        buffer = state["buffer"]
        
        if len(buffer) < self.retrain_min_samples:
            return

        now = datetime.utcnow()
        if now - state["last_retrain_at"] < self.retrain_interval:
            return

        samples = list(buffer)
        success = self.train(samples, device_id=device_id)
        
        if success:
            buffer.clear()
            state["last_retrain_at"] = now

    def _save_device_state(self, device_id: str, state: Dict):
        try:
            device_dir = self._device_dir(device_id)
            joblib.dump({"model": state["model"]}, os.path.join(device_dir, 'isolation_forest.joblib'))
            joblib.dump({"scaler": state["scaler"]}, os.path.join(device_dir, 'scaler.joblib'))
            
            meta = {
                "device_id": device_id,
                "last_retrain_at": state["last_retrain_at"].isoformat(),
                "feature_names": state["feature_names"]
            }
            joblib.dump(meta, os.path.join(device_dir, 'meta.joblib'))
        except Exception as e:
            logger.error(f"Error saving model for {device_id}: {e}")

    def load_models(self):
        try:
            if not os.path.exists(self.model_dir): return False
            entries = os.listdir(self.model_dir)
            loaded = False
            for entry in entries:
                device_dir = os.path.join(self.model_dir, entry)
                if os.path.isdir(device_dir) and os.path.exists(os.path.join(device_dir, 'meta.joblib')):
                    try:
                        meta = joblib.load(os.path.join(device_dir, 'meta.joblib'))
                        dev_id = meta.get("device_id", entry)
                        
                        state = self._get_state(dev_id) # Init state
                        
                        model_data = joblib.load(os.path.join(device_dir, 'isolation_forest.joblib'))
                        scaler_data = joblib.load(os.path.join(device_dir, 'scaler.joblib'))
                        
                        state["model"] = model_data["model"]
                        state["scaler"] = scaler_data["scaler"]
                        state["feature_names"] = meta.get("feature_names", state["feature_names"])
                        state["is_trained"] = True
                        
                        try:
                            state["last_retrain_at"] = datetime.fromisoformat(meta["last_retrain_at"])
                        except: pass
                        
                        loaded = True
                    except Exception:
                        pass
            
            self.is_trained = loaded
            return loaded
        except Exception:
            return False