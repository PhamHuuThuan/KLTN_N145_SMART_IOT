import { Kafka } from 'kafkajs';
import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import MessageCount from '../models/MessageCount.js';
import { emitDeviceTelemetry } from '../realtime/socket.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js'; 

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
    
    if (!deviceId || !payload) {
      logger.error(`Missing deviceId or payload:`, { deviceId, payload });
      return;
    }
    
    // Skip device update for ACK events (they don't have sensor data)
    if (type === 'event' && payload.ack) {
      logger.debug(`ACK event - skipping device update`);
      return;
    }
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
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
        } else {
          logger.error(`Outlet not found: ${outletId}`);
        }
      });
    } else {
      logger.warn(`No outlet data found in payload for ${type} log`);
    }
    
    let shouldPersist = true;

    // Update latest telemetry (only set provided fields; do not default to 0)
    if (payload.temp !== undefined || payload.humid !== undefined || payload.smoke !== undefined || payload.gas_ppm !== undefined || payload.o) {
      const prev = device.latestTelemetry || { ts: Date.now(), o: {} };
      device.latestTelemetry = {
        ts: payload.ts || prev.ts || Date.now(),
        temp: payload.temp !== undefined ? payload.temp : prev.temp,
        humid: payload.humid !== undefined ? payload.humid : prev.humid,
        smoke: payload.smoke !== undefined ? payload.smoke : prev.smoke,
        gas_ppm: payload.gas_ppm !== undefined ? payload.gas_ppm : prev.gas_ppm,
        o: (payload.o || payload.outlets || prev.o || {})
      };
      // Emit to socket clients
      logger.info(`Emitting telemetry to socket for ${deviceId}`, device.latestTelemetry);
      emitDeviceTelemetry(deviceId, device.latestTelemetry);
    } else if (type === 'event' && payload.o) {
      // For event logs with outlet data, update outlet status in latestTelemetry
      if (!device.latestTelemetry) {
        device.latestTelemetry = { ts: Date.now(), o: {} };
      }
      device.latestTelemetry.o = payload.o || device.latestTelemetry.o;
      device.latestTelemetry.ts = payload.ts || Date.now();
      // Emit to socket clients
      logger.info(`Emitting event telemetry to socket for ${deviceId}`, device.latestTelemetry);
      emitDeviceTelemetry(deviceId, device.latestTelemetry);
    } else {
      logger.error(`No sensor data found in ${type} log, keeping existing telemetry`);
    }
    
    if (shouldPersist) {
      await device.save();
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
    logger.info('Kafka consumer connected');

    await consumer.subscribe({ 
      topics: ['iot.telemetry.logs', 'iot.events.logs'],
      fromBeginning: false 
    });
    
    logger.info('Subscribed to topics: iot.telemetry.logs, iot.events.logs');

    // Utility: per-op timeout to avoid stalling the consumer
    const withTimeout = async (promise, ms, label) => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} after ${ms}ms`)), ms));
      return Promise.race([promise, timeout]);
    };

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      // optionally: partitionsConsumedConcurrently: 3,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          logger.info(`LogConsumer received message from topic: ${topic}, partition: ${partition}`);
          
          let logData;
          try {
            logData = JSON.parse(message.value.toString());
          } catch (parseErr) {
            logger.error(`Invalid JSON message, skipping: ${parseErr.message}`);
            return; // skip this message
          }
          logger.info(`Processing ${logData.type} from ${logData.deviceId}`);

          // Increment persisted counters: per-topic (daily) and per-device (daily)
          try {
            const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            // topic counter
            await MessageCount.increment({ kind: 'topic', topic, date });
            // device counter (if present)
            if (logData.deviceId) {
              await MessageCount.increment({ kind: 'device', deviceId: logData.deviceId, date });
            }

            // Read back counters to confirm (best-effort, non-critical)
            try {
              const topicKey = [ 'topic', topic, date ].join('|');
              const topicDoc = await MessageCount.findOne({ key: topicKey }).lean();
              const topicCount = topicDoc ? topicDoc.count : 0;
              logger.info(`MessageCount topic=${topic} date=${date} => ${topicCount}`);

              if (logData.deviceId) {
                const deviceKey = [ 'device', logData.deviceId, date ].join('|');
                const deviceDoc = await MessageCount.findOne({ key: deviceKey }).lean();
                const deviceCount = deviceDoc ? deviceDoc.count : 0;
                logger.info(`MessageCount device=${logData.deviceId} date=${date} => ${deviceCount}`);
              }
            } catch (readErr) {
              logger.warn(`Could not read message counters after increment: ${readErr.message}`);
            }
          } catch (incErr) {
            logger.error(`Failed to increment message counters: ${incErr.message}`);
          }

          // Create and save device log (including event/ack)
          let savedLog = null;
          try {
            // Handle event/ack logs with minimal payload
            let logToSave = logData;
            if (logData.type === 'event' && logData.payload?.ack === true) {
              // Extract outlet info from ACK if available
              const ackOutlets = logData.payload.o || logData.metadata?.ackData?.o || {};
              
              logToSave = {
                ...logData,
                payload: {
                  ts: logData.payload.ts || Date.now(),
                  temp: 0,
                  humid: 0,
                  smoke: 0,
                  gas_ppm: 0,
                  o: {
                    o1: ackOutlets.o1 ?? false,
                    o2: ackOutlets.o2 ?? false,
                    o3: ackOutlets.o3 ?? false,
                    o4: ackOutlets.o4 ?? false,
                    o5: ackOutlets.o5 ?? false
                  }
                },
                metadata: {
                  ...logData.metadata
                }
              };
            }
            
            const deviceLog = new DeviceLog(logToSave);
            await withTimeout(deviceLog.save(), 2000, 'saving device log');
            savedLog = deviceLog;
          } catch (saveError) {
            logger.error(`Error saving device log (skipped): ${saveError.message}`);
          }
          
          // Update device status if it's telemetry or event data (skip ack events)
          if ((logData.type === 'telemetry' || (logData.type === 'event' && !logData.payload?.ack)) && logData.deviceId) {
            try {
              logger.info(`Updating device status for ${logData.deviceId}`);
              await withTimeout(updateDeviceStatus(logData), 1500, 'updating device status');
              logger.info(`Device status updated for ${logData.deviceId}`);
            } catch (updErr) {
              logger.error(`Update device status failed (skipped): ${updErr.message}`);
            }
          }
          
          // Mark log as processed when we created one
          if (savedLog) {
            try {
              savedLog.markAsProcessed();
              await withTimeout(savedLog.save(), 1500, 'mark processed');
            } catch (markErr) {
              logger.error(`Mark processed failed (skipped): ${markErr.message}`);
            }
          }

        } catch (error) {
          // Keep errors contained per-message, never throw to KafkaJS runner
          logger.error(`Error processing message from ${topic}: ${error.message}`);
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
