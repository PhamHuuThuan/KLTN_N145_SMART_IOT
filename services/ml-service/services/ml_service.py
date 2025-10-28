"""
Main ML service that coordinates models and predictions (no external deps)
"""
import os
from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict, deque
from ml_models.anomaly_detector import AnomalyDetector
from ml_models.danger_predictor import DangerPredictor
import logging

logger = logging.getLogger(__name__)

class MLService:
    """Main ML service coordinating models and predictions"""

    def __init__(self):
        self.anomaly_detector = AnomalyDetector(
            model_dir=os.getenv("MODEL_SAVE_DIR", "./models")
        )
        self.danger_predictor = DangerPredictor(
            model_dir=os.getenv("MODEL_SAVE_DIR", "./models")
        )

        # Load models if they exist
        self.anomaly_detector.load_models()
        self.danger_predictor.load_models()
        
        # In-memory history: device_id -> sensor_type -> last 3 values
        self.history: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=3)))
        
    async def process_sensor_data(self, sensor_data: Dict) -> Dict:
        """
        Process incoming sensor data and generate predictions
        
        Args:
            sensor_data: Dictionary containing sensor data
            
        Returns:
            Dictionary with predictions and alert status
        """
        try:
            logger.info(f"MLService.input: {sensor_data}")
            device_id = sensor_data.get("device_id")
            sensor_type = sensor_data.get("sensor_type")
            value = sensor_data.get("value")
            
            if not all([device_id, sensor_type, value is not None]):
                logger.warning("Incomplete sensor data")
                return None
            
            # Anomaly detection
            anomaly_score, is_anomaly = self.anomaly_detector.predict(value, sensor_type)
            
            # Danger prediction using all available sensor data
            sensor_dict = {sensor_type: value}
            danger_score, is_danger = self.danger_predictor.predict(sensor_dict)
            
            # Update history and analyze trend
            trend_info = self._update_and_analyze_trend(device_id, sensor_type, float(value))

            # Combine predictions
            combined_score = max(anomaly_score, danger_score)
            is_critical = is_anomaly or is_danger
            
            # Determine alert level
            alert_level = self._determine_alert_level(combined_score)
            
            # Simple session-based false alert filtering
            should_alert = self._should_trigger_alert(combined_score, alert_level, trend_info)
            
            # Compose prediction result (no DB persistence)
            prediction_result = {
                "device_id": device_id,
                "sensor_type": sensor_type,
                "prediction_type": "danger" if is_danger else "normal",
                "prediction_score": float(combined_score),
                "is_danger": is_critical,
                "is_false_alert": not should_alert,
                "alert_level": alert_level,
                "timestamp": datetime.now(),
                "input_data": sensor_data,
                "trend": trend_info
            }

            logger.info(f"MLService.output: {prediction_result}")
            return prediction_result
            
        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")
            return None
    
    # Alerting removed in minimal version
    def _update_and_analyze_trend(self, device_id: str, sensor_type: str, value: float) -> Dict:
        """Maintain last 3 readings and derive simple trend signals."""
        try:
            dq = self.history[device_id][sensor_type]
            dq.append(value)
            values = list(dq)
            trend = "stable"
            increasing = False
            decreasing = False
            sudden_spike = False
            if len(values) >= 3:
                v1, v2, v3 = values[-3], values[-2], values[-1]
                increasing = v1 < v2 < v3
                decreasing = v1 > v2 > v3
                # Spike if last increases >25% over prev avg
                prev_avg = (v1 + v2) / 2 if (v1 + v2) != 0 else v2 or v1 or 0
                sudden_spike = (v3 > prev_avg * 1.25) if prev_avg != 0 else False
                if increasing:
                    trend = "increasing"
                elif decreasing:
                    trend = "decreasing"
                elif sudden_spike:
                    trend = "spike"
            return {
                "history": values,
                "trend": trend,
                "increasing": increasing,
                "decreasing": decreasing,
                "sudden_spike": sudden_spike
            }
        except Exception:
            return {"history": [], "trend": "unknown", "increasing": False, "decreasing": False, "sudden_spike": False}

    def _should_trigger_alert(self, score: float, alert_level: str, trend_info: Dict) -> bool:
        """Decide alert using score thresholds enhanced by trend context."""
        # Base threshold
        base = 0.6
        # Trend adjustments
        if trend_info.get("increasing") or trend_info.get("sudden_spike"):
            base -= 0.1  # more sensitive when rising
        if trend_info.get("decreasing"):
            base += 0.1  # less sensitive when falling
        base = max(0.4, min(0.8, base))
        return score >= base
    
    def _determine_alert_level(self, score: float) -> str:
        """Determine alert level based on prediction score"""
        if score >= 0.9:
            return "critical"
        elif score >= 0.75:
            return "high"
        elif score >= 0.6:
            return "medium"
        elif score >= 0.4:
            return "low"
        else:
            return "info"
    
    async def train_models(self, training_data: List[Dict]) -> bool:
        """Train both ML models with new data"""
        try:
            logger.info("Starting model training...")
            
            # Train anomaly detector
            anomaly_success = self.anomaly_detector.train(training_data)
            
            # Train danger predictor
            danger_success = self.danger_predictor.train(training_data)
            
            if anomaly_success and danger_success:
                logger.info("✅ Model training completed successfully")
                return True
            else:
                logger.warning("Model training completed with some failures")
                return False
                
        except Exception as e:
            logger.error(f"Error training models: {e}")
            return False
    
    async def get_model_status(self) -> Dict:
        """Get status of ML models"""
        return {
            "anomaly_detector": {
                "is_trained": self.anomaly_detector.is_trained
            },
            "danger_predictor": {
                "is_trained": self.danger_predictor.is_trained
            }
        }

