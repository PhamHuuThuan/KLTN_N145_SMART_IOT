import app from './app.js';
import connectDB from './config/database.js';
import { producer, consumer } from './config/kafka.js';
import { startLogConsumer, stopLogConsumer } from './consumers/logConsumer.js';
import { startDeviceStatusConsumer } from './consumers/deviceStatusConsumer.js';
import Device from './models/Device.js';

const PORT = process.env.PORT || 3001;
const OFFLINE_THRESHOLD_MS = Number(process.env.DEVICE_OFFLINE_THRESHOLD_MS || 5 * 60 * 1000); // 5 minutes default
const WATCHDOG_INTERVAL_MS = Number(process.env.DEVICE_WATCHDOG_INTERVAL_MS || 60 * 1000); // run every 1 minute

let watchdogTimer = null;

// Connect to MongoDB
connectDB();

// Start Kafka producer and consumers
const startKafka = async () => {
  try {
    await producer.connect();
    console.log('✅ Kafka producer connected');
    
    // Start log consumer for telemetry and events
    await startLogConsumer();
    
    // Start device status consumer for real-time updates
    await startDeviceStatusConsumer();
    
    // Connect consumer for emergency events
    await consumer.connect();
    await consumer.subscribe({ topic: 'device.emergency', fromBeginning: false });
    
    // Handle emergency events
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          // Emergency event handling - add notifications/alarms here
          
        } catch (error) {
          console.error('❌ Error processing emergency message:', error);
        }
      }
    });
    
    // Kafka consumers started
  } catch (error) {
    console.error('❌ Error connecting to Kafka:', error);
  }
};

// Periodically mark devices offline if not seen recently
async function startDeviceWatchdog() {
  async function runOnce() {
    try {
      const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
      const result = await Device.updateMany(
        { lastSeenAt: { $lte: cutoff }, status: { $ne: 'offline' } },
        { $set: { status: 'offline' } }
      );
      if (result.modifiedCount) {
        console.log(`🕒 Watchdog: Marked ${result.modifiedCount} device(s) offline (cutoff ${cutoff.toISOString()})`);
      }
    } catch (err) {
      console.error('❌ Watchdog error:', err.message);
    }
  }

  await runOnce();
  watchdogTimer = setInterval(runOnce, WATCHDOG_INTERVAL_MS);
}

// Start the server
const startServer = async () => {
  try {
    // Start Kafka
    await startKafka();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Devices Service running on port ${PORT}`);
    });

    // Start offline/online watchdog
    await startDeviceWatchdog();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  // SIGTERM received, shutting down gracefully
  
  try {
    await stopLogConsumer();
    await producer.disconnect();
    await consumer.disconnect();
    if (watchdogTimer) clearInterval(watchdogTimer);
    // Kafka connections closed
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  // SIGINT received, shutting down gracefully
  
  try {
    await stopLogConsumer();
    await producer.disconnect();
    await consumer.disconnect();
    if (watchdogTimer) clearInterval(watchdogTimer);
    // Kafka connections closed
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Start the server
startServer();
