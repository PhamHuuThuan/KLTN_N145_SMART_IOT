import os
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict, deque
from ml_models.anomaly_detector import AnomalyDetector
import logging

logger = logging.getLogger(__name__)

class MLService:
    """
    Main ML service.
    Refactored to rely purely on Multivariate Isolation Forest & Trend Analysis.
    Removed hardcoded thresholds.
    """

    def __init__(self):
        self.anomaly_detector = AnomalyDetector(
            model_dir=os.getenv("MODEL_SAVE_DIR", "./models")
        )
        self.anomaly_detector.load_models()
        
        # Lưu lịch sử 5 giá trị gần nhất để tính xu hướng (đạo hàm)
        self.history: Dict[str, Dict[str, deque]] = defaultdict(
            lambda: defaultdict(lambda: deque(maxlen=5))
        )

    async def process_sensor_data(self, sensor_data: Dict) -> Dict:
        """
        Xử lý dữ liệu từ một sensor đơn lẻ (MQTT message).
        Dự đoán dựa trên vector đa biến (lấy các sensor khác từ cache).
        """
        try:
            device_id = sensor_data.get("device_id")
            sensor_type = sensor_data.get("sensor_type")
            value = sensor_data.get("value")
            
            if not all([device_id, sensor_type, value is not None]):
                return None
            
            # 1. Gọi Model AI để lấy điểm bất thường (0.0 -> 1.0)
            # Model sẽ tự ghép value này với các sensor khác trong cache để phán đoán
            anomaly_score, is_anomaly = self.anomaly_detector.predict(
                value, sensor_type, device_id=device_id
            )
            
            # 2. Phân tích xu hướng (Trend)
            # AI giỏi phát hiện điểm lạ, Trend giỏi phát hiện sự thay đổi nhanh (đạo hàm)
            trend_info = self._update_and_analyze_trend(device_id, sensor_type, float(value))

            # 3. Tính điểm cuối cùng (Combined Score)
            # Logic: Điểm gốc là điểm từ AI.
            # Nếu có xu hướng tăng sốc (Spike) -> Cộng thêm điểm nguy hiểm
            final_score = anomaly_score
            
            if trend_info.get("sudden_spike"):
                final_score = min(1.0, final_score + 0.3) # Tăng mạnh điểm nếu đột biến
            elif trend_info.get("increasing"):
                final_score = min(1.0, final_score + 0.1) # Tăng nhẹ nếu đang đà tăng

            # 4. Xác định mức độ cảnh báo thuần túy dựa trên điểm số
            alert_level = self._determine_alert_level(final_score)
            
            # Trigger alert nếu điểm > 0.7 (Ngưỡng mềm của AI, không phải ngưỡng cứng giá trị sensor)
            should_alert = final_score >= 0.7
            
            return {
                "device_id": device_id,
                "sensor_type": sensor_type,
                "prediction_type": "anomaly" if should_alert else "normal",
                "prediction_score": float(final_score),
                "raw_ai_score": float(anomaly_score),
                "is_danger": should_alert,
                "alert_level": alert_level,
                "timestamp": datetime.now(),
                "trend": trend_info
            }
            
        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")
            return None

    def _update_and_analyze_trend(self, device_id: str, sensor_type: str, value: float) -> Dict:
        """
        Phân tích xu hướng dữ liệu (tăng/giảm/đột biến).
        Dùng để bổ trợ cho model AI.
        """
        try:
            dq = self.history[device_id][sensor_type]
            dq.append(value)
            values = list(dq)
            
            trend = "stable"
            increasing = False
            sudden_spike = False
            
            if len(values) >= 3:
                # Tính trung bình trượt của các giá trị trước đó
                prev_values = values[:-1]
                avg_prev = sum(prev_values) / len(prev_values) if prev_values else 0
                current = values[-1]

                # 1. Phát hiện tăng liên tục
                if values[-1] > values[-2] > values[-3]:
                    increasing = True
                    trend = "increasing"
                elif values[-1] < values[-2] < values[-3]:
                    trend = "decreasing"

                # 2. Phát hiện đột biến (Spike)
                # Nếu giá trị hiện tại lớn hơn 30% so với trung bình các lần trước -> Spike
                if avg_prev > 0 and current > avg_prev * 1.3:
                    sudden_spike = True
                    trend = "spike"
            
            return {
                "trend": trend,
                "increasing": increasing,
                "sudden_spike": sudden_spike
            }
        except Exception:
            return {"trend": "unknown", "increasing": False, "sudden_spike": False}

    def _determine_alert_level(self, score: float) -> str:
        """Map điểm số AI (0-1) sang mức độ cảnh báo."""
        if score >= 0.9:
            return "critical" # Rất nguy hiểm
        elif score >= 0.75:
            return "high"     # Cao
        elif score >= 0.5:
            return "medium"   # Trung bình
        elif score >= 0.3:
            return "low"      # Thấp
        else:
            return "info"     # Bình thường

    async def get_model_status(self) -> Dict:
        return {
            "anomaly_detector": {
                "is_trained": self.anomaly_detector.is_trained,
                "multivariate": True # Đánh dấu là hệ thống đa biến
            }
        }