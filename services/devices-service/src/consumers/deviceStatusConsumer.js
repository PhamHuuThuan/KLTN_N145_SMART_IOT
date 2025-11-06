import { Kafka } from 'kafkajs';
import Device from '../models/Device.js';
import logger from '../utils/logger.js';

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

    await consumer.subscribe({ 
      topics: [
      ],
      fromBeginning: false 
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          logger.info(`DeviceStatusConsumer received message from topic: ${topic}`);
          const messageData = JSON.parse(message.value.toString());
          logger.info(`Message data`);

          switch (topic) {
            case 'device.status.updated':
              logger.info(`Handling device status update`);
              await handleDeviceStatusUpdate(messageData);
              break;
            default:
              logger.info(`Unknown topic: ${topic}`);
          }
        } catch (error) {
          logger.error('Error processing device status message:', error);
          logger.error('Error details:', {
            message: error.message,
            stack: error.stack,
            topic,
            partition,
            messageValue: message.value.toString()
          });
          
          logger.info(`Continuing to process next message...`);
          
          try {
            await consumer.commitOffsets([{
              topic,
              partition,
              offset: message.offset
            }]);
          } catch (commitError) {
            logger.error('Error committing offset:', commitError);
          }
        }
      },
    });

    // Device status consumer started successfully
  } catch (error) {
    logger.error('Error starting device status consumer:', error);
  }
}

async function handleDeviceStatusUpdate(data) {
  try {
    const { deviceId, outletId, status, action } = data;
    
    logger.info(`Processing device status update: ${deviceId}/${outletId} -> ${status}`);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
      return;
    }

    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      const oldStatus = outlet.status;
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
    } else {
      logger.error(`Outlet not found: ${outletId}`);
    }
  } catch (error) {
    logger.error('Error handling device status update:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

async function handleOutletToggle(data) {
  try {
    const { deviceId, outletId, status } = data;
    
    logger.info(`Processing outlet toggle: ${deviceId}/${outletId} -> ${status}`);

    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
      return;
    }

    // Update outlet status
    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      const oldStatus = outlet.status;
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
      logger.info(`Outlet toggle processed: ${outletId} ${oldStatus} -> ${status}`);
    } else {
      logger.error(`Outlet not found: ${outletId}`);
    }
  } catch (error) {
    logger.error('Error handling outlet toggle:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

process.on('SIGINT', async () => {
  await consumer.disconnect();
  process.exit(0);
});

export { startDeviceStatusConsumer };
