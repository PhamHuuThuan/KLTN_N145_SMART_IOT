import { Kafka } from 'kafkajs';
import RuleEvaluationService from '../services/RuleEvaluationService.js';
import logger from '../utils/logger.js';

class RuleConsumer {
  constructor() {
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:29092').split(',').map(b => b.trim());
    logger.info(`Kafka brokers configured: ${JSON.stringify(kafkaBrokers)}`);
    logger.info(`KAFKA_BROKERS env: ${process.env.KAFKA_BROKERS || 'NOT SET'}`);
    
    this.kafka = new Kafka({
      clientId: 'rules-service-consumer',
      brokers: kafkaBrokers,
      retry: { initialRetryTime: 100, retries: 8 },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'rules-service-group',
      allowAutoTopicCreation: true,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.ruleEvaluationService = new RuleEvaluationService();
  }

  async start() {
    try {
      logger.info('Starting Rules Service Consumer...');
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'iot.telemetry.logs', fromBeginning: false });
      logger.info('Connected & subscribed to topic: iot.telemetry.logs');

      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: 5000,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const logData = JSON.parse(message.value.toString());
            logger.debug(`[${topic}:${partition}] ${logData.deviceId || 'Unknown Device'}`);

            if (logData?.type === 'telemetry' && logData.deviceId && logData.payload) {
              // Pass ownerId to sensorData if available
              const sensorData = {
                ...logData.payload,
                ownerId: logData.ownerId || logData.payload.ownerId
              };
              await this.ruleEvaluationService.evaluateRules(
                logData.deviceId,
                sensorData
              );
            } else {
              logger.warn('Skipped: invalid or non-telemetry message');
            }
          } catch (err) {
            logger.error(`Message processing error: ${err.message}`, {
              topic, partition, value: message.value.toString(),
            });
          }
        },
      });

      logger.info('Rules Service Consumer running');
    } catch (err) {
      logger.error('Failed to start consumer:', err);
      throw err;
    }
  }

  async stop() {
    try {
      await this.consumer.disconnect();
      logger.info('Consumer disconnected');
    } catch (err) {
      logger.error('Error stopping consumer:', err);
    }
  }
}

export default RuleConsumer;
