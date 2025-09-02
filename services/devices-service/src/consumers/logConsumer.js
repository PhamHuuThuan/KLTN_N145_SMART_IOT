import { Kafka } from 'kafkajs';
import DeviceLog from '../models/DeviceLog.js';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'devices-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: 'devices-service-group' });

async function startLogConsumer() {
  try {
    console.log('🔌 Connecting to Kafka consumer...');
    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    // Subscribe to telemetry logs topic
    await consumer.subscribe({ 
      topic: 'iot.telemetry.logs', 
      fromBeginning: false 
    });

    // Subscribe to events logs topic
    await consumer.subscribe({ 
      topic: 'iot.events.logs', 
      fromBeginning: false 
    });

    console.log('📡 Subscribed to topics: iot.telemetry.logs, iot.events.logs');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const logData = JSON.parse(message.value.toString());
          console.log(`📨 Received from ${topic}: ${logData.deviceId}`);

          // Create and save device log
          const deviceLog = new DeviceLog(logData);
          await deviceLog.save();
          
          console.log(`✅ Log saved to MongoDB: ${deviceLog._id}`);
          
          // Check for emergency conditions
          if (logData.type === 'telemetry') {
            const emergencyCheck = deviceLog.checkEmergencyConditions();
            if (emergencyCheck.emergency) {
              console.log(`🚨 EMERGENCY DETECTED: ${emergencyCheck.reason} for device ${logData.deviceId}`);
              // TODO: Send emergency notification
            }
          }

        } catch (error) {
          console.error(`❌ Error processing message from ${topic}:`, error.message);
          console.error('📋 Message:', message.value.toString());
        }
      },
    });

  } catch (error) {
    console.error('❌ Kafka consumer error:', error.message);
    throw error;
  }
}

async function stopLogConsumer() {
  try {
    await consumer.disconnect();
    console.log('🔌 Kafka consumer disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Kafka consumer:', error.message);
  }
}

export { startLogConsumer, stopLogConsumer };
