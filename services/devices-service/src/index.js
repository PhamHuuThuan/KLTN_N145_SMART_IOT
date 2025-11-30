import app from './app.js';
import http from 'http';
import { setupSocket } from './realtime/socket.js';
import connectDB from './config/database.js';
import { producer } from './config/kafka.js';
import { startLogConsumer, stopLogConsumer } from './consumers/logConsumer.js';
import { startDeviceStatusConsumer } from './consumers/deviceStatusConsumer.js';
import Device from './models/Device.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3001;
const OFFLINE_THRESHOLD_MS = Number(process.env.DEVICE_OFFLINE_THRESHOLD_MS || 5 * 60 * 1000);
const WATCHDOG_INTERVAL_MS = Number(process.env.DEVICE_WATCHDOG_INTERVAL_MS || 60 * 1000);

let watchdogTimer = null;

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

const startServer = async () => {
  try {
    await startKafka();
    
    const server = http.createServer(app);
    setupSocket(server);
    server.listen(PORT, () => {
      logger.info(`Devices Service running on port ${PORT}`);
    });

    await startDeviceWatchdog();
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
