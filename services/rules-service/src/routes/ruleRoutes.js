import express from 'express';
import {
  getAllRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRuleStatus,
  getRuleTemplates,
} from '../controllers/ruleController.js';
import { validateRuleUpdate, validateRuleStatus } from '../middleware/validation.js';

const router = express.Router();

// Rule CRUD operations
router.get('/', getAllRules);
router.get('/templates', getRuleTemplates);
router.post('/', createRule);
router.patch('/:ruleId', validateRuleUpdate, updateRule);
router.patch('/:ruleId/status', validateRuleStatus, toggleRuleStatus);
router.delete('/:ruleId', deleteRule);

export default router;
