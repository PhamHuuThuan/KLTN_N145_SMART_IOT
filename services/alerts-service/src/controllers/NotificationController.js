import NotificationService from '../services/NotificationService.js';
import UserNotificationPreferences from '../models/UserNotificationPreferences.js';
import logger from '../utils/logger.js';

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  async sendNotification(req, res) {
    try {
      const notificationData = req.body;
      
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

  async getUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      
      let preferences = await UserNotificationPreferences.getUserPreferences(userId);
      
      if (!preferences) {
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, addresses: [] },
          sms: { enabled: false, phoneNumbers: [] },
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

      let preferences = await UserNotificationPreferences.findOne({ userId });
      if (!preferences) {
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, addresses: [] },
          sms: { enabled: false, phoneNumbers: [] },
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

      const existingTokenIndex = preferences.fcm.tokens.findIndex(t => t.token === token);
      preferences.fcm.tokens = preferences.fcm.tokens.filter(t => !t.token.startsWith('ExponentPushToken['));
      
      if (existingTokenIndex >= 0) {
        preferences.fcm.tokens[existingTokenIndex] = {
          token,
          platform,
          lastUsed: new Date()
        };
      } else {
        const newToken = {
          token,
          platform,
          addedAt: new Date(),
          lastUsed: new Date()
        };
        preferences.fcm.tokens.push(newToken);
      }

      await preferences.save();

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

  async updateUserPreferences(req, res) {
    try {
      const { userId } = req.params;
      const preferencesData = req.body;

      let preferences = await UserNotificationPreferences.findOne({ userId: userId });
      
      if (!preferences) {
        preferences = new UserNotificationPreferences({
          userId,
          email: { enabled: true, addresses: [] },
          sms: { enabled: false, phoneNumbers: [] },
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

      if (preferencesData.email) {
        const { enabled, addresses } = preferencesData.email;
        preferences.email.enabled = enabled !== undefined ? enabled : preferences.email.enabled;
        if (Array.isArray(addresses)) {
          preferences.email.addresses = addresses;
        }
      }
      if (preferencesData.sms) {
        const { enabled, phoneNumbers } = preferencesData.sms;
        preferences.sms.enabled = enabled !== undefined ? enabled : preferences.sms.enabled;
        if (Array.isArray(phoneNumbers)) {
          preferences.sms.phoneNumbers = phoneNumbers;
        }
      }
      if (preferencesData.fcm) {
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
}

export default NotificationController;
