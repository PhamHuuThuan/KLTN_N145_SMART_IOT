import NotificationService from '../services/NotificationService.js';
import UserNotificationPreferences from '../models/UserNotificationPreferences.js';
import logger from '../utils/logger.js';

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Send notification
   */
  async sendNotification(req, res) {
    try {
      const notificationData = req.body;
      
      // Validate required fields
      if (!notificationData.userId || !notificationData.title || !notificationData.message) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, title, message'
        });
      }

      const notification = await this.notificationService.sendNotification(notificationData);
      
      res.status(201).json({
        success: true,
        message: 'Notification sent successfully',
        data: notification
      });
    } catch (error) {
      logger.error('Error in sendNotification controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(req, res) {
    try {
      const { notifications } = req.body;
      
      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Notifications array is required and cannot be empty'
        });
      }

      const results = await this.notificationService.sendBulkNotifications(notifications);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      res.status(200).json({
        success: true,
        message: `Bulk notifications processed: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results
        }
      });
    } catch (error) {
      logger.error('Error in sendBulkNotifications controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(req, res) {
    try {
      const { userId } = req.params;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        type: req.query.type,
        category: req.query.category,
        priority: req.query.priority,
        isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };

      const result = await this.notificationService.getUserNotifications(userId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getUserNotifications controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req, res) {
    try {
      const { notificationId, userId } = req.params;
      
      const notification = await this.notificationService.markAsRead(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      logger.error('Error in markAsRead controller:', error);
      if (error.message === 'Notification not found') {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req, res) {
    try {
      const { userId } = req.params;
      
      const result = await this.notificationService.markAllAsRead(userId);
      
      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} notifications marked as read`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error('Error in markAllAsRead controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req, res) {
    try {
      const { notificationId, userId } = req.params;
      
      const notification = await this.notificationService.deleteNotification(notificationId, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
        data: notification
      });
    } catch (error) {
      logger.error('Error in deleteNotification controller:', error);
      if (error.message === 'Notification not found') {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await this.notificationService.getNotificationStats(userId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in getNotificationStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      
      const preferences = await UserNotificationPreferences.getUserPreferences(userId);
      
      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'User preferences not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Error in getUserPreferences controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      const preferences = await UserNotificationPreferences.findOneAndUpdate(
        { userId },
        { $set: updates },
        { new: true, upsert: true }
      );
      
      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
      });
    } catch (error) {
      logger.error('Error in updateUserPreferences controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Add FCM token
   */
  async addFCMToken(req, res) {
    try {
      const { userId } = req.params;
      const { token, platform } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Token and platform are required'
        });
      }
      
      const preferences = await UserNotificationPreferences.findOne({ userId });
      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'User preferences not found'
        });
      }
      
      await preferences.addFCMToken(token, platform);
      
      res.status(200).json({
        success: true,
        message: 'FCM token added successfully'
      });
    } catch (error) {
      logger.error('Error in addFCMToken controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Remove FCM token
   */
  async removeFCMToken(req, res) {
    try {
      const { userId } = req.params;
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token is required'
        });
      }
      
      const preferences = await UserNotificationPreferences.findOne({ userId });
      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'User preferences not found'
        });
      }
      
      await preferences.removeFCMToken(token);
      
      res.status(200).json({
        success: true,
        message: 'FCM token removed successfully'
      });
    } catch (error) {
      logger.error('Error in removeFCMToken controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Test notification
   */
  async testNotification(req, res) {
    try {
      const { userId } = req.params;
      const { methods = ['inApp'] } = req.body;
      
      const testNotification = {
        userId,
        title: 'Test Notification',
        message: 'This is a test notification from Smart IoT Kitchen',
        type: 'system_notification',
        category: 'system',
        priority: 'medium',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };
      
      const notification = await this.notificationService.sendNotification(testNotification);
      
      res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        data: notification
      });
    } catch (error) {
      logger.error('Error in testNotification controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

export default NotificationController;
