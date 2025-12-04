"""
Main ML service that coordinates models and predictions (no external deps)
"""
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from collections import defaultdict, deque
from ml_models.anomaly_detector import AnomalyDetector
import logging

logger = logging.getLogger(__name__)

class MLService:
    """Main ML service coordinating models and predictions"""

    def __init__(self):
        self.anomaly_detector = AnomalyDetector(
            model_dir=os.getenv("MODEL_SAVE_DIR", "./models")
        )

        # Load models if they exist
        self.anomaly_detector.load_models()
        
        # In-memory history: device_id -> sensor_type -> last 3 values
        self.history: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=3)))
        
    async def process_multi_sensor(self, device_id: str, all_sensors: Dict[str, float]) -> Dict:
        """
        Process multiple sensors together with correlation analysis
        
        Args:
            device_id: Device identifier
            all_sensors: Dict of sensor_type -> value
            
        Returns:
            Combined prediction result with correlation analysis
        """
        try:
            # Individual predictions for each sensor
            individual_results = {}
            max_combined_score = 0.0
            
            for sensor_type, value in all_sensors.items():
                if value is None:
                    continue
                
                try:
                    # Process single sensor
                    anomaly_score, is_anomaly = self.anomaly_detector.predict(value, sensor_type, device_id=device_id)
                    danger_score = 0.5
                    is_danger = False
                except Exception as sensor_err:
                    logger.error(f"Error processing sensor {sensor_type} for {device_id}: {sensor_err}")
                    continue
                
                try:
                    v = float(value)
                    if sensor_type == "gas":
                        if v >= 1500:
                            danger_score = max(danger_score, 0.9)
                        elif v >= 700:
                            danger_score = max(danger_score, 0.75)
                        elif v >= 500:
                            danger_score = max(danger_score, 0.6)
                    elif sensor_type == "smoke":
                        if v >= 4:
                            danger_score = max(danger_score, 0.9)
                        elif v >= 3.4:
                            danger_score = max(danger_score, 0.75)
                        elif v >= 3.0:
                            danger_score = max(danger_score, 0.6)
                    elif sensor_type == "temperature":
                        if v >= 50:
                            danger_score = max(danger_score, 0.9)
                        elif v >= 45:
                            danger_score = max(danger_score, 0.7)
                except Exception:
                    pass
                
                # Update history and analyze trend
                trend_info = self._update_and_analyze_trend(device_id, sensor_type, float(value))
                
                base_score = max(anomaly_score, danger_score)
                
                if trend_info.get("increasing") or trend_info.get("sudden_spike"):
                    combined_score = min(0.99, base_score * 1.1)
                else:
                    combined_score = base_score
                
                combined_score = min(0.99, max(0.0, combined_score))
                
                max_combined_score = max(max_combined_score, combined_score)
                
                individual_results[sensor_type] = {
                    "value": value,
                    "anomaly_score": anomaly_score,
                    "danger_score": danger_score,
                    "combined_score": combined_score,
                    "is_anomaly": is_anomaly,
                    "is_danger": is_danger,
                    "alert_level": self._determine_alert_level(combined_score),
                    "trend": trend_info
                }
            
            correlation_risk = self._analyze_multi_sensor_correlation(all_sensors)
            
            weighted_sum = 0.7 * max_combined_score + 0.3 * correlation_risk
            overall_score = min(0.99, max(0.0, weighted_sum))
            overall_alert = self._determine_alert_level(overall_score)
            
            is_critical = (max_combined_score >= 0.7) or (correlation_risk >= 0.8)
            
            result = {
                "device_id": device_id,
                "overall_score": float(overall_score),
                "is_danger": is_critical,
                "alert_level": overall_alert,
                "max_individual_score": float(max_combined_score),
                "correlation_risk": float(correlation_risk),
                "individual_results": individual_results,
                "timestamp": datetime.now().isoformat()
            }
            
            if not individual_results:
                logger.warning(f"No individual results processed for {device_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing multi-sensor data: {e}")
            return None
    
    def _analyze_multi_sensor_correlation(self, sensors: Dict[str, float]) -> float:
        try:
            temp = sensors.get("temperature", 0)
            humid = sensors.get("humidity", 0)
            smoke = sensors.get("smoke", 0)
            gas = sensors.get("gas", 0)
            
            risk = 0.0
            
            if temp > 40 or smoke > 3.0 or gas > 500:
                fire_score = 0.0
                if temp > 50:
                    fire_score += 0.4
                elif temp > 40:
                    fire_score += 0.3
                if smoke > 4.0:
                    fire_score += 0.4
                elif smoke > 3.4:
                    fire_score += 0.3
                elif smoke > 3.2:
                    fire_score += 0.2
                if gas > 1500:
                    fire_score += 0.2
                elif gas > 700:
                    fire_score += 0.15
                elif gas > 500:
                    fire_score += 0.1
                
                fire_score = min(0.99, fire_score)
                
                if (temp > 40 and smoke > 3.0 and gas > 500):
                    fire_score = min(0.99, fire_score + 0.15)
                elif (temp > 40 and smoke > 3.0) or (temp > 40 and gas > 500):
                    fire_score = min(0.99, fire_score + 0.1)
                
                risk = max(risk, fire_score)
            
            if gas > 300 or smoke > 3.0:
                aqi_score = 0.0
                if gas > 1500:
                    aqi_score += 0.5
                elif gas > 700:
                    aqi_score += 0.35
                elif gas > 300:
                    aqi_score += 0.2
                if smoke > 4.0:
                    aqi_score += 0.4
                elif smoke > 3.4:
                    aqi_score += 0.2
                
                aqi_score = min(0.99, aqi_score)
                if gas > 500 and smoke > 3.0:
                    aqi_score = min(0.99, aqi_score + 0.1)
                
                risk = max(risk, aqi_score)
            
            if temp > 45:
                overheat_score = 0.5 if temp > 45 else 0.3
                if humid < 30:
                    overheat_score = min(0.99, overheat_score + 0.2)
                risk = max(risk, min(0.99, overheat_score))
            
            return min(0.99, max(0.0, risk))
            
        except Exception as e:
            logger.error(f"Error in correlation analysis: {e}")
            return 0.0
        
    async def process_sensor_data(self, sensor_data: Dict) -> Dict:
        """
        Process incoming sensor data and generate predictions (single sensor)
        
        Args:
            sensor_data: Dictionary containing sensor data
            
        Returns:
            Dictionary with predictions and alert status
        """
        try:
            device_id = sensor_data.get("device_id")
            sensor_type = sensor_data.get("sensor_type")
            value = sensor_data.get("value")
            
            if not all([device_id, sensor_type, value is not None]):
                logger.warning("Incomplete sensor data")
                return None
            
            anomaly_score, is_anomaly = self.anomaly_detector.predict(value, sensor_type, device_id=device_id)
            
            danger_score = 0.5
            is_danger = False
            
            try:
                v = float(value)
                if sensor_type == "gas":
                    if v >= 800:
                        danger_score = max(danger_score, 0.9)
                    elif v >= 500:
                        danger_score = max(danger_score, 0.75)
                    elif v >= 200:
                        danger_score = max(danger_score, 0.6)
                elif sensor_type == "smoke":
                    if v >= 50:
                        danger_score = max(danger_score, 0.9)
                    elif v >= 30:
                        danger_score = max(danger_score, 0.75)
                    elif v >= 15:
                        danger_score = max(danger_score, 0.6)
                elif sensor_type == "temperature":
                    if v >= 50:
                        danger_score = max(danger_score, 0.9)
                    elif v >= 45:
                        danger_score = max(danger_score, 0.7)
            except Exception:
                pass

            trend_info = self._update_and_analyze_trend(device_id, sensor_type, float(value))

            base_score = max(anomaly_score, danger_score)
            
            if trend_info.get("increasing") or trend_info.get("sudden_spike"):
                combined_score = min(0.99, base_score * 1.1)
            else:
                combined_score = base_score
            
            combined_score = min(0.99, max(0.0, combined_score))
            is_critical = is_anomaly or is_danger
            
            alert_level = self._determine_alert_level(combined_score)
            should_alert = self._should_trigger_alert(combined_score, alert_level, trend_info)
            
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

            return prediction_result
            
        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")
            return None
    
    def _update_and_analyze_trend(self, device_id: str, sensor_type: str, value: float) -> Dict:
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
        base = 0.6
        if trend_info.get("increasing") or trend_info.get("sudden_spike"):
            base -= 0.1
        if trend_info.get("decreasing"):
            base += 0.1
        base = max(0.4, min(0.8, base))
        return score >= base
    
    def _determine_alert_level(self, score: float) -> str:
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
    
    async def get_model_status(self) -> Dict:
        return {
            "anomaly_detector": {
                "is_trained": self.anomaly_detector.is_trained
            }
        }
