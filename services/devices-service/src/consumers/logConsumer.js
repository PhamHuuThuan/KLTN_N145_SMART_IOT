import { Kafka } from 'kafkajs';
import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
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

// Update device status from telemetry data
async function updateDeviceStatus(telemetryData) {
  try {
    const { deviceId, payload } = telemetryData;
    
    if (!deviceId || !payload) {
      console.log(`⚠️ Missing deviceId or payload:`, { deviceId, payload });
      return;
    }
    
    console.log(`🔍 Looking for device: ${deviceId}`);
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.log(`⚠️ Device not found: ${deviceId}`);
      return;
    }
    
    console.log(`📱 Found device: ${device.name}`);
    
    // Update device online status
    device.lastSeenAt = new Date();
    device.status = 'online';
    device.lastUpdate = new Date();
    
    // Update outlet statuses if provided
    if (payload.o && typeof payload.o === 'object') {
      console.log(`🔌 Updating outlet statuses:`, payload.o);
      Object.keys(payload.o).forEach(outletId => {
        const outlet = device.outlets.find(o => o.id === outletId);
        if (outlet) {
          const oldStatus = outlet.status;
          outlet.status = payload.o[outletId];
          outlet.lastToggleAt = new Date();
          console.log(`🔌 Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          console.log(`⚠️ Outlet not found: ${outletId}`);
        }
      });
    } else if (payload.outlets && typeof payload.outlets === 'object') {
      // Fallback for outlets object
      console.log(`🔌 Updating outlet statuses (fallback):`, payload.outlets);
      Object.keys(payload.outlets).forEach(outletId => {
        const outlet = device.outlets.find(o => o.id === outletId);
        if (outlet) {
          const oldStatus = outlet.status;
          outlet.status = payload.outlets[outletId];
          outlet.lastToggleAt = new Date();
          console.log(`🔌 Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          console.log(`⚠️ Outlet not found: ${outletId}`);
        }
      });
    }
    
    // Update latest telemetry
    device.latestTelemetry = {
      ts: payload.ts || Date.now(),
      temp: payload.temp || 0,
      humid: payload.humid || 0,
      smoke: payload.smoke || 0,
      gas_ppm: payload.gas_ppm || 0,
      o: payload.o || payload.outlets || {}
    };
    
    console.log(`💾 Saving device to database...`);
    await device.save();
    console.log(`✅ Device status updated successfully: ${deviceId}`);
    
  } catch (error) {
    console.error(`❌ Error updating device status:`, error);
    console.error(`📋 Error details:`, {
      message: error.message,
      stack: error.stack,
      deviceId: telemetryData?.deviceId,
      payload: telemetryData?.payload
    });
    // Don't throw error to prevent consumer from stopping
  }
}

async function startLogConsumer() {
  try {
    await consumer.connect();

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

    // Subscribed to topics: iot.telemetry.logs, iot.events.logs

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          console.log(`📨 Received message from topic: ${topic}, partition: ${partition}`);
          
          const logData = JSON.parse(message.value.toString());
          console.log(`📋 Log data:`, JSON.stringify(logData, null, 2));
          
          // Create and save device log
          const deviceLog = new DeviceLog(logData);
          await deviceLog.save();
          console.log(`✅ Device log saved successfully`);
          
          // Update device status if it's telemetry data
          if (logData.type === 'telemetry' && logData.deviceId) {
            console.log(`🔄 Updating device status for: ${logData.deviceId}`);
            await updateDeviceStatus(logData);
          }
          
          // Check for emergency conditions
          if (logData.type === 'telemetry') {
            const emergencyCheck = deviceLog.checkEmergencyConditions();
            if (emergencyCheck.emergency) {
              console.log(`🚨 EMERGENCY: ${emergencyCheck.reason} - ${logData.deviceId}`);
              // TODO: Send emergency notification
            }
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
          
          // Don't throw error to prevent consumer from stopping
          console.log(`⚠️ Continuing to process next message...`);
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
    // Kafka consumer disconnected
  } catch (error) {
    console.error('❌ Error disconnecting Kafka consumer:', error.message);
  }
}

export { startLogConsumer, stopLogConsumer };
