"""
API controllers for ML service (minimal)
"""
from fastapi import APIRouter, HTTPException, Query
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
    
    def _compact_prediction(pred: Dict) -> Dict:
        """Return only essential prediction fields"""
        return {
            "device_id": pred.get("device_id"),
            "sensor_type": pred.get("sensor_type"),
            "prediction_score": pred.get("prediction_score"),
            "alert_level": pred.get("alert_level"),
            "is_false_alert": pred.get("is_false_alert"),
            "is_danger": pred.get("is_danger"),
            "timestamp": pred.get("timestamp"),
        }

    def _compact_prediction_no_ids(pred: Dict) -> Dict:
        """Compact prediction without repeating identifiers (for event endpoint items)."""
        return {
            "prediction_score": pred.get("prediction_score"),
            "alert_level": pred.get("alert_level"),
            "is_false_alert": pred.get("is_false_alert"),
            "is_danger": pred.get("is_danger"),
            "timestamp": pred.get("timestamp"),
        }

    @router.post("/predict", response_model=Dict)
    async def predict_danger(request: PredictionRequest, compact: bool = Query(True)):
        """Get ML prediction for sensor data"""
        try:
            logger.info(f"/predict input: {request.dict()}")
            sensor_data = request.dict()
            result = await ml_service.process_sensor_data(sensor_data)
            
            if result:
                response = { "success": True, "prediction": _compact_prediction(result) if compact else result }
                logger.info(f"/predict output: {response}")
                return response
            else:
                raise HTTPException(status_code=400, detail="Failed to process prediction")
                
        except Exception as e:
            logger.error(f"Error in predict endpoint: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/predict/batch", response_model=Dict)
    async def predict_batch(request: PredictionBatchRequest, compact: bool = Query(True)):
        """Batch prediction endpoint"""
        try:
            logger.info(f"/predict/batch input count: {len(request.data)}")
            results = []
            
            for sensor_data in request.data:
                result = await ml_service.process_sensor_data(sensor_data)
                if result:
                    results.append(_compact_prediction(result) if compact else result)
            
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
    async def predict_from_event(request: EventDocRequest, compact: bool = Query(True)):
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
                    # In event responses, avoid repeating identifiers per sensor
                    results[sensor_type] = _compact_prediction_no_ids(pred) if compact else pred
            response = { 'success': True, 'device_id': device_id, 'predictions': results }
            logger.info(f"/predict/event output sensors: {list(results.keys())}")
            return response
        
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error predicting from event: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/predict/event/aggregate", response_model=Dict)
    async def predict_from_event_aggregate(
        request: EventDocRequest,
        compact: bool = Query(True),
        include_details: bool = Query(False)
    ):
        """Aggregate all sensors of a device and return device-level decision using correlation."""
        try:
            doc = request.doc or {}
            logger.info(f"/predict/event/aggregate input: doc keys={list(doc.keys())}")
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})

            # Map payload fields to sensor readings (float)
            all_sensors = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas': payload.get('gas_ppm') or payload.get('gas')
            }
            all_sensors = {k: float(v) for k, v in all_sensors.items() if v is not None}
            if not all_sensors:
                raise HTTPException(status_code=400, detail="No sensor values in event doc")

            agg = await ml_service.process_multi_sensor(device_id, all_sensors)
            if not agg:
                raise HTTPException(status_code=400, detail="Failed to process aggregate prediction")

            # Build compact device-level response
            device_summary = {
                'device_id': agg.get('device_id'),
                'overall_score': agg.get('overall_score'),
                'alert_level': agg.get('alert_level'),
                'is_danger': agg.get('is_danger'),
                'correlation_risk': agg.get('correlation_risk'),
                'max_individual_score': agg.get('max_individual_score'),
                'timestamp': agg.get('timestamp')
            }

            response: Dict = {
                'success': True,
                'device': device_summary
            }

            if include_details:
                # Attach per-sensor compact items without redundant identifiers
                sensor_details = {}
                for s, pred in agg.get('individual_results', {}).items():
                    sensor_details[s] = {
                        'value': pred.get('value'),
                        'prediction_score': pred.get('combined_score'),
                        'alert_level': pred.get('alert_level'),
                        'is_danger': pred.get('is_danger'),
                        'timestamp': device_summary['timestamp']
                    }
                response['predictions'] = sensor_details

            logger.info(f"/predict/event/aggregate output: level={device_summary['alert_level']}, overall={device_summary['overall_score']}")
            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in aggregate prediction: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return router

