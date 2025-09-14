import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_iot';
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    };

    await mongoose.connect(mongoUri, options);
    
    logger.info('MongoDB connected successfully', {
      uri: mongoUri.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    });

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        logger.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDatabase;
