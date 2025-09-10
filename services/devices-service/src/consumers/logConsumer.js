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

const consumer = kafka.consumer({ 
  groupId: 'devices-service-group',
  allowAutoTopicCreation: true,
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

// Update device status from telemetry or event data
async function updateDeviceStatus(data) {
  try {
    const { deviceId, payload, type } = data;
    
    console.log(`🔍 Processing ${type} data for device: ${deviceId}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));
    
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
      console.log(`🔌 Updating outlet statuses from payload.o:`, payload.o);
      Object.keys(payload.o).forEach(outletId => {
        const outlet = device.outlets.find(o => o.id === outletId);
        if (outlet) {
          const newVal = payload.o[outletId];
          if (newVal === undefined || newVal === null) {
            return; // skip unknowns
          }
          const oldStatus = outlet.status;
          outlet.status = newVal;
          outlet.lastToggleAt = new Date();
          console.log(`🔌 Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          console.log(`⚠️ Outlet not found: ${outletId}`);
        }
      });
    } else if (payload.outlets && typeof payload.outlets === 'object') {
      // Fallback for outlets object
      console.log(`🔌 Updating outlet statuses from payload.outlets:`, payload.outlets);
      Object.keys(payload.outlets).forEach(outletId => {
        const outlet = device.outlets.find(o => o.id === outletId);
        if (outlet) {
          const newVal = payload.outlets[outletId];
          if (newVal === undefined || newVal === null) {
            return;
          }
          const oldStatus = outlet.status;
          outlet.status = newVal;
          outlet.lastToggleAt = new Date();
          console.log(`🔌 Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          console.log(`⚠️ Outlet not found: ${outletId}`);
        }
      });
    } else {
      console.log(`⚠️ No outlet data found in payload for ${type} log`);
    }
    
    // Update latest telemetry (only set provided fields; do not default to 0)
    if (payload.temp !== undefined || payload.humid !== undefined || payload.smoke !== undefined || payload.gas_ppm !== undefined || payload.o || payload.outlets) {
      const prev = device.latestTelemetry || { ts: Date.now(), temp: null, humid: null, smoke: null, gas_ppm: null, o: {} };
      device.latestTelemetry = {
        ts: payload.ts || prev.ts || Date.now(),
        temp: payload.temp !== undefined ? payload.temp : prev.temp ?? null,
        humid: payload.humid !== undefined ? payload.humid : prev.humid ?? null,
        smoke: payload.smoke !== undefined ? payload.smoke : prev.smoke ?? null,
        gas_ppm: payload.gas_ppm !== undefined ? payload.gas_ppm : prev.gas_ppm ?? null,
        o: (payload.o || payload.outlets || prev.o || {})
      };
      console.log(`🌡️ Updated latest telemetry:`, device.latestTelemetry);
    } else if (type === 'event' && (payload.o || payload.outlets)) {
      // For event logs, only update outlet status in latestTelemetry
      if (!device.latestTelemetry) {
        device.latestTelemetry = { ts: Date.now(), temp: null, humid: null, smoke: null, gas_ppm: null, o: {} };
      }
      device.latestTelemetry.o = payload.o || payload.outlets || device.latestTelemetry.o;
      device.latestTelemetry.ts = payload.ts || Date.now();
      console.log(`🔌 Updated outlet status in latestTelemetry:`, device.latestTelemetry.o);
    } else {
      console.log(`⚠️ No sensor data found in ${type} log, keeping existing telemetry`);
    }
    
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
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          console.log(`📨 Received message from topic: ${topic}, partition: ${partition}`);
          
          const logData = JSON.parse(message.value.toString());
          console.log(`📋 Log data:`, JSON.stringify(logData, null, 2));
          
          // Create and save device log
          const deviceLog = new DeviceLog(logData);
          await deviceLog.save();
          console.log(`✅ Device log saved successfully`);
          
          // Update device status if it's telemetry or event data
          if ((logData.type === 'telemetry' || logData.type === 'event') && logData.deviceId) {
            console.log(`🔄 Updating device status for: ${logData.deviceId} (${logData.type})`);
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
          
          // Mark log as processed
          deviceLog.markAsProcessed();
          await deviceLog.save();
          console.log(`✅ Device log marked as processed`);

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
