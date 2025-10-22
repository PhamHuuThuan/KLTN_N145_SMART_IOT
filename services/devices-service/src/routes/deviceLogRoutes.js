import express from 'express';
import {
  createDeviceLog,
  getDeviceLogs,
  getLatestTelemetry,
  getTelemetryHistory,
  deleteOldLogs
} from '../controllers/deviceLogController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Telemetry and log routes
router.post('/', createDeviceLog);
router.get('/', optionalAuth, getDeviceLogs);
router.get('/:deviceId/latest', optionalAuth, getLatestTelemetry);
router.get('/:deviceId/history', optionalAuth, getTelemetryHistory);

// Background processing routes
router.delete('/cleanup', authenticateToken, deleteOldLogs);

export default router;
