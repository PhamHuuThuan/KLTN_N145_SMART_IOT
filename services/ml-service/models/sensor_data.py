"""
MongoDB models for sensor data and predictions
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")


class SensorData(BaseModel):
    """Model for sensor telemetry data"""
    device_id: str
    sensor_type: str  # temperature, humidity, smoke, gas, motion
    value: float
    unit: str
    timestamp: datetime
    location: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        json_encoders = {ObjectId: str, datetime: datetime.isoformat}


class PredictionResult(BaseModel):
    """Model for ML prediction results"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    device_id: str
    sensor_type: str
    prediction_type: str  # danger, anomaly, normal
    prediction_score: float
    is_danger: bool
    is_false_alert: bool
    alert_level: str  # low, medium, high, critical
    timestamp: datetime
    input_data: Dict[str, Any]
    predicted_value: Optional[float] = None
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str, datetime: datetime.isoformat}


class ModelMetrics(BaseModel):
    """Model for tracking ML model performance metrics"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    model_type: str  # anomaly_detection, danger_prediction
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    false_negative_rate: float
    training_samples: int
    trained_at: datetime
    version: str
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str, datetime: datetime.isoformat}


class AlertHistory(BaseModel):
    """Model for tracking alert history to prevent false alarms"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    device_id: str
    alert_type: str
    alert_score: float
    was_confirmed: bool
    was_false_alert: bool
    created_at: datetime
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str, datetime: datetime.isoformat}

