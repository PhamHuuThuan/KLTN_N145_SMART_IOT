import { Kafka } from 'kafkajs';
import Device from '../models/Device.js';
import config from '../config/database.js';

const kafka = new Kafka({
  clientId: 'devices-status-consumer',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'],
});

const consumer = kafka.consumer({ groupId: 'devices-status-group' });

async function startDeviceStatusConsumer() {
  try {
    await consumer.connect();
    console.log('🔌 Device status consumer connected to Kafka');

    // Subscribe to device status update topics
    await consumer.subscribe({ 
      topics: [
        'device.status.updated',
        'outlet.toggled'
      ],
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          console.log(`📨 Received device status message from ${topic}:`, messageData);

          switch (topic) {
            case 'device.status.updated':
              await handleDeviceStatusUpdate(messageData);
              break;
            case 'outlet.toggled':
              await handleOutletToggle(messageData);
              break;
            default:
              console.log(`⚠️ Unknown topic: ${topic}`);
          }
        } catch (error) {
          console.error('❌ Error processing device status message:', error);
        }
      },
    });

    console.log('✅ Device status consumer started successfully');
  } catch (error) {
    console.error('❌ Error starting device status consumer:', error);
  }
}

async function handleDeviceStatusUpdate(data) {
  const { deviceId, outletId, status, action } = data;
  
  console.log(`📊 Processing device status update: ${deviceId}/${outletId} -> ${status ? 'ON' : 'OFF'}`);

  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.error(`❌ Device not found: ${deviceId}`);
      return;
    }

    // Update outlet status
    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
      console.log(`✅ Updated outlet ${outletId} status to ${status ? 'ON' : 'OFF'}`);
    } else {
      console.error(`❌ Outlet not found: ${outletId}`);
    }
  } catch (error) {
    console.error('❌ Error handling device status update:', error);
  }
}

async function handleOutletToggle(data) {
  const { deviceId, outletId, status } = data;
  
  console.log(`🔌 Processing outlet toggle: ${deviceId}/${outletId} -> ${status ? 'ON' : 'OFF'}`);

  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.error(`❌ Device not found: ${deviceId}`);
      return;
    }

    // Update outlet status
    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
      console.log(`✅ Updated outlet ${outletId} status to ${status ? 'ON' : 'OFF'}`);
    } else {
      console.error(`❌ Outlet not found: ${outletId}`);
    }
  } catch (error) {
    console.error('❌ Error handling outlet toggle:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down device status consumer...');
  await consumer.disconnect();
  process.exit(0);
});

export { startDeviceStatusConsumer };
