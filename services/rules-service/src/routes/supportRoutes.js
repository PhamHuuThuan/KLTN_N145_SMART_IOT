import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createOrGetConversation,
  getConversationMessages,
  postUserMessage,
  markConversationRead
} from '../controllers/supportController.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/conversations', createOrGetConversation);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/messages', postUserMessage);
router.patch('/conversations/:conversationId/read', markConversationRead);

export default router;
