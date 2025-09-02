const { Kafka } = require('kafkajs');
const config = require('./index');

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
    console.log('🔌 Connecting to Kafka...');
    await producer.connect();
    console.log('✅ Kafka producer connected');
    return producer;
  } catch (error) {
    console.error('❌ Kafka connection failed:', error.message);
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
    console.log(`📤 Published telemetry to Kafka: ${telemetryData.deviceId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to publish to Kafka:', error.message);
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
    console.log(`📤 Published event to Kafka: ${eventData.deviceId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to publish event to Kafka:', error.message);
    throw error;
  }
}

async function disconnectKafka() {
  try {
    await producer.disconnect();
    console.log('🔌 Kafka producer disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Kafka:', error.message);
  }
}

module.exports = {
  connectKafka,
  publishTelemetryLog,
  publishEventLog,
  disconnectKafka
};
