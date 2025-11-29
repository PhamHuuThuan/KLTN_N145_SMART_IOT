import express from 'express';
import {
  getTemplates,
  getTemplateByKey
} from '../controllers/templateController.js';

const router = express.Router();

// Public template routes (no authentication required for mobile app)
router.get('/', getTemplates);
router.get('/:templateKey', getTemplateByKey);

export default router;
