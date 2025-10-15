import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import ruleRoutes from './routes/ruleRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import RuleConsumer from './consumers/RuleConsumer.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('rules-service');

dotenv.config();

function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/rules', ruleRoutes);
  app.get('/', (_req, res) => res.json({ service: 'rules-service' }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function bootstrap() {
  try {
    await connectDB();
    logger.info('MongoDB connected to Rules Service');

    const ruleConsumer = new RuleConsumer();
    await ruleConsumer.start();

    const app = createServer();
    const port = process.env.PORT || 3003;

    const server = app.listen(port, () => {
      logger.info(`Rules Service listening on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Rules API: http://localhost:${port}/api/rules`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      try {
        await ruleConsumer.stop();
        
        server.close(() => {
          logger.info('HTTP server closed');
        });
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
    });
  } catch (error) {
    process.exit(1);
  }
}

bootstrap();
