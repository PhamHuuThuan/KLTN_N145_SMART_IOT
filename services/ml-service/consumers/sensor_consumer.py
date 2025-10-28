"""
Kafka consumer that reads device-service events and feeds MLService
"""
import asyncio
import logging
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
                                logger.info(f"Kafka message received on topic: {msg.topic}")
                                logger.debug(f"Kafka raw value: {msg.value}")
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
            logger.info(f"Consumer.handle_message input keys: {list(doc.keys())}")
            device_id = doc.get('deviceId') or doc.get('device_id') or 'unknown'
            payload = doc.get('payload', {})
            mapping = {
                'temperature': payload.get('temp'),
                'humidity': payload.get('humid'),
                'smoke': payload.get('smoke'),
                'gas': payload.get('gas_ppm') or payload.get('gas'),
            }
            mapping = {k: v for k, v in mapping.items() if v is not None}
            for sensor_type, value in mapping.items():
                sensor_data = {
                    'device_id': device_id,
                    'sensor_type': sensor_type,
                    'value': float(value),
                    'timestamp': payload.get('ts'),
                }
                logger.info(f"Consumer.mapped -> {sensor_type}={value} for {device_id}")
                await self.ml_service.process_sensor_data(sensor_data)
        except Exception as e:
            logger.error(f"Failed to process message: {e}")


