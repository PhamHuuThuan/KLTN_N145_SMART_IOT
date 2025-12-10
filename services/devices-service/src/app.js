import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import deviceRoutes from './routes/deviceRoutes.js';
import deviceLogRoutes from './routes/deviceLogRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/devices', deviceRoutes);
app.use('/api/logs', deviceLogRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart IoT Kitchen Devices Service',
    version: '1.0.0',
    endpoints: {
      devices: '/api/devices',
      logs: '/api/logs',
      health: '/health'
    }
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
