import express from 'express';
import {
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
  getRuleTemplates,
  respondToAlert
} from '../controllers/ruleController.js';
import { validateRuleUpdate, validateRuleStatus } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Rule CRUD operations
router.get('/', authenticateToken, getAllRules);
router.get('/templates', getRuleTemplates);
router.post('/', authenticateToken, createRule);
router.patch('/:ruleId', authenticateToken, validateRuleUpdate, updateRule);
router.patch('/:ruleId/status', authenticateToken, validateRuleStatus, toggleRuleStatus);
router.delete('/:ruleId', authenticateToken, deleteRule);
router.post('/:ruleId/respond', authenticateToken, respondToAlert);

export default router;
