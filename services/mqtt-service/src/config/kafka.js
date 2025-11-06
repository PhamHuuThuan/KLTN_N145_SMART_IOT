const { Kafka } = require('kafkajs');
const config = require('./index');
const { logger } = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'mqtt-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer();

async function connectKafka() {
  try {
    logger.info('Connecting to Kafka...');
    await producer.connect();
    logger.info('Kafka producer connected');
    return producer;
  } catch (error) {
    logger.error('Kafka connection failed:', error.message);
    throw error;
  }
}

async function publishTelemetryLog(telemetryData) {
  try {
    const message = {
      topic: 'iot.telemetry.logs',
      messages: [{
        key: telemetryData.deviceId,
        value: JSON.stringify(telemetryData),
        timestamp: Date.now().toString()
      }]
    };

    await producer.send(message);
    logger.info(`Published telemetry to Kafka: ${telemetryData.deviceId}`);
    return true;
  } catch (error) {
    logger.error('Failed to publish to Kafka:', error.message);
    throw error;
  }
}

async function publishEventLog(eventData) {
  try {
    const message = {
      topic: 'iot.events.logs',
      messages: [{
        key: eventData.deviceId,
        value: JSON.stringify(eventData),
        timestamp: Date.now().toString()
      }]
    };

    await producer.send(message);
    logger.info(`Published event to Kafka: ${eventData.deviceId}`);
    return true;
  } catch (error) {
    logger.error('Failed to publish event to Kafka:', error.message);
    throw error;
  }
}

async function disconnectKafka() {
  try {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka:', error.message);
  }
}

module.exports = {
  connectKafka,
  publishTelemetryLog,
  publishEventLog,
  disconnectKafka
};
