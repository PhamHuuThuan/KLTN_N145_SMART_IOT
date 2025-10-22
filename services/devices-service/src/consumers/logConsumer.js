import { Kafka } from 'kafkajs';
import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import { emitDeviceTelemetry } from '../realtime/socket.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js'; 

dotenv.config();
const VERBOSE = process.env.LOG_VERBOSE === 'true';

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
    if (VERBOSE) logger.info(`Processing ${type} data for device: ${deviceId}`);
    
    if (!deviceId || !payload) {
      logger.error(`Missing deviceId or payload:`, { deviceId, payload });
      return;
    }
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      if (VERBOSE) logger.error(`Device not found: ${deviceId}`);
      return;
    }

    // Update device online status
    device.lastSeenAt = new Date();
    device.status = 'online';
    device.lastUpdate = new Date();
    
    // Update outlet statuses if provided
    if (payload.o && typeof payload.o === 'object') {
      Object.keys(payload.o).forEach(outletId => {
        const outlet = device.outlets.find(o => o.id === outletId);
        if (outlet) {
          const newVal = payload.o[outletId];
          if (newVal === undefined || newVal === null) {
            return;
          }
          const oldStatus = outlet.status;
          outlet.status = newVal;
          outlet.lastToggleAt = new Date();
          if (VERBOSE) logger.info(`Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          if (VERBOSE) logger.error(`Outlet not found: ${outletId}`);
        }
      });
    } else if (payload.outlets && typeof payload.outlets === 'object') {
      if (VERBOSE) logger.info(`Updating outlet statuses from payload.outlets:`, payload.outlets);
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
          if (VERBOSE) logger.info(`Outlet ${outletId}: ${oldStatus} -> ${outlet.status}`);
        } else {
          if (VERBOSE) logger.error(`Outlet not found: ${outletId}`);
        }
      });
    } else {
      if (VERBOSE) logger.error(`No outlet data found in payload for ${type} log`);
    }
    
    let shouldPersist = true;

    // Update latest telemetry (only set provided fields; do not default to 0)
    if (payload.temp !== undefined || payload.humid !== undefined || payload.smoke !== undefined || payload.gas_ppm !== undefined || payload.o || payload.outlets) {
      const prev = device.latestTelemetry || { ts: Date.now(), o: {} };
      device.latestTelemetry = {
        ts: payload.ts || prev.ts || Date.now(),
        temp: payload.temp !== undefined ? payload.temp : prev.temp,
        humid: payload.humid !== undefined ? payload.humid : prev.humid,
        smoke: payload.smoke !== undefined ? payload.smoke : prev.smoke,
        gas_ppm: payload.gas_ppm !== undefined ? payload.gas_ppm : prev.gas_ppm,
        o: (payload.o || payload.outlets || prev.o || {})
      };
      if (VERBOSE) logger.info(`Updated latest telemetry:`);
      // Emit to socket clients
      emitDeviceTelemetry(deviceId, device.latestTelemetry);
    } else if (type === 'event' && (payload.o || payload.outlets)) {
      // For event logs, only update outlet status in latestTelemetry
      if (!device.latestTelemetry) {
        device.latestTelemetry = { ts: Date.now(), o: {} };
      }
      device.latestTelemetry.o = payload.o || payload.outlets || device.latestTelemetry.o;
      device.latestTelemetry.ts = payload.ts || Date.now();
      if (VERBOSE) logger.info(`Updated outlet status in latestTelemetry`);
      // Emit to socket clients
      emitDeviceTelemetry(deviceId, device.latestTelemetry);
    } else if (type === 'event' && payload.ack) {
      // For ack events, only update timestamp and keep existing telemetry
      if (VERBOSE) logger.info(`ACK event received for device ${deviceId}`);
      if (!device.latestTelemetry) {
        device.latestTelemetry = { ts: Date.now(), o: {} };
      } else {
        // Only update timestamp, preserve existing sensor values
        device.latestTelemetry.ts = payload.ts || Date.now();
      }
      if (VERBOSE) logger.info(`Updated timestamp for ACK event`);
      emitDeviceTelemetry(deviceId, device.latestTelemetry);
      // Do NOT persist ack-only updates to avoid DB write amplification
      shouldPersist = false;
    } else {
      if (VERBOSE) logger.error(`No sensor data found in ${type} log, keeping existing telemetry`);
    }
    
    if (shouldPersist) {
      if (VERBOSE) logger.info(`Saving device to database...`);
      await device.save();
      if (VERBOSE) logger.info(`Device status updated successfully: ${deviceId}`);
    } else if (VERBOSE) {
      logger.info(`Skipped DB save for ACK-only update: ${deviceId}`);
    }
    
  } catch (error) {
    logger.error(`Error updating device status:`, error);
    logger.error(`Error details:`, {
      message: error.message,
      stack: error.stack,
      deviceId: data?.deviceId,
      payload: data?.payload
    });
  }
}

async function startLogConsumer() {
  try {
    await consumer.connect();

    await consumer.subscribe({ 
      topic: 'iot.telemetry.logs', 
      fromBeginning: false 
    });

    await consumer.subscribe({ 
      topic: 'iot.events.logs', 
      fromBeginning: false 
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (VERBOSE) logger.info(`Received message from topic: ${topic}, partition: ${partition}`);
          
          const logData = JSON.parse(message.value.toString());

          // Create and save device log 
          let savedLog = null;
          if (!(logData.type === 'event' && logData.payload?.ack === true)) {
            const deviceLog = new DeviceLog(logData);
            await deviceLog.save();
            savedLog = deviceLog;
          };
          
          // Update device status if it's telemetry or event data
          if ((logData.type === 'telemetry' || logData.type === 'event') && logData.deviceId) {
            await updateDeviceStatus(logData);
          }
          
          // Mark log as processed when we created one
          if (savedLog) {
            savedLog.markAsProcessed();
            await savedLog.save();
            if (VERBOSE) logger.info(`Device log marked as processed`);
          }

        } catch (error) {
          logger.error(`Error processing message from ${topic}:`, error);
          logger.error('Error details:', {  
            message: error.message,
            stack: error.stack,
            topic,
            partition,
            messageValue: message.value.toString()
          });
          
          // Don't throw error to prevent consumer from stopping
          if (VERBOSE) logger.error(`Continuing to process next message...`);
          
          // Mark message as processed even if failed to prevent infinite retry
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

  } catch (error) {
    logger.error('Kafka consumer error:', error.message);
    throw error;
  }
}

async function stopLogConsumer() {
  try {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer:', error.message);
  }
}

export { startLogConsumer, stopLogConsumer };
