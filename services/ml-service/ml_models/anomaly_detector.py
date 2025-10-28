"""
Anomaly Detection Model using Isolation Forest
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
from typing import Tuple, List
import logging

logger = logging.getLogger(__name__)

class AnomalyDetector:
    """Anomaly detector using Isolation Forest"""
    
    def __init__(self, model_dir="./models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        
        self.isolation_forest = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = None
        
    
    def train(self, training_data: List[dict], sensor_type: str = 'temperature'):
        """Train anomaly detection model"""
        try:
            # Lazy import to avoid hard dependency when only predicting
            import pandas as pd
            if len(training_data) < 50:
                logger.warning("Insufficient training data")
                return False
            
            df = pd.DataFrame(training_data)
            
            # Filter by sensor type if provided
            if sensor_type and 'sensor_type' in df.columns:
                df = df[df['sensor_type'] == sensor_type]
            
            if 'value' not in df.columns:
                logger.error("'value' column not found in training data")
                return False
            
            # Prepare features for Isolation Forest
            X = df[['value']].values
            
            # Train Isolation Forest
            logger.info("Training Isolation Forest...")
            self.isolation_forest.fit(X)
            
            self.is_trained = True
            self.feature_names = ['value']
            
            # Save models
            self.save_models()
            
            logger.info("✅ Anomaly detector trained successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}")
            return False
    
    def predict(self, value: float, sensor_type: str = 'temperature') -> Tuple[float, bool]:
        """
        Predict if value is anomalous
        Returns: (anomaly_score, is_anomaly)
        """
        try:
            if not self.is_trained:
                return 0.5, False
            
            # Use Isolation Forest
            prediction = self.isolation_forest.decision_function([[value]])
            anomaly_score = 1 - (prediction[0] + 1) / 2  # Normalize to 0-1
            
            is_anomaly = anomaly_score > 0.85  # Threshold for anomaly
            
            return float(anomaly_score), bool(is_anomaly)
            
        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return 0.5, False
    
    def predict_batch(self, values: List[float]) -> List[Tuple[float, bool]]:
        """Predict anomalies for batch of values"""
        results = []
        for value in values:
            score, is_anomaly = self.predict(value)
            results.append((score, is_anomaly))
        return results
    
    def save_models(self):
        """Save trained models"""
        try:
            joblib.dump(self.isolation_forest, 
                       os.path.join(self.model_dir, 'isolation_forest.joblib'))
            joblib.dump(self.scaler, 
                       os.path.join(self.model_dir, 'scaler.joblib'))
            
            logger.info("✅ Models saved successfully")
        except Exception as e:
            logger.error(f"Error saving models: {e}")
    
    def load_models(self):
        """Load trained models"""
        try:
            iso_path = os.path.join(self.model_dir, 'isolation_forest.joblib')
            scaler_path = os.path.join(self.model_dir, 'scaler.joblib')
            
            if os.path.exists(iso_path):
                self.isolation_forest = joblib.load(iso_path)
            
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            
            self.is_trained = True
            logger.info("✅ Models loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return False

