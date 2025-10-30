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

// Topics
export const TOPICS = {
  DEVICE_ALERTS: 'device-alerts',
  NOTIFICATION_REQUESTS: 'notification-requests',
  USER_ACTIONS: 'user-actions'
};

// Connect to Kafka
export const connectKafka = async () => {
  try {
    const brokers = process.env.KAFKA_BROKERS || 'localhost:29092';
    
    // Test connection first
    await producer.connect();
    await consumer.connect();
    
    logger.info('📡 Kafka connected successfully', {
      brokers: brokers
    });

    // Subscribe to topics
    await consumer.subscribe({
      topics: Object.values(TOPICS),
      fromBeginning: false
    });

    logger.info('📋 Kafka consumer subscribed to topics', {
      topics: Object.values(TOPICS)
    });

    return true;
  } catch (error) {
    logger.warn('⚠️  Kafka connection failed, continuing without Kafka:', error.message);
    // Disconnect to prevent retry loops
    try {
      await producer.disconnect();
      await consumer.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    return false;
  }
};

// Send message to Kafka
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

    logger.debug('Message sent to Kafka', {
      topic,
      partition: result[0].partition,
      offset: result[0].offset
    });

    return result;
  } catch (error) {
    logger.error('Error sending message to Kafka:', error);
    throw error;
  }
};

// Consume messages from Kafka
export const consumeMessages = async (messageHandler) => {
  try {
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          
          logger.debug('Message received from Kafka', {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString()
          });

          await messageHandler(topic, messageData);
        } catch (error) {
          logger.error('Error processing Kafka message:', error);
        }
      }
    });
  } catch (error) {
    logger.warn('Error consuming Kafka messages, continuing without Kafka consumer:', error.message);
    // Don't throw error, just log warning and continue
  }
};

// Graceful shutdown
export const disconnectKafka = async () => {
  try {
    await consumer.disconnect();
    await producer.disconnect();
    logger.info('Kafka disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from Kafka:', error);
  }
};

export { producer, consumer };
