import { Kafka } from 'kafkajs';
import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import { DEVICE_STATUS } from '../constants/deviceStatus.js';
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

const hasValue = (value) => value !== undefined && value !== null;

async function swallowError(label, fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    logger.error(`${label} failed (skipping): ${error.message}`);
    return fallback;
  }
}

async function updateDeviceStatus(data) {
  try {
    const { deviceId, payload, type } = data;
    
    if (!deviceId || !payload) {
      logger.error(`Missing deviceId or payload:`, { deviceId, payload });
      return;
    }
    
    if (type === 'event' && payload.ack) {
      return;
    }
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
      return;
    }

    device.lastSeenAt = new Date();
    device.status = DEVICE_STATUS.ONLINE;
    device.lastUpdate = new Date();
    
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

    if (hasValue(payload.temp) || hasValue(payload.humid) || hasValue(payload.smoke) || hasValue(payload.gas_ppm) || hasValue(payload.flame) || payload.o) {
      const prev = device.latestTelemetry || { ts: Date.now(), o: {}, flame: false };
      device.latestTelemetry = {
        ts: payload.ts || prev.ts || Date.now(),
        temp: hasValue(payload.temp) ? payload.temp : prev.temp,
        humid: hasValue(payload.humid) ? payload.humid : prev.humid,
        smoke: hasValue(payload.smoke) ? payload.smoke : prev.smoke,
        gas_ppm: hasValue(payload.gas_ppm) ? payload.gas_ppm : prev.gas_ppm,
        flame: hasValue(payload.flame) ? payload.flame : prev.flame,
        o: (payload.o || payload.outlets || prev.o || {})
      };
      emitDeviceTelemetry(deviceId, device.latestTelemetry, device);
    } else if (type === 'event' && payload.o) {
      if (!device.latestTelemetry) {
        device.latestTelemetry = { ts: Date.now(), o: {} };
      }
      device.latestTelemetry.o = payload.o || device.latestTelemetry.o;
      device.latestTelemetry.ts = payload.ts || Date.now();
      emitDeviceTelemetry(deviceId, device.latestTelemetry, device);
    } else {
      logger.error(`No sensor data found in ${type} log, keeping existing telemetry`);
    }
    
    if (shouldPersist) {
      await swallowError('Device save', () => device.save());
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
      topics: ['iot.telemetry.logs', 'iot.events.logs'],
      fromBeginning: false 
    });

    const withTimeout = async (promise, ms, label) => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} after ${ms}ms`)), ms));
      return Promise.race([promise, timeout]);
    };

    const messageTimeoutMs = Number(process.env.KAFKA_MESSAGE_TIMEOUT_MS || 4000);

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        const processMessage = async () => {
          try {
            let logData;
            try {
              logData = JSON.parse(message.value.toString());
            } catch (parseErr) {
              logger.error(`Invalid JSON message, skipping: ${parseErr.message}`);
              return;
            }

            try {
              const date = new Date().toISOString().slice(0, 10);
              await swallowError('MessageCount topic increment', () =>
                MessageCount.increment({ kind: 'topic', topic, date })
              );
              if (logData.deviceId) {
                await swallowError('MessageCount device increment', () =>
                  MessageCount.increment({ kind: 'device', deviceId: logData.deviceId, date })
                );
              }

              try {
                const topicKey = [ 'topic', topic, date ].join('|');
                const topicDoc = await swallowError('MessageCount topic read', () =>
                  MessageCount.findOne({ key: topicKey }).lean()
                );
                if (logData.deviceId) {
                  const deviceKey = [ 'device', logData.deviceId, date ].join('|');
                  await swallowError('MessageCount device read', () =>
                    MessageCount.findOne({ key: deviceKey }).lean()
                  );
                }
              } catch (readErr) {
                logger.warn(`Could not read message counters after increment: ${readErr.message}`);
              }
            } catch (incErr) {
              logger.error(`Failed to increment message counters: ${incErr.message}`);
            }

            const shouldSaveLog = async (logData) => {
              if (logData.type === 'event' && logData.payload?.ack === true) {
                return true;
              }
              
              if (logData.type !== 'telemetry') {
                return true;
              }
              
              const lastLog = await swallowError('Fetch last telemetry log', () =>
                DeviceLog.findOne({
                  deviceId: logData.deviceId,
                  type: 'telemetry'
                }).sort({ createdAt: -1 }).lean()
              );
              
              if (!lastLog) {
                return true;
              }
              
              const payload = logData.payload || {};
              const lastPayload = lastLog.payload || {};
              
              const currentTime = payload.ts || Date.now();
              const lastTime = lastPayload.ts || lastLog.createdAt?.getTime() || Date.now();
              const timeDiffSeconds = Math.abs(currentTime - lastTime) / 1000;
              
              if (timeDiffSeconds >= 180) {
                return true;
              }
              
              const tempDiff = Math.abs((payload.temp || 0) - (lastPayload.temp || 0));
              const humidDiff = Math.abs((payload.humid || 0) - (lastPayload.humid || 0));
              const gasDiff = Math.abs((payload.gas_ppm || 0) - (lastPayload.gas_ppm || 0));
              const lastSmoke = lastPayload.smoke !== undefined && lastPayload.smoke !== null ? lastPayload.smoke : 0;
              const currentSmoke = hasValue(payload.smoke) ? payload.smoke : lastSmoke;
              const smokeDiff = Math.abs(currentSmoke - lastSmoke);
              const prevFlame = lastPayload.flame !== undefined ? lastPayload.flame : false;
              const flameChanged = hasValue(payload.flame) ? payload.flame !== prevFlame : false;
              
              const outletChanged = payload.o && lastPayload.o && (
                (payload.o.o1 !== lastPayload.o.o1) ||
                (payload.o.o2 !== lastPayload.o.o2) ||
                (payload.o.o3 !== lastPayload.o.o3) ||
                (payload.o.o4 !== lastPayload.o.o4)
              );
              
              if (tempDiff >= 0.5 || humidDiff >= 3 || gasDiff >= 50 || smokeDiff >= 0.05 || flameChanged || outletChanged) {
                return true;
              }
              
              return false;
            };

            let savedLog = null;
            try {
              const save = await shouldSaveLog(logData);
              if (save) {
                let logToSave = logData;
                if (logData.type === 'event' && logData.payload?.ack === true) {
                  const ackOutlets = logData.payload.o || logData.metadata?.ackData?.o || {};
                  
                  logToSave = {
                    ...logData,
                    payload: {
                      ts: logData.payload.ts || Date.now(),
                      temp: 0,
                      humid: 0,
                      smoke: 0,
                      gas_ppm: 0,
                      flame: false,
                      o: {
                            o1: ackOutlets.o1 ?? false,
                            o2: ackOutlets.o2 ?? false,
                            o3: ackOutlets.o3 ?? false,
                            o4: ackOutlets.o4 ?? false
                          }
                    },
                    metadata: {
                      ...logData.metadata
                    }
                  };
                }
                
                if (logToSave.payload) {
                  logToSave.payload.temp = logToSave.payload.temp ?? 0;
                  logToSave.payload.humid = logToSave.payload.humid ?? 0;
                  logToSave.payload.smoke = logToSave.payload.smoke ?? 0;
                  logToSave.payload.gas_ppm = logToSave.payload.gas_ppm ?? 0;
                  logToSave.payload.flame = logToSave.payload.flame ?? false;
                }
                
                const deviceLog = new DeviceLog(logToSave);
                await withTimeout(
                  swallowError('Saving device log', () => deviceLog.save()),
                  2000,
                  'saving device log'
                );
                savedLog = deviceLog;
              }
            } catch (saveError) {
              logger.error(`Error saving device log (skipped): ${saveError.message}`);
            }
            
            if ((logData.type === 'telemetry' || (logData.type === 'event' && !logData.payload?.ack)) && logData.deviceId) {
              try {
                await withTimeout(updateDeviceStatus(logData), 1500, 'updating device status');
              } catch (updErr) {
                logger.error(`Update device status failed (skipped): ${updErr.message}`);
              }
            }
            
            if (savedLog) {
              try {
                await swallowError('Mark log processed', async () => {
                  savedLog.markAsProcessed();
                  await withTimeout(savedLog.save(), 1500, 'mark processed');
                });
              } catch (markErr) {
                logger.error(`Mark processed failed (skipped): ${markErr.message}`);
              }
            }

          } catch (error) {
            logger.error(`Error processing message from ${topic}: ${error.message}`);
          }
        };

        try {
          await withTimeout(processMessage(), messageTimeoutMs, 'processing kafka message');
        } catch (timeoutErr) {
          logger.error(`Log processing timed out, message skipped: ${timeoutErr.message}`);
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
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer:', error.message);
  }
}

export { startLogConsumer, stopLogConsumer };
