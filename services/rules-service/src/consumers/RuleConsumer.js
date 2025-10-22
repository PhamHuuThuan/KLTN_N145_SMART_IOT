import { Kafka } from 'kafkajs';
import RuleEvaluationService from '../services/RuleEvaluationService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RuleConsumer');

class RuleConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'rules-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
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
              await this.ruleEvaluationService.evaluateRules(
                logData.deviceId,
                logData.payload,
                logData.ownerId
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
