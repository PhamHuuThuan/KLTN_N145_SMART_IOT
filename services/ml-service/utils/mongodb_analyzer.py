"""
Utility to analyze MongoDB telemetry data with ML models
Support multi-sensor correlation analysis
"""
import asyncio
from datetime import datetime
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class MongoDBAnalyzer:
    """Analyzer for MongoDB telemetry documents with multi-sensor correlation"""
    
    def __init__(self, ml_service):
        self.ml_service = ml_service
        
        # Sensor correlation groups for context-aware analysis
        self.sensor_groups = {
            'fire_risk': ['temperature', 'smoke', 'gas'],
            'environment': ['temperature', 'humidity'],
            'air_quality': ['gas', 'smoke'],
            'thermal': ['temperature', 'humidity'],
        }
    
    async def analyze_mongodb_doc(self, doc: Dict) -> Dict:
        """
        Analyze MongoDB telemetry document with multi-sensor correlation
        
        Args:
            doc: MongoDB document từ telemetry collection
            
        Returns:
            Dict với individual analysis và correlation analysis
        """
        try:
            device_id = doc.get('deviceId', '')
            payload = doc.get('payload', {})
            timestamp = doc.get('createdAt', datetime.now())
            
            # Extract sensor values
            sensors = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas': payload.get('gas_ppm')
            }
            
            # Remove None values
            sensors = {k: v for k, v in sensors.items() if v is not None}
            
            results = {
                'device_id': device_id,
                'timestamp': timestamp,
                'individual_analysis': {},
                'correlation_analysis': {},
                'risk_assessment': {}
            }
            
            # 1. INDIVIDUAL ANALYSIS - Phân tích từng sensor
            for sensor_type, value in sensors.items():
                sensor_data = {
                    'device_id': device_id,
                    'sensor_type': sensor_type,
                    'value': float(value),
                    'timestamp': timestamp
                }
                
                prediction = await self.ml_service.process_sensor_data(sensor_data)
                
                if prediction:
                    results['individual_analysis'][sensor_type] = {
                        'value': value,
                        'prediction_score': prediction.get('prediction_score', 0),
                        'is_danger': prediction.get('is_danger', False),
                        'alert_level': prediction.get('alert_level', 'info'),
                        'is_anomaly': prediction.get('prediction_type') == 'danger'
                    }
            
            # 2. CORRELATION ANALYSIS - Phân tích kết hợp sensor liên quan
            results['correlation_analysis'] = await self._analyze_sensor_correlations(
                sensors, device_id, timestamp
            )
            
            # 3. RISK ASSESSMENT - Đánh giá tổng thể
            results['risk_assessment'] = self._assess_overall_risk(
                results['individual_analysis'],
                results['correlation_analysis']
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error analyzing MongoDB doc: {e}")
            return None
    
    async def _analyze_sensor_correlations(
        self, 
        sensors: Dict[str, float],
        device_id: str,
        timestamp: datetime
    ) -> Dict:
        """
        Analyze correlation between related sensors
        Ví dụ: temp + smoke + gas → fire risk
        """
        correlations = {}
        
        # Fire Risk Analysis (temp + smoke + gas)
        if 'temperature' in sensors and 'smoke' in sensors and 'gas' in sensors:
            temp = sensors['temperature']
            smoke = sensors['smoke']
            gas = sensors['gas']
            
            # Context-aware fire risk calculation
            risk_score = self._calculate_fire_risk(temp, smoke, gas)
            
            correlations['fire_risk'] = {
                'score': risk_score,
                'level': self._get_risk_level_from_score(risk_score),
                'indicators': {
                    'high_temperature': temp > 40,
                    'smoke_detected': smoke > 100,
                    'gas_leak': gas > 500
                },
                'factor_count': sum([
                    temp > 40,
                    smoke > 100,
                    gas > 500
                ]),
                'critical': risk_score > 0.7
            }
        
        # Environment Analysis (temp + humidity)
        if 'temperature' in sensors and 'humidity' in sensors:
            temp = sensors['temperature']
            humid = sensors['humidity']
            
            # Comfort zone analysis
            comfort_score = self._calculate_comfort_index(temp, humid)
            
            correlations['environment'] = {
                'score': comfort_score,
                'level': 'comfortable' if comfort_score > 0.7 else 'uncomfortable',
                'indicators': {
                    'optimal_temp': 20 <= temp <= 25,
                    'optimal_humidity': 40 <= humid <= 60,
                    'extreme_conditions': temp > 35 or humid > 80 or humid < 20
                }
            }
        
        # Air Quality Analysis (gas + smoke)
        if 'gas' in sensors and 'smoke' in sensors:
            gas = sensors['gas']
            smoke = sensors['smoke']
            
            aqi_score = self._calculate_air_quality_index(gas, smoke)
            
            correlations['air_quality'] = {
                'score': aqi_score,
                'level': self._get_aqi_level(aqi_score),
                'indicators': {
                    'gas_hazard': gas > 800,
                    'smoke_hazard': smoke > 200,
                    'moderate_pollution': gas > 200 or smoke > 50
                },
                'action_required': aqi_score > 0.6
            }
        
        # Thermal Anomaly (rapid temp change + humidity correlation)
        if 'temperature' in sensors and 'humidity' in sensors:
            temp = sensors['temperature']
            humid = sensors['humidity']
            
            # Check for thermal stress
            thermal_stress = self._calculate_thermal_stress(temp, humid)
            
            correlations['thermal_anomaly'] = {
                'score': thermal_stress,
                'level': 'stressed' if thermal_stress > 0.7 else 'normal',
                'indicators': {
                    'heat_stress': temp > 30 and humid > 70,
                    'cold_stress': temp < 10,
                    'dry_condition': humid < 30
                }
            }
        
        return correlations
    
    def _calculate_fire_risk(self, temp: float, smoke: float, gas: float) -> float:
        """Calculate fire risk from multiple sensors"""
        risk = 0.0
        
        # Temperature contribution (up to 40%)
        if temp > 50:
            risk += 0.4
        elif temp > 40:
            risk += 0.3
        elif temp > 30:
            risk += 0.1
        
        # Smoke contribution (up to 40%)
        if smoke > 300:
            risk += 0.4
        elif smoke > 200:
            risk += 0.3
        elif smoke > 100:
            risk += 0.15
        elif smoke > 50:
            risk += 0.05
        
        # Gas contribution (up to 20%)
        if gas > 1000:
            risk += 0.2
        elif gas > 800:
            risk += 0.15
        elif gas > 500:
            risk += 0.1
        elif gas > 200:
            risk += 0.05
        
        return min(risk, 1.0)
    
    def _calculate_comfort_index(self, temp: float, humid: float) -> float:
        """Calculate environmental comfort index"""
        temp_score = 1.0 if 20 <= temp <= 25 else 0.5
        humid_score = 1.0 if 40 <= humid <= 60 else 0.5
        
        return (temp_score + humid_score) / 2
    
    def _calculate_air_quality_index(self, gas: float, smoke: float) -> float:
        """Calculate air quality index"""
        risk = 0.0
        
        if gas > 800:
            risk += 0.6
        elif gas > 500:
            risk += 0.4
        elif gas > 200:
            risk += 0.2
        
        if smoke > 200:
            risk += 0.4
        elif smoke > 100:
            risk += 0.3
        elif smoke > 50:
            risk += 0.2
        
        return min(risk, 1.0)
    
    def _calculate_thermal_stress(self, temp: float, humid: float) -> float:
        """Calculate thermal stress index"""
        risk = 0.0
        
        # Heat stress
        if temp > 30 and humid > 70:
            risk = 0.9
        elif temp > 35:
            risk = 0.7
        elif temp > 30:
            risk = 0.4
        
        # Cold stress
        if temp < 5:
            risk = 0.8
        elif temp < 10:
            risk = 0.4
        
        return risk
    
    def _assess_overall_risk(
        self, 
        individual_analysis: Dict,
        correlation_analysis: Dict
    ) -> Dict:
        """
        Assess overall risk combining individual and correlation analysis
        """
        # Get individual scores
        individual_scores = [
            v.get('prediction_score', 0) 
            for v in individual_analysis.values()
        ]
        max_individual_score = max(individual_scores) if individual_scores else 0
        
        # Get correlation scores
        correlation_scores = [
            v.get('score', 0)
            for v in correlation_analysis.values()
        ]
        max_correlation_score = max(correlation_scores) if correlation_scores else 0
        
        # Overall score (weighted: 40% individual, 60% correlation)
        overall_score = 0.4 * max_individual_score + 0.6 * max_correlation_score
        
        # Count critical items
        critical_individual = sum(1 for v in individual_analysis.values() 
                                if v.get('is_danger', False))
        
        critical_correlation = sum(1 for v in correlation_analysis.values() 
                                  if v.get('critical', False))
        
        # Determine level and recommendation
        level = self._get_risk_level_from_score(overall_score)
        
        recommendation = self._generate_recommendation(
            individual_analysis, correlation_analysis, level
        )
        
        return {
            'overall_score': overall_score,
            'level': level,
            'critical_count': critical_individual + critical_correlation,
            'individual_max': max_individual_score,
            'correlation_max': max_correlation_score,
            'recommendation': recommendation,
            'requires_immediate_action': overall_score > 0.7
        }
    
    def _get_risk_level_from_score(self, score: float) -> str:
        """Convert score to risk level"""
        if score >= 0.9:
            return 'critical'
        elif score >= 0.75:
            return 'high'
        elif score >= 0.5:
            return 'medium'
        elif score >= 0.3:
            return 'low'
        else:
            return 'info'
    
    def _get_aqi_level(self, score: float) -> str:
        """Get air quality level"""
        if score >= 0.8:
            return 'hazardous'
        elif score >= 0.6:
            return 'unhealthy'
        elif score >= 0.4:
            return 'moderate'
        else:
            return 'good'
    
    def _generate_recommendation(
        self,
        individual: Dict,
        correlation: Dict,
        level: str
    ) -> str:
        """Generate actionable recommendation"""
        recommendations = []
        
        if level == 'critical':
            return "🚨 IMMEDIATE ACTION REQUIRED: Evacuate area if fire risk confirmed"
        
        if 'fire_risk' in correlation and correlation['fire_risk'].get('score', 0) > 0.5:
            recommendations.append("⚠️ Fire risk detected: Check for flames, activate fire suppression")
        
        if correlation.get('air_quality', {}).get('action_required'):
            recommendations.append("⚠️ Poor air quality: Increase ventilation, consider evacuation")
        
        if correlation.get('environment', {}).get('level') == 'uncomfortable':
            recommendations.append("ℹ️ Environment outside comfort zone: Adjust HVAC")
        
        return "; ".join(recommendations) if recommendations else "✅ All systems normal"

def format_analysis_output(result: Dict) -> str:
    """Format analysis result for display"""
    output = []
    output.append("\n" + "="*60)
    output.append("📊 PHÂN TÍCH ĐA SENSOR VỚI TƯƠNG QUAN")
    output.append("="*60)
    output.append(f"Device: {result['device_id']}")
    output.append(f"Timestamp: {result['timestamp']}")
    
    # Individual Analysis
    output.append("\n--- 1. PHÂN TÍCH TỪNG SENSOR ---")
    for sensor, analysis in result['individual_analysis'].items():
        status = "⚠️  NGUY HIỂM" if analysis['is_danger'] else "✅ Bình thường"
        output.append(f"\n{sensor.upper()}:")
        output.append(f"  Giá trị: {analysis['value']}")
        output.append(f"  Điểm nguy cơ: {analysis['prediction_score']:.2%}")
        output.append(f"  Trạng thái: {status}")
        output.append(f"  Mức cảnh báo: {analysis['alert_level']}")
    
    # Correlation Analysis
    if result['correlation_analysis']:
        output.append("\n--- 2. PHÂN TÍCH TƯƠNG QUAN SENSOR ---")
        for group, analysis in result['correlation_analysis'].items():
            output.append(f"\n{group.upper().replace('_', ' ')}:")
            output.append(f"  Điểm nguy cơ: {analysis['score']:.2%}")
            output.append(f"  Mức cảnh báo: {analysis.get('level', 'N/A')}")
            
            if 'indicators' in analysis:
                output.append(f"  Chỉ số: {analysis['indicators']}")
    
    # Overall Risk Assessment
    if result['risk_assessment']:
        output.append("\n--- 3. ĐÁNH GIÁ TỔNG THỂ ---")
        risk = result['risk_assessment']
        output.append(f"Mức nguy hiểm: {risk['level'].upper()}")
        output.append(f"Điểm tổng thể: {risk['overall_score']:.2%}")
        output.append(f"Số mối nguy hiểm: {risk['critical_count']}")
        output.append(f"Cần hành động ngay: {risk['requires_immediate_action']}")
        output.append(f"Khuyến nghị: {risk['recommendation']}")
    
    output.append("="*60)
    return "\n".join(output)

if __name__ == "__main__":
    # Test with sample data
    sample_doc = {
        "deviceId": "KITCHEN-ESP32-LED1",
        "payload": {
            "temp": 29.8,
            "humid": 71,
            "smoke": 0,
            "gas_ppm": 200,
        },
        "createdAt": datetime.now()
    }
    
    print("Testing MongoDB Analyzer...")
    # Note: Would need actual ml_service instance in production
    print(format_analysis_output({
        'device_id': sample_doc['deviceId'],
        'timestamp': sample_doc['createdAt'],
        'individual_analysis': {
            'temperature': {'value': 29.8, 'prediction_score': 0.05, 'is_danger': False, 'alert_level': 'info'},
            'humidity': {'value': 71, 'prediction_score': 0.02, 'is_danger': False, 'alert_level': 'info'},
        },
        'correlation_analysis': {
            'environment': {'score': 0.75, 'level': 'comfortable'}
        },
        'risk_assessment': {
            'overall_score': 0.05,
            'level': 'info',
            'critical_count': 0,
            'requires_immediate_action': False,
            'recommendation': '✅ All systems normal'
        }
    }))

