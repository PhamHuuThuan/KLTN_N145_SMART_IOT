import { Kafka } from 'kafkajs';
import Device from '../models/Device.js';
import config from '../config/database.js';

const kafka = new Kafka({
  clientId: 'devices-status-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ 
  groupId: 'devices-status-group',
  allowAutoTopicCreation: true,
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

async function startDeviceStatusConsumer() {
  try {
    await consumer.connect();
    // Device status consumer connected to Kafka

    // Subscribe to device status update topics
    await consumer.subscribe({ 
      topics: [
        'device.status.updated',
        'outlet.toggled'
      ],
      fromBeginning: false 
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          console.log(`📨 DeviceStatusConsumer received message from topic: ${topic}`);
          const messageData = JSON.parse(message.value.toString());
          console.log(`📋 Message data:`, JSON.stringify(messageData, null, 2));

          switch (topic) {
            case 'device.status.updated':
              console.log(`🔄 Handling device status update`);
              await handleDeviceStatusUpdate(messageData);
              break;
            case 'outlet.toggled':
              console.log(`🔌 Handling outlet toggle`);
              await handleOutletToggle(messageData);
              break;
            default:
              console.log(`⚠️ Unknown topic: ${topic}`);
          }
        } catch (error) {
          console.error('❌ Error processing device status message:', error);
          console.error('📋 Error details:', {
            message: error.message,
            stack: error.stack,
            topic,
            partition,
            messageValue: message.value.toString()
          });
          
          // Don't throw error to prevent consumer from stopping
          console.log(`⚠️ Continuing to process next message...`);
          
          // Mark message as processed even if failed to prevent infinite retry
          try {
            await consumer.commitOffsets([{
              topic,
              partition,
              offset: message.offset
            }]);
          } catch (commitError) {
            console.error('❌ Error committing offset:', commitError);
          }
        }
      },
    });

    // Device status consumer started successfully
  } catch (error) {
    console.error('❌ Error starting device status consumer:', error);
  }
}

async function handleDeviceStatusUpdate(data) {
  try {
    const { deviceId, outletId, status, action } = data;
    
    console.log(`🔄 Processing device status update: ${deviceId}/${outletId} -> ${status}`);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.error(`❌ Device not found: ${deviceId}`);
      return;
    }

    // Update outlet status
    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      const oldStatus = outlet.status;
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
    } else {
      console.error(`❌ Outlet not found: ${outletId}`);
    }
  } catch (error) {
    console.error('❌ Error handling device status update:', error);
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

async function handleOutletToggle(data) {
  try {
    const { deviceId, outletId, status } = data;
    
    console.log(`🔌 Processing outlet toggle: ${deviceId}/${outletId} -> ${status}`);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.error(`❌ Device not found: ${deviceId}`);
      return;
    }

    // Update outlet status
    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      const oldStatus = outlet.status;
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
      console.log(`✅ Outlet toggle processed: ${outletId} ${oldStatus} -> ${status}`);
    } else {
      console.error(`❌ Outlet not found: ${outletId}`);
    }
  } catch (error) {
    console.error('❌ Error handling outlet toggle:', error);
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  // Shutting down device status consumer
  await consumer.disconnect();
  process.exit(0);
});

export { startDeviceStatusConsumer };
