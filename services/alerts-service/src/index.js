process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDatabase from './config/database.js';
import { connectKafka, consumeMessages, TOPICS } from './config/kafka.js';
import notificationRoutes from './routes/notificationRoutes.js';
import NotificationConsumer from './consumers/NotificationConsumer.js';
import logger from './utils/logger.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alerts service is healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/notifications', notificationRoutes);

io.on('connection', (socket) => {
  socket.on('authenticate', (data) => {
    if (data.userId) {
      socket.userId = data.userId;
      socket.join(`user_${data.userId}`);
    }
  });
});

global.io = io;

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

const initializeServices = async () => {
  try {
    await connectDatabase();
    const kafkaConnected = await connectKafka();
    
    if (kafkaConnected) {
      const notificationConsumer = new NotificationConsumer();
      const messageHandlers = {
        [TOPICS.DEVICE_ALERTS]: (topic, message) => notificationConsumer.handleDeviceAlert(topic, message),
        [TOPICS.NOTIFICATION_REQUESTS]: (topic, message) => notificationConsumer.handleNotificationRequest(topic, message),
        [TOPICS.USER_ACTIONS]: (topic, message) => notificationConsumer.handleUserAction(topic, message)
      };
      
      await consumeMessages((topic, message) => {
        const handler = messageHandlers[topic];
        if (handler) {
          try {
            handler(topic, message);
          } catch (error) {
            logger.error('Error in message handler:', {
              topic,
              error: error.message,
              stack: error.stack,
              message: message
            });
          }
        } else {
          logger.warn('No handler found for topic', { topic });
        }
      });
    }
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    await initializeServices();
    
    server.listen(PORT, () => {
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

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
