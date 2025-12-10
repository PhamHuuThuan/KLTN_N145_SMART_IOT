import express from 'express';
import {
  getAllRulesAdmin,
  getRuleByIdAdmin,
  createRuleAdmin,
  updateRuleAdmin,
  deleteRuleAdmin,
  getRulesStatsAdmin
} from '../controllers/adminRuleController.js';
import { validateRuleUpdate } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Admin rule management routes
router.get('/all', getAllRulesAdmin);
router.get('/stats', getRulesStatsAdmin);
router.get('/:ruleId', getRuleByIdAdmin);
router.post('/', createRuleAdmin);
router.patch('/:ruleId', validateRuleUpdate, updateRuleAdmin);
router.delete('/:ruleId', deleteRuleAdmin);

export default router;
