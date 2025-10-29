"""
Kafka consumer that reads device-service events and feeds MLService
"""
import asyncio
import logging
import os
from typing import Dict
from config.kafka_config import kafka_config

logger = logging.getLogger(__name__)


class SensorConsumer:
    def __init__(self, ml_service):
        self.ml_service = ml_service
        self.consumer = None
        self.is_running = False

    async def start(self):
        try:
            self.consumer = kafka_config.get_consumer()
            logger.info(f"KafkaConsumer connected. Subscribed topics: {kafka_config.subscribe_topics}")
            self.is_running = True

            async def loop():
                while self.is_running:
                    try:
                        msg_pack = self.consumer.poll(timeout_ms=1000)
                        for _tp, messages in msg_pack.items():
                            for msg in messages:
                                await self._handle_message(msg.value)
                    except Exception as e:
                        logger.error(f"Consumer loop error: {e}")
                        await asyncio.sleep(1)

            asyncio.create_task(loop())
            logger.info("✅ SensorConsumer started")
        except Exception as e:
            logger.error(f"Failed to start SensorConsumer: {e}")

    async def stop(self):
        self.is_running = False
        try:
            if self.consumer:
                self.consumer.close()
        except Exception:
            pass
        logger.info("✅ SensorConsumer stopped")

    async def _handle_message(self, doc: Dict):
        try:
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})
            
            # Map all sensors at once
            all_sensors = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas': payload.get('gas_ppm') or payload.get('gas'),
            }
            # Only keep non-None values
            all_sensors = {k: v for k, v in all_sensors.items() if v is not None}
            
            if all_sensors:
                # Process all sensors together for multi-sensor correlation
                result = await self.ml_service.process_multi_sensor(device_id, all_sensors)
                logger.info(f"Kafka: {device_id} -> {len(all_sensors)} sensors, alert={result.get('alert_level') if result else 'none'}")

                # Publish compact device-level alert to Kafka
                if result:
                    try:
                        producer = kafka_config.get_producer()
                        topic = os.getenv('ALERTS_TOPIC', 'iot.alerts.ml')
                        msg = {
                            'device_id': result.get('device_id'),
                            'overall_score': result.get('overall_score'),
                            'alert_level': result.get('alert_level'),
                            'is_danger': result.get('is_danger'),
                            'correlation_risk': result.get('correlation_risk'),
                            'max_individual_score': result.get('max_individual_score'),
                            'timestamp': result.get('timestamp').isoformat() if result.get('timestamp') else None
                        }

                        # Optional: include top sensors for explainability (top 2 by combined_score)
                        try:
                            indiv = result.get('individual_results', {})
                            top = sorted(
                                [
                                    (s, d.get('combined_score', 0.0), d.get('alert_level'))
                                    for s, d in indiv.items()
                                ],
                                key=lambda x: x[1],
                                reverse=True
                            )[:2]
                            msg['top_sensors'] = [
                                {'sensor': s, 'prediction_score': sc, 'alert_level': lvl}
                                for (s, sc, lvl) in top
                            ]
                        except Exception:
                            pass

                        producer.send(topic, value=msg, key=device_id)
                        producer.flush(1)
                        logger.info(f"KafkaAlert published: topic={topic}, device={device_id}, level={msg['alert_level']}")
                    except Exception as e:
                        logger.error(f"Failed to publish alert: {e}")
        except Exception as e:
            logger.error(f"Failed to process message: {e}")


