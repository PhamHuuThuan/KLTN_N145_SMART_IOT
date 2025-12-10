import app from './app.js';
import http from 'http';
import { setupSocket } from './realtime/socket.js';
import { emitDeviceTelemetry } from './realtime/socket.js';
import connectDB from './config/database.js';
import { producer } from './config/kafka.js';
import { startLogConsumer, stopLogConsumer } from './consumers/logConsumer.js';
import { startDeviceStatusConsumer } from './consumers/deviceStatusConsumer.js';
import Device from './models/Device.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3001;
const OFFLINE_THRESHOLD_MS = Number(process.env.DEVICE_OFFLINE_THRESHOLD_MS || 5 * 60 * 1000);
const WATCHDOG_INTERVAL_MS = Number(process.env.DEVICE_WATCHDOG_INTERVAL_MS || 60 * 1000);
const EMERGENCY_AUTO_DISABLE_MS = Number(process.env.EMERGENCY_AUTO_DISABLE_MS || 60 * 60 * 1000);

let watchdogTimer = null;
let emergencyWatchdogTimer = null;

connectDB();

const startKafka = async () => {
  try {
    await producer.connect();
    await startLogConsumer();
    await startDeviceStatusConsumer();
  } catch (error) {
    logger.error('Error connecting to Kafka:', error);
  }
};

async function startDeviceWatchdog() {
  async function runOnce() {
    try {
      const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
      await Device.updateMany(
        { lastSeenAt: { $lte: cutoff }, status: { $ne: 'offline' } },
        { $set: { status: 'offline' } }
      );
    } catch (err) {
      logger.error('Watchdog error:', err.message);
    }
  }

  await runOnce();
  watchdogTimer = setInterval(runOnce, WATCHDOG_INTERVAL_MS);
}

async function startEmergencyWatchdog() {
  async function runOnce() {
    try {
      const cutoff = new Date(Date.now() - EMERGENCY_AUTO_DISABLE_MS);
      const devices = await Device.find({
        emergencyMode: true,
        lastEmergencyAt: { $lte: cutoff }
      });

      for (const device of devices) {
        device.exitEmergencyMode();
        await device.save();
        
        producer.send({
          topic: 'user-actions',
          messages: [{
            key: device.deviceId,
            value: JSON.stringify({
              userId: device.ownerId,
              deviceId: device.deviceId,
              deviceName: device.name,
              action: 'emergency_mode_auto_disabled',
              result: 'success',
              timestamp: new Date()
            })
          }]
        }).catch((kafkaError) => {
          logger.error('Failed to publish emergency auto-disable event to Kafka:', kafkaError);
        });

        try {
          if (device.latestTelemetry) {
            emitDeviceTelemetry(device.deviceId, device.latestTelemetry, device);
          }
        } catch (error) {
          logger.error('Failed to emit device telemetry with emergency mode in watchdog:', error);
        }
      }
    } catch (err) {
      logger.error('Emergency watchdog error:', err.message);
    }
  }

  await runOnce();
  emergencyWatchdogTimer = setInterval(runOnce, WATCHDOG_INTERVAL_MS);
}

const startServer = async () => {
  try {
    await startKafka();
    
    const server = http.createServer(app);
    setupSocket(server);
    server.listen(PORT, () => {
      logger.info(`Devices Service running on port ${PORT}`);
    });

    await startDeviceWatchdog();
    await startEmergencyWatchdog();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  try {
    await stopLogConsumer();
    await producer.disconnect();
    if (watchdogTimer) clearInterval(watchdogTimer);
    if (emergencyWatchdogTimer) clearInterval(emergencyWatchdogTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  try {
    await stopLogConsumer();
    await producer.disconnect();
    if (watchdogTimer) clearInterval(watchdogTimer);
    if (emergencyWatchdogTimer) clearInterval(emergencyWatchdogTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

startServer();
