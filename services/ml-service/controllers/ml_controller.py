"""API controllers for ML service."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from services.ml_service import MLService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML Service"])

# --- Pydantic Models ---
class PredictionRequest(BaseModel):
    """Request model for predictions."""
    device_id: str
    sensor_type: str
    value: float
    timestamp: Optional[str] = None
    metadata: Optional[Dict] = None

class PredictionBatchRequest(BaseModel):
    data: List[Dict]

class EventDocRequest(BaseModel):
    doc: Dict

class ModelStatusResponse(BaseModel):
    anomaly_detector_trained: bool
    multivariate: bool = True

def setup_routes(ml_service: MLService):
    """Setup API routes"""
    
    def _compact_prediction(pred: Dict) -> Dict:
        """Return essential prediction fields matching new MLService output"""
        return {
            "device_id": pred.get("device_id"),
            "sensor_type": pred.get("sensor_type"),
            "prediction_score": pred.get("prediction_score"),
            "raw_ai_score": pred.get("raw_ai_score"), # Thêm trường này để debug AI
            "alert_level": pred.get("alert_level"),
            "is_danger": pred.get("is_danger"),
            "timestamp": pred.get("timestamp"),
            "trend": pred.get("trend") # Thêm trend info
        }

    @router.post("/predict", response_model=Dict)
    async def predict_danger(request: PredictionRequest, compact: bool = Query(True)):
        """Get ML prediction for single sensor data"""
        try:
            sensor_data = request.dict()
            result = await ml_service.process_sensor_data(sensor_data)
            
            if result:
                return {
                    "success": True,
                    "prediction": _compact_prediction(result) if compact else result
                }
            # Nếu result là None (do thiếu dữ liệu hoặc lỗi)
            raise HTTPException(status_code=400, detail="Failed to process prediction")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in predict endpoint: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/predict/batch", response_model=Dict)
    async def predict_batch(request: PredictionBatchRequest, compact: bool = Query(True)):
        """Batch prediction endpoint"""
        try:
            results = []
            for sensor_data in request.data:
                result = await ml_service.process_sensor_data(sensor_data)
                if result:
                    results.append(
                        _compact_prediction(result) if compact else result
                    )
            
            return {
                "success": True,
                "predictions": results,
                "count": len(results)
            }
        except Exception as e:
            logger.error(f"Error in batch predict: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/status", response_model=ModelStatusResponse)
    async def get_model_status():
        """Get ML model status"""
        try:
            status = await ml_service.get_model_status()
            return ModelStatusResponse(
                anomaly_detector_trained=status["anomaly_detector"]["is_trained"],
                multivariate=status["anomaly_detector"].get("multivariate", False)
            )
        except Exception as e:
            logger.error(f"Error getting model status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/predict/event", response_model=Dict)
    async def predict_from_event(
        request: EventDocRequest, compact: bool = Query(True)
    ):
        """Accept device-service event doc and map to single-sensor predictions."""
        try:
            doc = request.doc or {}
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})

            # Map các trường từ payload sang format chuẩn
            mapping = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas_ppm': payload.get('gas_ppm') or payload.get('gas')
            }
            # Lọc bỏ các giá trị None
            mapping = {k: v for k, v in mapping.items() if v is not None}
            
            if not mapping:
                return {"success": False, "message": "No sensor values found"}

            results = {}
            for sensor_type, value in mapping.items():
                sensor_data = {
                    'device_id': device_id,
                    'sensor_type': sensor_type,
                    'value': float(value),
                    'timestamp': payload.get('ts')
                }
                pred = await ml_service.process_sensor_data(sensor_data)
                if pred:
                    results[sensor_type] = _compact_prediction(pred) if compact else pred
            
            return {
                'success': True,
                'device_id': device_id,
                'predictions': results
            }
        
        except Exception as e:
            logger.error(f"Error predicting from event: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/predict/event/aggregate", response_model=Dict)
    async def predict_from_event_aggregate(
        request: EventDocRequest,
        compact: bool = Query(True)
    ):
        """
        Aggregate all sensors and return device-level decision.
        Logic mới: Chạy tất cả sensor qua model, lấy kết quả có điểm cao nhất (nguy hiểm nhất) làm đại diện.
        """
        try:
            doc = request.doc or {}
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})

            mapping = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas_ppm': payload.get('gas_ppm') or payload.get('gas')
            }
            mapping = {k: float(v) for k, v in mapping.items() if v is not None}
            
            if not mapping:
                 raise HTTPException(status_code=400, detail="No sensor values in event doc")

            processed_results = []
            
            # 1. Chạy predict cho từng sensor (Model tự động dùng Cache để tính toán đa biến)
            for sensor_type, value in mapping.items():
                sensor_data = {
                    'device_id': device_id,
                    'sensor_type': sensor_type,
                    'value': value,
                    'timestamp': payload.get('ts')
                }
                pred = await ml_service.process_sensor_data(sensor_data)
                if pred:
                    processed_results.append(pred)

            if not processed_results:
                raise HTTPException(status_code=400, detail="Failed to process any sensor")

            # 2. Tìm kết quả "tệ nhất" (Điểm cao nhất) để làm trạng thái chung cho thiết bị
            # Sắp xếp giảm dần theo prediction_score
            processed_results.sort(key=lambda x: x['prediction_score'], reverse=True)
            
            worst_case = processed_results[0]
            
            # 3. Tổng hợp kết quả
            device_summary = {
                'device_id': device_id,
                'overall_score': worst_case['prediction_score'],
                'alert_level': worst_case['alert_level'],
                'is_danger': worst_case['is_danger'],
                'primary_cause': worst_case['sensor_type'], # Nguyên nhân chính gây báo động
                'timestamp': worst_case['timestamp']
            }

            response = {
                'success': True,
                'device': device_summary,
                'details': { res['sensor_type']: _compact_prediction(res) for res in processed_results }
            }

            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in aggregate prediction: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return router