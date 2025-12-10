import express from 'express';
import NotificationController from '../controllers/NotificationController.js';
import { validateNotification, validatePreferences } from '../middleware/validation.js';
import { authenticateToken, checkResourceAccess } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const notificationController = new NotificationController();

router.use(rateLimiter);

router.post('/send', 
  authenticateToken,
  validateNotification,
  (req, res) => notificationController.sendNotification(req, res)
);

router.post('/send/bulk',
  authenticateToken,
  (req, res) => notificationController.sendBulkNotifications(req, res)
);

router.get('/user/:userId',
  authenticateToken,
  (req, res) => notificationController.getUserNotifications(req, res)
);

router.patch('/:notificationId/read/:userId',
  authenticateToken,
  (req, res) => notificationController.markAsRead(req, res)
);

router.patch('/user/:userId/read-all',
  authenticateToken,
  (req, res) => notificationController.markAllAsRead(req, res)
);

router.delete('/:notificationId/user/:userId',
  authenticateToken,
  (req, res) => notificationController.deleteNotification(req, res)
);

router.get('/user/:userId/stats',
  authenticateToken,
  (req, res) => notificationController.getNotificationStats(req, res)
);

router.get('/user/:userId/preferences',
  authenticateToken,
  (req, res) => notificationController.getUserPreferences(req, res)
);

router.put('/user/:userId/preferences',
  authenticateToken,
  validatePreferences,
  (req, res) => notificationController.updateUserPreferences(req, res)
);

router.post('/user/:userId/fcm-token',
  authenticateToken,
  checkResourceAccess('userId'),
  (req, res) => notificationController.addFCMToken(req, res)
);

router.delete('/user/:userId/fcm-token',
  authenticateToken,
  (req, res) => notificationController.removeFCMToken(req, res)
);

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Alerts service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
