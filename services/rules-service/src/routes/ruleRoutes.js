import express from 'express';
import {
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
  getRuleTemplates,
  getRulesByDevice,
  getRulesByOwner,
  getRuleById,
  createBulkRules,
  simulateSensorData,
  getRuleStats,
  testRuleEvaluation
} from '../controllers/ruleController.js';
import { validateRule, validateRuleUpdate, validateRuleStatus } from '../middleware/validation.js';

const router = express.Router();

// Rule CRUD operations
router.get('/', getAllRules);
router.get('/templates', getRuleTemplates);
router.post('/', createRule);
router.patch('/:ruleId', validateRuleUpdate, updateRule);
router.patch('/:ruleId/status', validateRuleStatus, toggleRuleStatus);
router.delete('/:ruleId', deleteRule);
router.get('/stats/:ownerId', getRuleStats);
router.get('/device/:deviceId', getRulesByDevice);
router.get('/owner/:ownerId', getRulesByOwner);
router.get('/:ruleId', getRuleById);
router.post('/bulk', createBulkRules);
router.post('/simulate', simulateSensorData);
router.post('/test', testRuleEvaluation);

export default router;
