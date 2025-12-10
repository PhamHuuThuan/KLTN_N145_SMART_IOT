import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import authRoute from './routes/authRoutes.js';
import logger from './utils/logger.js';
import dotenv from "dotenv";

dotenv.config();

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ 
    ok: true, 
    message: 'Auth Service is running',
    timestamp: new Date().toISOString()
  }));

  app.use('/auth', authRoute);

  app.get('/', (_req, res) => res.json({
    message: 'Smart IoT Kitchen Authentication Service',
    version: '1.0.0',
    endpoints: {
      register: '/auth/register',
      login: '/auth/login',
      me: '/auth/me',
      health: '/health'
    }
  }));

  return app;
}

async function bootstrap() {
  await connectDB();
  logger.info('📦 MongoDB connected to Auth Service');
  
  const app = createServer();
  const port = process.env.PORT || 4001;
  
  app.listen(port, () => {
    logger.info(`🚀 Auth Service listening on port ${port}`);
    logger.info(`📊 Health check: http://localhost:${port}/health`);
    logger.info(`🔐 Register: http://localhost:${port}/auth/register`);
    logger.info(`🔑 Login: http://localhost:${port}/auth/login`);
  });
}

bootstrap().catch(logger.error);
