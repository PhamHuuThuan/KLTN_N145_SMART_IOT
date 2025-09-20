import express from 'express';
import NotificationController from '../controllers/NotificationController.js';
import { validateNotification, validatePreferences } from '../middleware/validation.js';
import { authenticateToken, checkResourceAccess } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const notificationController = new NotificationController();

// Apply rate limiting to all routes
router.use(rateLimiter);

// Send notification
router.post('/send', 
  authenticateToken,
  validateNotification,
  (req, res) => notificationController.sendNotification(req, res)
);

// Send bulk notifications
router.post('/send/bulk',
  authenticateToken,
  (req, res) => notificationController.sendBulkNotifications(req, res)
);

// Get user notifications
router.get('/user/:userId',
  authenticateToken,
  (req, res) => notificationController.getUserNotifications(req, res)
);

// Mark notification as read
router.patch('/:notificationId/read/:userId',
  authenticateToken,
  (req, res) => notificationController.markAsRead(req, res)
);

// Mark all notifications as read
router.patch('/user/:userId/read-all',
  authenticateToken,
  (req, res) => notificationController.markAllAsRead(req, res)
);

// Delete notification
router.delete('/:notificationId/user/:userId',
  authenticateToken,
  (req, res) => notificationController.deleteNotification(req, res)
);

// Get notification statistics
router.get('/user/:userId/stats',
  authenticateToken,
  (req, res) => notificationController.getNotificationStats(req, res)
);

// Get user preferences
router.get('/user/:userId/preferences',
  authenticateToken,
  (req, res) => notificationController.getUserPreferences(req, res)
);

// Update user preferences
router.put('/user/:userId/preferences',
  authenticateToken,
  validatePreferences,
  (req, res) => notificationController.updateUserPreferences(req, res)
);

// Add FCM token
router.post('/user/:userId/fcm-token',
  authenticateToken,
  checkResourceAccess('userId'),
  (req, res) => notificationController.addFCMToken(req, res)
);

// Remove FCM token
router.delete('/user/:userId/fcm-token',
  authenticateToken,
  (req, res) => notificationController.removeFCMToken(req, res)
);

// Test notification
router.post('/user/:userId/test',
  authenticateToken,
  (req, res) => notificationController.testNotification(req, res)
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alerts service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
