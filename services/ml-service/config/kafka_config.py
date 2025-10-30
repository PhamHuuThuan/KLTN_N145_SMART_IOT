"""
Kafka configuration and connection management (minimal)
"""
import os
import json
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
import logging

logger = logging.getLogger(__name__)


class KafkaConfig:
    def __init__(self):
        self.brokers = os.getenv("KAFKA_BROKERS", "localhost:29092").split(",")
        self.group_id = os.getenv("KAFKA_GROUP_ID", "ml-service-group")
        # Topics to subscribe for incoming telemetry/events
        topics_env = os.getenv("KAFKA_TOPICS", "iot.telemetry.logs,iot.events.logs")
        self.subscribe_topics = [t.strip() for t in topics_env.split(",") if t.strip()]
        self.consumer = None
        self.producer = None

    def get_consumer(self):
        if self.consumer is None:
            try:
                self.consumer = KafkaConsumer(
                    *self.subscribe_topics,
                    bootstrap_servers=self.brokers,
                    group_id=self.group_id,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    key_deserializer=lambda k: k.decode("utf-8") if k else None,
                    auto_offset_reset="latest",
                    enable_auto_commit=True,
                    consumer_timeout_ms=1000,
                )
                logger.info("✅ Kafka consumer created")
            except Exception as e:
                logger.error(f"❌ Failed to create Kafka consumer: {e}")
                raise
        return self.consumer

    def get_producer(self):
        if self.producer is None:
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=self.brokers,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if k else None,
                    acks="all",
                    retries=3,
                    max_in_flight_requests_per_connection=1,
                    enable_idempotence=True,
                )
                logger.info("✅ Kafka producer created")
            except Exception as e:
                logger.error(f"❌ Failed to create Kafka producer: {e}")
                raise
        return self.producer


kafka_config = KafkaConfig()


