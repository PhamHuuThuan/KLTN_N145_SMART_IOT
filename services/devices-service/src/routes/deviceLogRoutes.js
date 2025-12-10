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

router.get('/:deviceId/latest', optionalAuth, getLatestTelemetry);
router.get('/:deviceId/history', optionalAuth, getTelemetryHistory);
router.delete('/cleanup', authenticateToken, deleteOldLogs);
router.post('/', createDeviceLog);
router.get('/', optionalAuth, getDeviceLogs);

export default router;
