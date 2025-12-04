import numpy as np
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

        # Configuration
        self.max_buffer_size = int(os.getenv("ANOMALY_BUFFER_SIZE", "4000"))
        self.retrain_min_samples = int(os.getenv("ANOMALY_RETRAIN_MIN_SAMPLES", "200"))
        self.retrain_interval = timedelta(
            minutes=int(os.getenv("ANOMALY_RETRAIN_INTERVAL_MIN", "15"))
        )
        self.default_device_id = "__global__"

        # Per-device state cache
        self.device_states: Dict[str, Dict] = {}
        self.is_trained = False

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #
    def _new_state(self) -> Dict:
        return {
            "model": IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100
            ),
            "scaler": StandardScaler(),
            "is_trained": False,
            "feature_names": None,
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

    # ------------------------------------------------------------------ #
    # Training logic
    # ------------------------------------------------------------------ #
    def _filter_outliers(self, values: np.ndarray) -> np.ndarray:
        """Filter outliers from training data using IQR method to prevent them from being learned as normal."""
        if len(values) < 20:
            return values
        
        sorted_values = np.sort(values.flatten())
        q1 = np.percentile(sorted_values, 25)
        q3 = np.percentile(sorted_values, 75)
        iqr = q3 - q1
        
        if iqr == 0:
            mean = np.mean(sorted_values)
            std = np.std(sorted_values)
            if std == 0:
                return values
            lower_bound = mean - 2 * std
            upper_bound = mean + 2 * std
        else:
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
        
        mask = (values >= lower_bound) & (values <= upper_bound)
        filtered_values = values[mask]
        
        filtered_count = len(values) - len(filtered_values)
        if filtered_count > len(values) * 0.3:
            return values
        
        if len(filtered_values) < 20:
            return values
        
        return filtered_values.reshape(-1, 1)

    def train(self, training_data: List[dict], sensor_type: Optional[str] = 'temperature', device_id: Optional[str] = None):
        """Train anomaly detection models. If device_id is None, group data per device."""
        try:
            if not training_data:
                return False

            # Lazy import to avoid hard dependency when only predicting
            import pandas as pd

            if device_id:
                groups = {self._get_device_id(device_id): training_data}
            else:
                groups: Dict[str, List[dict]] = {}
                for sample in training_data:
                    dev_id = sample.get('device_id') or self.default_device_id
                    groups.setdefault(dev_id, []).append(sample)

            success = False
            for dev_id, samples in groups.items():
                if len(samples) < 20:
                    continue

                df = pd.DataFrame(samples)

                # Filter by sensor type if provided
                if sensor_type and 'sensor_type' in df.columns:
                    df = df[df['sensor_type'] == sensor_type]

                if 'value' not in df.columns or df.empty:
                    continue

                X = df[['value']].astype(float).values
                
                X_filtered = self._filter_outliers(X)
                
                if len(X_filtered) < 20:
                    continue
                
                state = self._get_state(dev_id)

                try:
                    X_scaled = state["scaler"].fit_transform(X_filtered)
                except Exception:
                    state["scaler"] = StandardScaler()
                    X_scaled = X_filtered

                state["model"].fit(X_scaled)
                state["is_trained"] = True
                state["feature_names"] = ['value']
                self._save_device_state(dev_id, state)
                success = True

            if success:
                self.is_trained = True
            return success

        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}")
            return False

    # ------------------------------------------------------------------ #
    # Prediction logic
    # ------------------------------------------------------------------ #
    def predict(self, value: float, sensor_type: str = 'temperature', device_id: Optional[str] = None) -> Tuple[float, bool]:
        try:
            dev_id = self._get_device_id(device_id)
            self._record_sample(dev_id, value, sensor_type)
            self._maybe_retrain(dev_id)

            state = self._get_state(dev_id)
            if not state["is_trained"]:
                return 0.5, False

            features = np.array([[value]], dtype=float)
            try:
                if hasattr(state["scaler"], "scale_"):
                    features = state["scaler"].transform(features)
            except Exception:
                features = np.array([[value]], dtype=float)

            prediction = state["model"].decision_function(features)
            # decision_function: negative = anomalous, positive = normal
            # Normalize to 0-1 range (max 0.99 to avoid 100%)
            raw_score = prediction[0]
            # decision_function typically ranges from -0.5 to 0.5
            # Simple linear transformation: map [-0.5, 0.5] -> [0.99, 0.0]
            normalized = (raw_score + 0.5) / 1.0  # Maps [-0.5, 0.5] -> [0, 1]
            anomaly_score = 1.0 - normalized  # Invert: anomalies -> high score
            # Clip to ensure 0-0.99 range (avoid 100%)
            anomaly_score = float(max(0.0, min(0.99, anomaly_score)))
            is_anomaly = anomaly_score > 0.85
            return anomaly_score, bool(is_anomaly)

        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return 0.5, False

    def predict_batch(self, values: List[float], device_id: Optional[str] = None) -> List[Tuple[float, bool]]:
        """Predict anomalies for a batch of values."""
        results = []
        for value in values:
            score, is_anomaly = self.predict(value, device_id=device_id)
            results.append((score, is_anomaly))
        return results

    # ------------------------------------------------------------------ #
    # Retraining helpers
    # ------------------------------------------------------------------ #
    def _record_sample(self, device_id: str, value: float, sensor_type: str):
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

    def _filter_normal_samples(self, samples: List[dict], device_id: str) -> List[dict]:
        """Filter out anomaly samples to prevent training on abnormal data"""
        state = self._get_state(device_id)
        if not state["is_trained"]:
            return samples
        
        normal_samples = []
        for sample in samples:
            try:
                value = float(sample.get("value", 0))
                features = np.array([[value]], dtype=float)
                try:
                    if hasattr(state["scaler"], "scale_"):
                        features = state["scaler"].transform(features)
                except Exception:
                    features = np.array([[value]], dtype=float)
                
                prediction = state["model"].decision_function(features)
                raw_score = prediction[0]
                normalized = (raw_score + 0.5) / 1.0
                anomaly_score = 1.0 - normalized
                anomaly_score = float(max(0.0, min(0.99, anomaly_score)))
                is_anomaly = anomaly_score > 0.85
                
                if not is_anomaly and anomaly_score < 0.7:
                    normal_samples.append(sample)
            except Exception:
                continue
        return normal_samples

    def _maybe_retrain(self, device_id: str):
        state = self._get_state(device_id)
        buffer = state["buffer"]
        if len(buffer) < self.retrain_min_samples:
            return

        now = datetime.utcnow()
        if now - state["last_retrain_at"] < self.retrain_interval:
            return

        samples = list(buffer)
        if state["is_trained"]:
            normal_samples = self._filter_normal_samples(samples, device_id)
            if len(normal_samples) < self.retrain_min_samples:
                return
            samples = normal_samples
        
        success = self.train(samples, sensor_type=None, device_id=device_id)
        if success:
            buffer.clear()
            state["last_retrain_at"] = now

    def force_retrain_from_buffer(self, device_id: Optional[str] = None) -> bool:
        """Expose manual trigger to retrain immediately with buffered data (per device or all)."""
        if device_id:
            dev_id = self._get_device_id(device_id)
            buffer = self._get_state(dev_id)["buffer"]
            if not buffer:
                return False
            samples = list(buffer)
            success = self.train(samples, sensor_type=None, device_id=dev_id)
            if success:
                buffer.clear()
                self._get_state(dev_id)["last_retrain_at"] = datetime.utcnow()
            return success

        # Retrain all devices
        overall_success = False
        for dev_id in list(self.device_states.keys()):
            if self.force_retrain_from_buffer(dev_id):
                overall_success = True
        return overall_success

    # ------------------------------------------------------------------ #
    # Persistence helpers
    # ------------------------------------------------------------------ #
    def _save_device_state(self, device_id: str, state: Dict):
        """Persist a single device model and scaler."""
        try:
            device_dir = self._device_dir(device_id)
            if not os.path.exists(device_dir):
                os.makedirs(device_dir, exist_ok=True)
            
            model_path = os.path.join(device_dir, 'isolation_forest.joblib')
            scaler_path = os.path.join(device_dir, 'scaler.joblib')
            meta_path = os.path.join(device_dir, 'meta.joblib')
            
            joblib.dump(
                {"device_id": device_id, "model": state["model"]},
                model_path
            )
            
            joblib.dump(
                {"device_id": device_id, "scaler": state["scaler"]},
                scaler_path
            )
            
            meta = {
                "device_id": device_id,
                "last_retrain_at": state["last_retrain_at"].isoformat() if isinstance(state["last_retrain_at"], datetime) else None,
                "feature_names": state.get("feature_names")
            }
            joblib.dump(meta, meta_path)
            
        except Exception as e:
            logger.error(f"Error saving model for {device_id}: {e}")

    def save_models(self):
        """Save all trained device models."""
        for device_id, state in self.device_states.items():
            if state["is_trained"]:
                self._save_device_state(device_id, state)

    def _try_load_device_state(self, device_id: str):
        """Attempt to load an existing device model from disk."""
        device_dir = self._device_dir(device_id)
        model_path = os.path.join(device_dir, 'isolation_forest.joblib')
        scaler_path = os.path.join(device_dir, 'scaler.joblib')

        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            return

        try:
            model_payload = joblib.load(model_path)
            scaler_payload = joblib.load(scaler_path)

            state = self.device_states[device_id]
            state["model"] = model_payload.get("model", state["model"])
            state["scaler"] = scaler_payload.get("scaler", state["scaler"])
            state["is_trained"] = True

            meta_path = os.path.join(device_dir, 'meta.joblib')
            if os.path.exists(meta_path):
                meta = joblib.load(meta_path)
                last_retrain = meta.get("last_retrain_at")
                if last_retrain:
                    try:
                        state["last_retrain_at"] = datetime.fromisoformat(last_retrain)
                    except Exception:
                        pass
                state["feature_names"] = meta.get("feature_names")

        except Exception as e:
            logger.error(f"Failed to load model for {device_id}: {e}")

    def load_models(self):
        """Load all device models from disk."""
        try:
            entries = os.listdir(self.model_dir)
        except FileNotFoundError:
            entries = []

        loaded_any = False
        for entry in entries:
            device_dir = os.path.join(self.model_dir, entry)
            if not os.path.isdir(device_dir):
                continue
            # Determine device id from metadata if available
            meta_path = os.path.join(device_dir, 'meta.joblib')
            device_id = entry
            if os.path.exists(meta_path):
                try:
                    meta = joblib.load(meta_path)
                    device_id = meta.get("device_id", entry)
                except Exception:
                    device_id = entry
            self.device_states[device_id] = self._new_state()
            self._try_load_device_state(device_id)
            if self.device_states[device_id]["is_trained"]:
                loaded_any = True

        # Backward compatibility: load legacy single-model files into global state
        legacy_model = os.path.join(self.model_dir, 'isolation_forest.joblib')
        legacy_scaler = os.path.join(self.model_dir, 'scaler.joblib')
        if os.path.exists(legacy_model) and os.path.exists(legacy_scaler):
            fallback_state = self._get_state(self.default_device_id)
            try:
                fallback_state["model"] = joblib.load(legacy_model)
                fallback_state["scaler"] = joblib.load(legacy_scaler)
                fallback_state["is_trained"] = True
                loaded_any = True
            except Exception:
                pass

        if loaded_any:
            self.is_trained = True
        return loaded_any
