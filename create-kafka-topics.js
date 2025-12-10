// Script to create Kafka topics for the Smart IoT project
// Run this once before starting the services

import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafka = new Kafka({
  clientId: 'topic-creator',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(',')
});

const admin = kafka.admin();

async function createTopics() {
  try {
    console.log('🔌 Connecting to Kafka admin...');
    await admin.connect();
    console.log('✅ Connected to Kafka admin');

    const topics = [
      {
        topic: 'iot.telemetry.logs',
        numPartitions: 3,
        replicationFactor: 1
      },
      {
        topic: 'iot.events.logs',
        numPartitions: 3,
        replicationFactor: 1
      },
      {
        topic: 'device.emergency',
        numPartitions: 1,
        replicationFactor: 1
      },
      {
        topic: 'iot.alerts.ml',
        numPartitions: 3,
        replicationFactor: 1
      }
    ];

    console.log('📝 Creating topics...');
    await admin.createTopics({
      topics: topics,
      waitForLeaders: true
    });

    console.log('✅ Topics created successfully:');
    topics.forEach(topic => {
      console.log(`  - ${topic.topic} (${topic.numPartitions} partitions)`);
    });

    console.log('\n🚀 You can now start the services:');
    console.log('  1. Start Kafka: cd services/devices-service && docker-compose up -d');
    console.log('  2. Start devices-service: cd services/devices-service && npm start');
    console.log('  3. Start mqtt-service: cd services/mqtt-service && npm start');

  } catch (error) {
    console.error('❌ Error creating topics:', error.message);
  } finally {
    await admin.disconnect();
    console.log('🔌 Disconnected from Kafka admin');
  }
}

createTopics();
