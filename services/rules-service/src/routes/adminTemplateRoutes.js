import express from 'express';
import {
  getAllTemplatesAdmin,
  getTemplateByIdAdmin,
  createTemplateAdmin,
  updateTemplateAdmin,
  deleteTemplateAdmin,
} from '../controllers/adminTemplateController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Admin template management routes
router.get('/all', getAllTemplatesAdmin);
router.get('/:templateKey', getTemplateByIdAdmin);
router.post('/', createTemplateAdmin);
router.patch('/:templateKey', updateTemplateAdmin);
router.delete('/:templateKey', deleteTemplateAdmin);

export default router;
