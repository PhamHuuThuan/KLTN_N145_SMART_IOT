"""
API controllers for ML service (minimal)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from services.ml_service import MLService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML Service"])

class PredictionRequest(BaseModel):
    """Request model for predictions"""
    device_id: str
    sensor_type: str
    value: float
    timestamp: Optional[str] = None
    metadata: Optional[Dict] = None

class PredictionBatchRequest(BaseModel):
    """Request model for batch predictions"""
    data: List[Dict]

class EventDocRequest(BaseModel):
    """Devices-service event document"""
    doc: Dict

class TrainingRequest(BaseModel):
    """Request model for training"""
    training_data: List[Dict]

class ModelStatusResponse(BaseModel):
    """Response model for model status"""
    anomaly_detector_trained: bool
    danger_predictor_trained: bool

def setup_routes(ml_service: MLService):
    """Setup API routes"""
    
    @router.post("/predict", response_model=Dict)
    async def predict_danger(request: PredictionRequest):
        """Get ML prediction for sensor data"""
        try:
            logger.info(f"/predict input: {request.dict()}")
            sensor_data = request.dict()
            result = await ml_service.process_sensor_data(sensor_data)
            
            if result:
                response = {
                    "success": True,
                    "prediction": result
                }
                logger.info(f"/predict output: {response}")
                return response
            else:
                raise HTTPException(status_code=400, detail="Failed to process prediction")
                
        except Exception as e:
            logger.error(f"Error in predict endpoint: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/predict/batch", response_model=Dict)
    async def predict_batch(request: PredictionBatchRequest):
        """Batch prediction endpoint"""
        try:
            logger.info(f"/predict/batch input count: {len(request.data)}")
            results = []
            
            for sensor_data in request.data:
                result = await ml_service.process_sensor_data(sensor_data)
                if result:
                    results.append(result)
            
            response = {
                "success": True,
                "predictions": results,
                "count": len(results)
            }
            logger.info(f"/predict/batch output count: {response['count']}")
            return response
            
        except Exception as e:
            logger.error(f"Error in batch predict: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/train", response_model=Dict)
    async def train_models(request: TrainingRequest):
        """Train ML models with new data"""
        try:
            logger.info(f"/train input samples: {len(request.training_data)}")
            success = await ml_service.train_models(request.training_data)
            
            response = {
                "success": success,
                "message": "Models trained successfully" if success else "Training failed",
                "training_samples": len(request.training_data)
            }
            logger.info(f"/train output: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Error training models: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/status", response_model=ModelStatusResponse)
    async def get_model_status():
        """Get ML model status"""
        try:
            status = await ml_service.get_model_status()
            
            response = ModelStatusResponse(
                anomaly_detector_trained=status["anomaly_detector"]["is_trained"],
                danger_predictor_trained=status["danger_predictor"]["is_trained"]
            )
            logger.info(f"/status output: {response.dict()}")
            return response
            
        except Exception as e:
            logger.error(f"Error getting model status: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/predict/event", response_model=Dict)
    async def predict_from_event(request: EventDocRequest):
        """Accept device-service event doc and map to single-sensor predictions."""
        try:
            doc = request.doc or {}
            logger.info(f"/predict/event input: doc keys={list(doc.keys())}")
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})

            # Map payload fields to sensor readings
            mapping = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas': payload.get('gas_ppm') or payload.get('gas')
            }
            mapping = {k: v for k, v in mapping.items() if v is not None}
            if not mapping:
                raise HTTPException(status_code=400, detail="No sensor values in event doc")

            results = {}
            for sensor_type, value in mapping.items():
                sensor_data = {
                    'device_id': device_id,
                    'sensor_type': sensor_type,
                    'value': float(value),
                    'timestamp': payload.get('ts')
                }
                logger.info(f"/predict/event mapped -> {sensor_type}={value}")
                pred = await ml_service.process_sensor_data(sensor_data)
                if pred:
                    results[sensor_type] = pred
            response = { 'success': True, 'device_id': device_id, 'predictions': results }
            logger.info(f"/predict/event output sensors: {list(results.keys())}")
            return response
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error predicting from event: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return router

