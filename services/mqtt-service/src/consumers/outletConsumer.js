const { Kafka } = require('kafkajs');
const mqttClient = require('../mqtt/client');

const kafka = new Kafka({
  clientId: 'mqtt-outlet-consumer',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:29092'],
});

const consumer = kafka.consumer({ groupId: 'mqtt-outlet-group' });

async function startOutletConsumer() {
  try {
    await consumer.connect();
    console.log('🔌 Outlet consumer connected to Kafka');

    // Subscribe to outlet control topics
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
          console.log(`📨 Received outlet message from ${topic}:`, messageData);

          switch (topic) {
            case 'outlet.toggled':
              await handleOutletToggle(messageData);
              break;
            case 'outlet.settings.updated':
              await handleOutletSettingsUpdate(messageData);
              break;
            default:
              console.log(`⚠️ Unknown topic: ${topic}`);
          }
        } catch (error) {
          console.error('❌ Error processing outlet message:', error);
        }
      },
    });

    console.log('✅ Outlet consumer started successfully');
  } catch (error) {
    console.error('❌ Error starting outlet consumer:', error);
  }
}

async function handleOutletToggle(data) {
  const { deviceId, outletId, status, action } = data;
  
  console.log(`🔌 Processing outlet toggle: ${deviceId}/${outletId} -> ${status ? 'ON' : 'OFF'}`);

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
      console.log(`✅ Outlet toggle command sent to device ${deviceId}`);
      
      // Publish status update to Kafka for real-time updates
      await publishOutletStatusUpdate(deviceId, outletId, status);
    } else {
      console.error(`❌ Failed to send outlet toggle command to device ${deviceId}`);
    }
  } catch (error) {
    console.error('❌ Error handling outlet toggle:', error);
  }
}

async function handleOutletSettingsUpdate(data) {
  const { deviceId, outletId, name, type } = data;
  
  console.log(`⚙️ Processing outlet settings update: ${deviceId}/${outletId} -> ${name} (${type})`);

  try {
    // Update device status in database via MQTT service
    await mqttClient.updateDeviceOutletSettings(deviceId, outletId, { name, type });
    console.log(`✅ Outlet settings updated for device ${deviceId}`);
  } catch (error) {
    console.error('❌ Error handling outlet settings update:', error);
  }
}

async function publishOutletStatusUpdate(deviceId, outletId, status) {
  try {
    const { producer } = require('../config/kafka');
    
    if (!producer) {
      console.error('❌ Kafka producer not available');
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

    console.log(`📤 Published outlet status update for ${deviceId}/${outletId}`);
  } catch (error) {
    console.error('❌ Error publishing outlet status update:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down outlet consumer...');
  await consumer.disconnect();
  process.exit(0);
});

module.exports = {
  startOutletConsumer
};
