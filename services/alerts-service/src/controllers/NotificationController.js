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
      
      let preferences = await UserNotificationPreferences.getUserPreferences(userId);
      
      // Create default preferences if not found
      if (!preferences) {
        logger.info(`Creating default preferences for user ${userId}`);
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, address: '', verified: false },
          sms: { enabled: false, phoneNumber: '', verified: false },
          fcm: { enabled: true, tokens: [] },
          inApp: { enabled: true },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        });
        await preferences.save();
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
      
      logger.info(`FCM token request for user ${userId}:`, { token: token?.substring(0, 20) + '...', platform });
      logger.info('Request user from JWT:', req.user);
      
      if (!token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Token and platform are required'
        });
      }
      
      let preferences = await UserNotificationPreferences.findOne({ userId });
      
      // Create default preferences if not found
      if (!preferences) {
        logger.info(`Creating default preferences for user ${userId}`);
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, address: '', verified: false },
          sms: { enabled: false, phoneNumber: '', verified: false },
          fcm: { enabled: true, tokens: [] },
          inApp: { enabled: true },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        });
        await preferences.save();
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

  /**
   * Add FCM token for user
   */
  async addFCMToken(req, res) {
    try {
      const { userId } = req.params;
      const { token, platform } = req.body;
      
      logger.info(`🔧 FCM token request for user ${userId}:`, { token: token?.substring(0, 20) + '...', platform });
      logger.info('🔧 Request user from JWT:', req.user);
      logger.info('🔧 Request body:', req.body);

      if (!token || !platform) {
        logger.error('❌ Missing token or platform:', { token: !!token, platform });
        return res.status(400).json({
          success: false,
          message: 'Token and platform are required'
        });
      }

      // Get or create user preferences
      let preferences = await UserNotificationPreferences.findOne({ userId });
      logger.info(`🔧 Found preferences:`, !!preferences);
      
      // Create default preferences if not found
      if (!preferences) {
        logger.info(`🔧 Creating default preferences for user ${userId}`);
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, address: '', verified: false },
          sms: { enabled: false, phoneNumber: '', verified: false },
          fcm: { enabled: true, tokens: [] },
          inApp: { enabled: true },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        });
        await preferences.save();
        logger.info(`🔧 Created new preferences for user ${userId}`);
      } else {
        logger.info(`🔧 Current FCM tokens count: ${preferences.fcm.tokens.length}`);
      }

      // Check if token already exists
      const existingTokenIndex = preferences.fcm.tokens.findIndex(t => t.token === token);
      logger.info(`🔧 Token exists check: index ${existingTokenIndex}`);
      
      // Remove any Expo push tokens (they start with "ExponentPushToken[")
      const originalTokenCount = preferences.fcm.tokens.length;
      preferences.fcm.tokens = preferences.fcm.tokens.filter(t => !t.token.startsWith('ExponentPushToken['));
      const removedCount = originalTokenCount - preferences.fcm.tokens.length;
      if (removedCount > 0) {
        logger.info(`🔧 Removed ${removedCount} Expo push tokens for user ${userId}`);
      }
      
      if (existingTokenIndex >= 0) {
        // Update existing token
        preferences.fcm.tokens[existingTokenIndex] = {
          token,
          platform,
          lastUsed: new Date()
        };
        logger.info(`🔧 Updated existing FCM token for user ${userId}`);
      } else {
        // Add new token
        const newToken = {
          token,
          platform,
          addedAt: new Date(),
          lastUsed: new Date()
        };
        preferences.fcm.tokens.push(newToken);
        logger.info(`🔧 Added new FCM token for user ${userId}:`, newToken);
      }

      logger.info(`🔧 Before save - FCM tokens count: ${preferences.fcm.tokens.length}`);
      await preferences.save();
      logger.info(`🔧 After save - FCM tokens count: ${preferences.fcm.tokens.length}`);

      res.status(200).json({
        success: true,
        message: 'FCM token added successfully',
        data: {
          tokenCount: preferences.fcm.tokens.length
        }
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
   * Update user notification preferences
   */
  async updateUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      const preferencesData = req.body;
      
      logger.info(`🔧 Update preferences request for user ${userId}:`, preferencesData);

      // Get or create user preferences
      let preferences = await UserNotificationPreferences.findOne({ userId });
      
      if (!preferences) {
        logger.info(`🔧 Creating default preferences for user ${userId}`);
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, address: '', verified: false },
          sms: { enabled: false, phoneNumber: '', verified: false },
          fcm: { enabled: true, tokens: [] },
          inApp: { enabled: true },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        });
      }

      // Update preferences without overwriting FCM tokens
      if (preferencesData.email) {
        preferences.email = { ...preferences.email, ...preferencesData.email };
      }
      if (preferencesData.sms) {
        preferences.sms = { ...preferences.sms, ...preferencesData.sms };
      }
      if (preferencesData.fcm) {
        // Only update fcm.enabled, preserve existing tokens
        preferences.fcm = { 
          ...preferences.fcm, 
          enabled: preferencesData.fcm.enabled 
        };
      }
      if (preferencesData.inApp) {
        preferences.inApp = { ...preferences.inApp, ...preferencesData.inApp };
      }
      if (preferencesData.quietHours) {
        preferences.quietHours = { ...preferences.quietHours, ...preferencesData.quietHours };
      }

      await preferences.save();
      logger.info(`🔧 Updated preferences for user ${userId}`);

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
   * Remove FCM token for user
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

      // Remove token from array
      preferences.fcm.tokens = preferences.fcm.tokens.filter(t => t.token !== token);
      await preferences.save();

      logger.info(`Removed FCM token for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'FCM token removed successfully',
        data: {
          tokenCount: preferences.fcm.tokens.length
        }
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
}

export default NotificationController;
