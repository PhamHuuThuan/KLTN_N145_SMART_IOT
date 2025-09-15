import { Kafka } from 'kafkajs';
import RuleEvaluationService from '../services/RuleEvaluationService.js';
import dotenv from 'dotenv';

dotenv.config();

class RuleConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'rules-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    this.consumer = this.kafka.consumer({ 
      groupId: 'rules-service-group',
      allowAutoTopicCreation: true,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    this.ruleEvaluationService = new RuleEvaluationService();
  }

  async start() {
    try {
      console.log('🚀 Starting Rules Service Consumer...');
      
      await this.consumer.connect();
      console.log('✅ Connected to Kafka');

      // Subscribe to telemetry logs topic
      await this.consumer.subscribe({ 
        topic: 'iot.telemetry.logs', 
        fromBeginning: false 
      });

      console.log('📡 Subscribed to iot.telemetry.logs topic');

      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: 5000,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            console.log(`📨 Received message from topic: ${topic}, partition: ${partition}`);
            
            const logData = JSON.parse(message.value.toString());
            console.log(`📋 Log data:`, JSON.stringify(logData, null, 2));
            
            if (logData.type === 'telemetry' && logData.deviceId && logData.payload) {
              console.log(`🔍 Processing telemetry data for device: ${logData.deviceId}`);
              
              await this.ruleEvaluationService.evaluateRules(
                logData.deviceId, 
                logData.payload,
                logData.ownerId
              );
            } else {
              console.log(`⚠️ Skipping non-telemetry data or missing required fields`);
            }

          } catch (error) {
            console.error(`❌ Error processing message from ${topic}:`, error);
            console.error('📋 Error details:', {
              message: error.message,
              stack: error.stack,
              topic,
              partition,
              messageValue: message.value.toString()
            });
            
            console.log(`⚠️ Continuing to process next message...`);
          }
        },
      });

      console.log('✅ Rules Service Consumer started successfully');

    } catch (error) {
      console.error('❌ Error starting Rules Service Consumer:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.consumer.disconnect();
      console.log('✅ Rules Service Consumer disconnected');
    } catch (error) {
      console.error('❌ Error stopping Rules Service Consumer:', error);
    }
  }
}

export default RuleConsumer;
