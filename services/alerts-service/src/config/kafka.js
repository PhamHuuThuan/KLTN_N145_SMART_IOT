import { Kafka } from 'kafkajs';
import logger from '../utils/logger.js';

const kafka = new Kafka({
  clientId: 'alerts-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 3
  },
  connectionTimeout: 5000,
  requestTimeout: 25000
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'alerts-service-group' });

export const TOPICS = {
  DEVICE_ALERTS: 'device-alerts',
  NOTIFICATION_REQUESTS: 'notification-requests',
  USER_ACTIONS: 'user-actions'
};

export const connectKafka = async () => {
  try {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:29092';
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({
      topics: Object.values(TOPICS),
      fromBeginning: false
    });

    return true;
  } catch (error) {
    logger.warn('⚠️  Kafka connection failed, continuing without Kafka:', error.message);
    try {
      await producer.disconnect();
      await consumer.disconnect();
    } catch (disconnectError) {
    }
    return false;
  }
};

export const sendMessage = async (topic, message) => {
  try {
    const result = await producer.send({
      topic,
      messages: [{
        key: message.key || 'alerts-service',
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }]
    });

    return result;
  } catch (error) {
    logger.error('Error sending message to Kafka:', error);
    throw error;
  }
};

export const consumeMessages = async (messageHandler) => {
  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          await messageHandler(topic, messageData);
        } catch (error) {
          logger.error('Error processing Kafka message:', error);
        }
      }
    });
  } catch (error) {
    logger.warn('Error consuming Kafka messages, continuing without Kafka consumer:', error.message);
  }
};

export const disconnectKafka = async () => {
  try {
    await consumer.disconnect();
    await producer.disconnect();
  } catch (error) {
    logger.error('Error disconnecting from Kafka:', error);
  }
};

export { producer, consumer };
