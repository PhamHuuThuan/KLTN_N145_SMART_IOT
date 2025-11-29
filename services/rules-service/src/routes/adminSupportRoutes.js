import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  getAdminConversations,
  getConversationMessagesAdmin,
  postAdminMessage,
  assignConversation,
  updateConversationStatus,
  markConversationReadAdmin,
  deleteConversationAdmin
} from '../controllers/supportController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/conversations', getAdminConversations);
router.get('/conversations/:conversationId/messages', getConversationMessagesAdmin);
router.post('/conversations/:conversationId/messages', postAdminMessage);
router.patch('/conversations/:conversationId/assign', assignConversation);
router.patch('/conversations/:conversationId/status', updateConversationStatus);
router.patch('/conversations/:conversationId/read', markConversationReadAdmin);
router.delete('/conversations/:conversationId', deleteConversationAdmin);

export default router;
