import express from 'express';
import {
  createDeviceLog,
  getDeviceLogs,
  getLatestTelemetry,
  getTelemetryHistory,
  processUnprocessedLogs,
  getEmergencyLogs,
  deleteOldLogs
} from '../controllers/deviceLogController.js';

const router = express.Router();

// Telemetry and log routes
router.post('/', createDeviceLog);
router.get('/', getDeviceLogs);
router.get('/emergency', getEmergencyLogs);
router.get('/:deviceId/latest', getLatestTelemetry);
router.get('/:deviceId/history', getTelemetryHistory);

// Background processing routes
router.post('/process', processUnprocessedLogs);
router.delete('/cleanup', deleteOldLogs);

export default router;
