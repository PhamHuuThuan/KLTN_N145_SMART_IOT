import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import connectDB from './config/database.js';
import ruleRoutes from './routes/ruleRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

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
    console.log('📦 MongoDB connected to Rules Service');

    const app = createServer();
    const port = process.env.PORT || 3003;

    const server = app.listen(port, () => {
      console.log(`🚀 Rules Service listening on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📋 Rules API: http://localhost:${port}/api/rules`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down gracefully`);
      try {
        server.close(() => {
          console.log('✅ HTTP server closed');
        });
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', () => process.exit(1));
    process.on('uncaughtException', () => process.exit(1));
  } catch (error) {
    process.exit(1);
  }
}

bootstrap();
