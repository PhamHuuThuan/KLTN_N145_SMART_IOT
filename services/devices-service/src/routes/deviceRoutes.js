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
  removeDeviceOwnership
} from '../controllers/deviceController.js';
import { authenticateToken, checkDeviceOwnership } from '../middleware/auth.js';

const router = express.Router();

// Device management routes
router.get('/', authenticateToken, getAllDevices);
router.get('/status', authenticateToken, getAllDevices); 
router.get('/:deviceId', authenticateToken, checkDeviceOwnership, getDeviceById);
router.post('/', authenticateToken, createDevice);
router.put('/:deviceId', authenticateToken, checkDeviceOwnership, updateDevice);
router.delete('/:deviceId', authenticateToken, checkDeviceOwnership, deleteDevice);

// Device control routes 
router.get('/:deviceId/status', authenticateToken, checkDeviceOwnership, getDeviceStatus);
router.put('/:deviceId/outlets/:outletId/toggle', authenticateToken, checkDeviceOwnership, toggleOutlet);
router.put('/:deviceId/outlets/:outletId', authenticateToken, checkDeviceOwnership, updateOutletSettings);
router.put('/:deviceId/emergency/enter', authenticateToken, checkDeviceOwnership, enterEmergencyMode);
router.put('/:deviceId/emergency/exit', authenticateToken, checkDeviceOwnership, exitEmergencyMode);

// Device ownership management
router.delete('/:deviceId/ownership', authenticateToken, removeDeviceOwnership);

export default router;
