// Suppress KafkaJS partitioner warning before any imports
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import connectDatabase from './config/database.js';
import { connectKafka, consumeMessages, TOPICS } from './config/kafka.js';
import notificationRoutes from './routes/notificationRoutes.js';
import NotificationConsumer from './consumers/NotificationConsumer.js';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(helmet());

app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alerts service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Try to connect to Kafka
    const kafkaConnected = await connectKafka();
    
    if (kafkaConnected) {
      // Initialize notification consumer
      const notificationConsumer = new NotificationConsumer();
      
      // Set up message handlers
      const messageHandlers = {
        [TOPICS.DEVICE_ALERTS]: (topic, message) => notificationConsumer.handleDeviceAlert(topic, message),
        [TOPICS.NOTIFICATION_REQUESTS]: (topic, message) => notificationConsumer.handleNotificationRequest(topic, message),
        [TOPICS.USER_ACTIONS]: (topic, message) => notificationConsumer.handleUserAction(topic, message),
        [TOPICS.SYSTEM_EVENTS]: (topic, message) => notificationConsumer.handleSystemEvent(topic, message),
        [TOPICS.OUTLET_TOGGLED]: (topic, message) => notificationConsumer.handleUserAction(topic, message)  // Thêm dòng này
      };
      
      // Start consuming messages
      await consumeMessages((topic, message) => {
        const handler = messageHandlers[topic];
        if (handler) {
          handler(topic, message);
        } else {
          logger.warn('No handler found for topic', { topic });
        }
      });
      
      logger.info('🚀 All services initialized successfully with Kafka');
    } else {
      logger.info('🚀 Core services initialized successfully (Kafka disabled)');
    }
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
    logger.info('🎉 Alerts service started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
startServer();
