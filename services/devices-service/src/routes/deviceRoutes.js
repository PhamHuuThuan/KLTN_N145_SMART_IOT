import express from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  toggleOutlet,
  updateOutletSettings,
  enterEmergencyMode,
  exitEmergencyMode,
  getDeviceStatus,
  updateThresholds
} from '../controllers/deviceController.js';

const router = express.Router();

// Device management routes
router.get('/', getAllDevices);
router.get('/status', getAllDevices); // General status endpoint
router.get('/:deviceId', getDeviceById);
router.post('/', createDevice);
router.put('/:deviceId', updateDevice);
router.delete('/:deviceId', deleteDevice);

// Device control routes
router.get('/:deviceId/status', getDeviceStatus);
router.put('/:deviceId/outlets/:outletId/toggle', toggleOutlet);
router.put('/:deviceId/outlets/:outletId', updateOutletSettings);
router.put('/:deviceId/emergency/enter', enterEmergencyMode);
router.put('/:deviceId/emergency/exit', exitEmergencyMode);
router.put('/:deviceId/thresholds', updateThresholds);

export default router;
