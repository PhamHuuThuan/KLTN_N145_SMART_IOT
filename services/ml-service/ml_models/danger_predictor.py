"""
Danger Prediction Model using Gradient Boosting and Neural Networks
"""
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib
import os
from datetime import datetime
from typing import Tuple, List, Dict
import logging

logger = logging.getLogger(__name__)

class DangerPredictor:
    """Predict dangerous situations using ensemble methods"""
    
    def __init__(self, model_dir="./models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        
        self.gradient_boosting = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )
        
        self.neural_network = MLPClassifier(
            hidden_layer_sizes=(100, 50),
            activation='relu',
            solver='adam',
            alpha=0.0001,
            learning_rate='adaptive',
            max_iter=500,
            random_state=42
        )
        
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        # Allow threshold override via env var
        import os as _os
        try:
            self.threshold = float(_os.getenv("PREDICTION_THRESHOLD", "0.7"))
        except Exception:
            self.threshold = 0.7
        
    def prepare_features(self, data: List[dict]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features and labels from sensor data"""
        try:
            # Lazy import to keep runtime light when only predicting
            import pandas as pd
            df = pd.DataFrame(data)
            
            # Create features from different sensor types
            features = []
            labels = []
            
            for idx, row in df.iterrows():
                feature_vector = self._create_feature_vector(df, idx)
                features.append(feature_vector)
                
                # Label based on known dangerous conditions
                label = self._create_label(row)
                labels.append(label)
            
            X = np.array(features)
            y = np.array(labels)
            
            return X, y
            
        except Exception as e:
            logger.error(f"Error preparing features: {e}")
            return None, None
    
    def _create_feature_vector(self, df, idx: int) -> np.ndarray:
        """Create feature vector from current and historical data"""
        try:
            current_row = df.iloc[idx]
            
            # Extract current sensor values
            temp = self._get_sensor_value(df, idx, 'temperature', 25.0)
            humidity = self._get_sensor_value(df, idx, 'humidity', 50.0)
            smoke = self._get_sensor_value(df, idx, 'smoke', 0.0)
            gas = self._get_sensor_value(df, idx, 'gas', 0.0)
            
            # Calculate rolling statistics (last 10 values)
            window = min(10, idx + 1)
            temp_mean = df.iloc[max(0, idx - window):idx + 1]['value'].mean() if idx > 0 else temp
            temp_std = df.iloc[max(0, idx - window):idx + 1]['value'].std() if idx > 0 else 0.0
            
            # Time-based features
            hour = current_row.get('timestamp', datetime.now()).hour
            is_night = 1 if hour >= 22 or hour < 6 else 0
            
            # Danger indicators
            high_temp = 1 if temp > 40 else 0
            low_humidity = 1 if humidity < 20 else 0
            smoke_detected = 1 if smoke > 100 else 0
            gas_detected = 1 if gas > 500 else 0
            
            # Temperature trend
            temp_trend = 0
            if idx > 5:
                recent_avg = df.iloc[idx-5:idx]['value'].mean()
                temp_trend = 1 if temp > recent_avg * 1.2 else 0
            
            return np.array([
                temp,
                humidity,
                smoke,
                gas,
                temp_mean,
                temp_std,
                hour,
                is_night,
                high_temp,
                low_humidity,
                smoke_detected,
                gas_detected,
                temp_trend
            ])
            
        except Exception as e:
            logger.error(f"Error creating feature vector: {e}")
            return np.zeros(13)
    
    def _get_sensor_value(self, df, idx: int, sensor_type: str, default: float) -> float:
        """Get sensor value by type"""
        try:
            filtered = df[df.iloc[idx]['sensor_type'] == sensor_type]
            if len(filtered) > 0:
                return filtered.iloc[0]['value']
            return default
        except:
            return default
    
    def _create_label(self, row: dict) -> int:
        """Create label based on known dangerous conditions"""
        try:
            value = row.get('value', 0)
            sensor_type = row.get('sensor_type', '')
            
            # Define dangerous thresholds
            if sensor_type == 'temperature' and value > 45:
                return 1  # Danger
            elif sensor_type == 'smoke' and value > 200:
                return 1  # Danger
            elif sensor_type == 'gas' and value > 800:
                return 1  # Danger
            elif sensor_type == 'temperature' and value > 50:
                return 1  # Critical danger
            
            return 0  # Safe
            
        except Exception as e:
            logger.error(f"Error creating label: {e}")
            return 0
    
    def train(self, training_data: List[dict]):
        """Train danger prediction model"""
        try:
            if len(training_data) < 100:
                logger.warning("Insufficient training data")
                return False
            
            X, y = self.prepare_features(training_data)
            
            if X is None or y is None:
                return False
            
            # Normalize features
            X_scaled = self.scaler.fit_transform(X)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Train Gradient Boosting
            logger.info("Training Gradient Boosting model...")
            self.gradient_boosting.fit(X_train, y_train)
            
            # Train Neural Network
            logger.info("Training Neural Network...")
            self.neural_network.fit(X_train, y_train)
            
            # Evaluate models
            gb_accuracy = accuracy_score(y_test, self.gradient_boosting.predict(X_test))
            nn_accuracy = accuracy_score(y_test, self.neural_network.predict(X_test))
            
            logger.info(f"Gradient Boosting Accuracy: {gb_accuracy:.2%}")
            logger.info(f"Neural Network Accuracy: {nn_accuracy:.2%}")
            
            self.is_trained = True
            self.save_models()
            
            logger.info("✅ Danger predictor trained successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error training danger predictor: {e}")
            return False
    
    def predict(self, sensor_data: Dict[str, float]) -> Tuple[float, bool]:
        """
        Predict danger level
        Returns: (danger_score, is_danger)
        """
        try:
            if not self.is_trained:
                return 0.5, False
            
            # Convert sensor data to feature vector
            feature_vector = self._sensor_data_to_features(sensor_data)
            
            if feature_vector is None:
                return 0.5, False
            
            # Scale features
            feature_vector_scaled = self.scaler.transform([feature_vector])
            
            # Get predictions from both models
            gb_proba = self.gradient_boosting.predict_proba(feature_vector_scaled)[0]
            nn_proba = self.neural_network.predict_proba(feature_vector_scaled)[0]
            
            # Ensemble prediction (weighted average)
            danger_score = (0.6 * gb_proba[1] + 0.4 * nn_proba[1])
            is_danger = danger_score > self.threshold
            
            return float(danger_score), bool(is_danger)
            
        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return 0.5, False
    
    def _sensor_data_to_features(self, sensor_data: Dict[str, float]) -> np.ndarray:
        """Convert sensor data dictionary to feature vector"""
        try:
            temp = sensor_data.get('temperature', 25.0)
            humidity = sensor_data.get('humidity', 50.0)
            smoke = sensor_data.get('smoke', 0.0)
            gas = sensor_data.get('gas', 0.0)
            hour = sensor_data.get('hour', datetime.now().hour)
            
            is_night = 1 if hour >= 22 or hour < 6 else 0
            high_temp = 1 if temp > 40 else 0
            low_humidity = 1 if humidity < 20 else 0
            smoke_detected = 1 if smoke > 100 else 0
            gas_detected = 1 if gas > 500 else 0
            temp_trend = sensor_data.get('temp_trend', 0)
            
            return np.array([
                temp, humidity, smoke, gas,
                25.0,  # temp_mean (dummy, need history for real value)
                0.0,   # temp_std (dummy)
                hour, is_night, high_temp,
                low_humidity, smoke_detected, gas_detected,
                temp_trend
            ])
        except Exception as e:
            logger.error(f"Error converting sensor data: {e}")
            return np.zeros(13)
    
    def save_models(self):
        """Save trained models"""
        try:
            joblib.dump(self.gradient_boosting, 
                       os.path.join(self.model_dir, 'gb_model.joblib'))
            joblib.dump(self.neural_network, 
                       os.path.join(self.model_dir, 'nn_model.joblib'))
            joblib.dump(self.scaler, 
                       os.path.join(self.model_dir, 'predictor_scaler.joblib'))
            logger.info("✅ Models saved successfully")
        except Exception as e:
            logger.error(f"Error saving models: {e}")
    
    def load_models(self):
        """Load trained models"""
        try:
            gb_path = os.path.join(self.model_dir, 'gb_model.joblib')
            nn_path = os.path.join(self.model_dir, 'nn_model.joblib')
            scaler_path = os.path.join(self.model_dir, 'predictor_scaler.joblib')
            
            if os.path.exists(gb_path):
                self.gradient_boosting = joblib.load(gb_path)
            
            if os.path.exists(nn_path):
                self.neural_network = joblib.load(nn_path)
            
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            
            self.is_trained = True
            logger.info("✅ Models loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return False

