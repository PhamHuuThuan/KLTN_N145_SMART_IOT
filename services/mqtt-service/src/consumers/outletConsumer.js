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
        'outlet.toggled',
        'outlet.settings.updated'
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
            case 'outlet.settings.updated':
              await handleOutletSettingsUpdate(messageData);
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
      
      // Publish status update to Kafka for real-time updates
      await publishOutletStatusUpdate(deviceId, outletId, status);
    } else {
      logger.error(`Failed to send outlet toggle command to device ${deviceId}`);
    }
  } catch (error) {
    logger.error('Error handling outlet toggle:', error);
  }
}

async function handleOutletSettingsUpdate(data) {
  const { deviceId, outletId, name, type } = data;
  
  logger.info(`Processing outlet settings update: ${deviceId}/${outletId} -> ${name} (${type})`);

  try {
    await mqttClient.updateDeviceOutletSettings(deviceId, outletId, { name, type });
    logger.info(`Outlet settings updated for device ${deviceId}`);
  } catch (error) {
    logger.error('Error handling outlet settings update:', error);
  }
}

async function publishOutletStatusUpdate(deviceId, outletId, status) {
  try {
    const { producer } = require('../config/kafka');
    
    if (!producer) {
      logger.error('Kafka producer not available');
      return;
    }
    
    await producer.send({
      topic: 'device.status.updated',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          outletId,
          status,
          action: 'outlet_status_updated',
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`Published outlet status update for ${deviceId}/${outletId}`);
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
