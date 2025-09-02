import app from './app.js';
import connectDB from './config/database.js';
import { producer, consumer } from './config/kafka.js';
import { startLogConsumer, stopLogConsumer } from './consumers/logConsumer.js';

const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Start Kafka producer and consumers
const startKafka = async () => {
  try {
    await producer.connect();
    console.log('✅ Kafka producer connected');
    
    // Start log consumer for telemetry and events
    await startLogConsumer();
    
    // Connect consumer for emergency events
    await consumer.connect();
    await consumer.subscribe({ topic: 'device.emergency', fromBeginning: false });
    
    // Handle emergency events
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          console.log('🚨 Emergency event received:', data);
          
          // Here you can add additional emergency handling logic
          // For example, sending notifications, activating alarms, etc.
          
        } catch (error) {
          console.error('❌ Error processing emergency message:', error);
        }
      }
    });
    
    console.log('✅ Kafka consumers started');
  } catch (error) {
    console.error('❌ Error connecting to Kafka:', error);
  }
};

// Start the server
const startServer = async () => {
  try {
    // Start Kafka
    await startKafka();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Devices Service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 API endpoints: http://localhost:${PORT}/api/`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  try {
    await stopLogConsumer();
    await producer.disconnect();
    await consumer.disconnect();
    console.log('✅ Kafka connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  try {
    await stopLogConsumer();
    await producer.disconnect();
    await consumer.disconnect();
    console.log('✅ Kafka connections closed');
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
