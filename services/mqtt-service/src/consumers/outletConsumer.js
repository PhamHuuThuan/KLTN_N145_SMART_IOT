const { Kafka } = require('kafkajs');
const mqttClient = require('../mqtt/client');
const { logger } = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'mqtt-outlet-consumer',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:29092'],
});

const consumer = kafka.consumer({ groupId: 'mqtt-outlet-group' });

async function startOutletConsumer() {
  try {
    await consumer.connect();
    logger.info('Outlet consumer connected to Kafka');

    await consumer.subscribe({ 
      topics: [
        'outlet.toggled'
      ],
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          logger.info(`Received outlet message from ${topic}:`, messageData);

          switch (topic) {
            case 'outlet.toggled':
              await handleOutletToggle(messageData);
              break;
            default:
              logger.warn(`Unknown topic: ${topic}`);
          }
        } catch (error) {
          logger.error('Error processing outlet message:', error);
        }
      },
    });

    logger.info('Outlet consumer started successfully');
  } catch (error) {
    logger.error('Error starting outlet consumer:', error);
  }
}

async function handleOutletToggle(data) {
  const { deviceId, outletId, status, action } = data;
  
  logger.info(`Processing outlet toggle: ${deviceId}/${outletId} -> ${status ? 'ON' : 'OFF'}`);

  try {
    // Send MQTT command to device
    const command = {
      action: 'SET_OUTLET',
      params: {
        key: outletId,
        state: status ? 'ON' : 'OFF'
      }
    };

    const success = await mqttClient.sendCommand(deviceId, 'SET_OUTLET', command);
    
    if (success) {
      logger.info(`Outlet toggle command sent to device ${deviceId}`);
      
      await publishOutletStatusUpdate(deviceId, outletId, status);
    } else {
      logger.error(`Failed to send outlet toggle command to device ${deviceId}`);
    }
  } catch (error) {
    logger.error('Error handling outlet toggle:', error);
  }
}

async function publishOutletStatusUpdate(deviceId, outletId, status) {
  try {
    const { producer } = require('../config/kafka');
    
    if (!producer) {
      logger.error('Kafka producer not available');
      return;
    }
    
  } catch (error) {
    logger.error('Error publishing outlet status update:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down outlet consumer...');
  await consumer.disconnect();
  process.exit(0);
});

module.exports = {
  startOutletConsumer
};
