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
  removeDeviceOwnership,
  toggleBuzzer,
  turnOnBuzzer,
  turnOffBuzzer,
  testBuzzer
} from '../controllers/deviceController.js';
import { authenticateToken, checkDeviceOwnership } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getAllDevices);
router.get('/status', authenticateToken, getAllDevices); 
router.get('/:deviceId', authenticateToken, checkDeviceOwnership, getDeviceById);
router.post('/', authenticateToken, createDevice);
router.put('/:deviceId', authenticateToken, checkDeviceOwnership, updateDevice);
router.delete('/:deviceId', authenticateToken, checkDeviceOwnership, deleteDevice);
router.get('/:deviceId/status', authenticateToken, checkDeviceOwnership, getDeviceStatus);
router.put('/:deviceId/outlets/:outletId/toggle', authenticateToken, checkDeviceOwnership, toggleOutlet);
router.put('/:deviceId/outlets/:outletId', authenticateToken, checkDeviceOwnership, updateOutletSettings);
router.put('/:deviceId/buzzer/toggle', authenticateToken, checkDeviceOwnership, toggleBuzzer);
router.put('/:deviceId/buzzer/on', authenticateToken, checkDeviceOwnership, turnOnBuzzer);
router.put('/:deviceId/buzzer/off', authenticateToken, checkDeviceOwnership, turnOffBuzzer);
router.put('/:deviceId/buzzer/test', authenticateToken, checkDeviceOwnership, testBuzzer);
router.put('/:deviceId/emergency/enter', authenticateToken, checkDeviceOwnership, enterEmergencyMode);
router.put('/:deviceId/emergency/exit', authenticateToken, checkDeviceOwnership, exitEmergencyMode);
router.delete('/:deviceId/ownership', authenticateToken, removeDeviceOwnership);

export default router;
