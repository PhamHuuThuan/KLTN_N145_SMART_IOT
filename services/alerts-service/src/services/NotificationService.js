import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import UserNotificationPreferences from '../models/UserNotificationPreferences.js';
import EmailService from './EmailService.js';
import SMSService from './SMSService.js';
import FCMService from './FCMService.js';
import InAppService from './InAppService.js';
import logger from '../utils/logger.js';

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.fcmService = new FCMService();
    this.inAppService = new InAppService();
  }

  /**
   * Send notification to user through all enabled channels
   * @param {Object} notificationData - Notification data
   * @param {string} notificationData.userId - User ID
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {string} notificationData.type - Notification type
   * @param {string} notificationData.category - Notification category
   * @param {string} notificationData.priority - Notification priority
   * @param {Object} notificationData.metadata - Additional metadata
   * @param {Date} notificationData.scheduledFor - When to send (optional)
   * @param {Date} notificationData.expiresAt - When notification expires (optional)
   */
  async sendNotification(notificationData) {
    try {
      const {
        userId,
        title,
        message,
        type,
        category,
        priority = 'medium',
        metadata = {},
        scheduledFor = null,
        expiresAt = null
      } = notificationData;

      // Validate required fields
      if (!userId) {
        throw new Error('userId is required for notification');
      }

      // Validate userId format (MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('userId must be a valid MongoDB ObjectId');
      }

      // Create notification record with timeout
      const notification = new Notification({
        userId,
        title,
        message,
        type,
        category,
        priority,
        metadata,
        scheduledFor,
        expiresAt
      });

      // Add timeout to prevent hanging
      const savePromise = notification.save();
      const saveTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Notification save timeout')), 10000)
      );

      await Promise.race([savePromise, saveTimeoutPromise]);

      // Get user preferences with timeout
      console.log(`🔍 Getting user preferences for userId: ${userId}`);
      const preferencesPromise = UserNotificationPreferences.getUserPreferences(userId);
      const preferencesTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User preferences fetch timeout')), 5000)
      );
      
      const preferences = await Promise.race([preferencesPromise, preferencesTimeoutPromise]);
      if (!preferences) {
        logger.warn(`No notification preferences found for user ${userId}`);
        console.log(`⚠️ No preferences found for user ${userId}, skipping channel delivery`);
        return notification;
      }
      console.log(`✅ User preferences found for userId: ${userId}`);

      // Check if notification should be sent immediately or scheduled
      if (scheduledFor && scheduledFor > new Date()) {
        logger.info(`Notification scheduled for ${scheduledFor}`, { notificationId: notification._id });
        return notification;
      }

      // Send through enabled channels
      console.log(`📡 Sending notification through channels for userId: ${userId}`);
      await this._sendThroughChannels(notification, preferences);
      console.log(`✅ Notification sent through all channels for userId: ${userId}`);

      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification through all enabled channels
   * @private
   */
  async _sendThroughChannels(notification, preferences) {
    const { category, priority } = notification;
    const channels = ['inApp', 'email', 'sms', 'fcm'];

    for (const channel of channels) {
      try {
        console.log(`🔍 Checking channel ${channel} for category ${category}, priority ${priority}`);
        if (preferences.shouldSendNotification(channel, priority)) {
          console.log(`📤 Sending notification through ${channel}`);
          await this._sendThroughChannel(notification, preferences, channel);
          console.log(`✅ Notification sent through ${channel}`);
        } else {
          console.log(`⏭️ Skipping channel ${channel} - not enabled or not matching criteria`);
        }
      } catch (error) {
        logger.error(`Error sending notification through ${channel}:`, error);
        console.error(`❌ Error in channel ${channel}:`, error.message);
        // Update delivery status with error
        notification.deliveryStatus[channel].error = error.message;
        await notification.save();
      }
    }
  }

  /**
   * Send notification through specific channel
   * @private
   */
  async _sendThroughChannel(notification, preferences, channel) {
    const { userId, title, message, metadata } = notification;
    const deliveryStatus = notification.deliveryStatus[channel];

    let result;
    switch (channel) {
      case 'inApp':
        console.log(`📱 Calling inAppService.send for userId: ${userId}`);
        result = await this.inAppService.send(userId, title, message, metadata);
        console.log(`📱 inAppService.send result:`, result);
        break;
      case 'email':
        console.log(`📧 Calling emailService.send to: ${preferences.email.address}`);
        result = await this.emailService.send(
          preferences.email.address,
          title,
          message,
          metadata
        );
        console.log(`📧 emailService.send result:`, result);
        break;
      case 'sms':
        if (preferences.sms.phoneNumber) {
          console.log(`📱 Calling smsService.send to: ${preferences.sms.phoneNumber}`);
          result = await this.smsService.send(
            preferences.sms.phoneNumber,
            message,
            metadata
          );
          console.log(`📱 smsService.send result:`, result);
        }
        break;
      case 'fcm':
        if (preferences.fcm.tokens.length > 0) {
          console.log(`🔥 Calling fcmService for ${preferences.fcm.tokens.length} tokens`);
          
          // Use sendEmergency for urgent/security notifications
          if (notification.priority === 'urgent' || notification.category === 'security' || notification.type === 'security_alert') {
            console.log(`🚨 Sending emergency FCM notification`);
            result = await this.fcmService.sendEmergency(
              preferences.fcm.tokens,
              title,
              message,
              {
                ...metadata,
                deviceId: metadata.deviceId,
                deviceName: metadata.deviceName,
                sensorType: metadata.sensorType,
                sensorValue: metadata.sensorValue,
                threshold: metadata.threshold
              }
            );
          } else {
            console.log(`📱 Sending regular FCM notification`);
            result = await this.fcmService.send(
              preferences.fcm.tokens,
              title,
              message,
              metadata
            );
          }
          console.log(`🔥 fcmService result:`, result);
        }
        break;
    }

    if (result) {
      deliveryStatus.sent = true;
      deliveryStatus.sentAt = new Date();
      deliveryStatus.error = null;
    }

    // Save notification with timeout
    const savePromise = notification.save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Notification update timeout')), 5000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
  }

  /**
   * Send bulk notifications to multiple users
   * @param {Array} notifications - Array of notification data
   */
  async sendBulkNotifications(notifications) {
    const results = [];
    
    for (const notificationData of notifications) {
      try {
        const result = await this.sendNotification(notificationData);
        results.push({ success: true, notification: result });
      } catch (error) {
        logger.error('Error in bulk notification:', error);
        results.push({ success: false, error: error.message, data: notificationData });
      }
    }

    return results;
  }

  /**
   * Get user notifications with pagination and filters
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const notifications = await Notification.getUserNotifications(userId, options);
      const total = await Notification.countDocuments({ userId });
      
      return {
        notifications,
        total,
        page: options.page || 1,
        limit: options.limit || 20,
        pages: Math.ceil(total / (options.limit || 20))
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   * @param {string} userId - User ID
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      
      return result;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for user
   * @param {string} userId - User ID
   */
  async getNotificationStats(userId) {
    try {
      const stats = await Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: { $sum: { $cond: ['$isRead', 0, 1] } },
            byType: {
              $push: {
                type: '$type',
                isRead: '$isRead'
              }
            },
            byCategory: {
              $push: {
                category: '$category',
                isRead: '$isRead'
              }
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          total: 0,
          unread: 0,
          byType: {},
          byCategory: {}
        };
      }

      const result = stats[0];
      
      // Process by type
      const byType = {};
      result.byType.forEach(item => {
        if (!byType[item.type]) {
          byType[item.type] = { total: 0, unread: 0 };
        }
        byType[item.type].total++;
        if (!item.isRead) byType[item.type].unread++;
      });

      // Process by category
      const byCategory = {};
      result.byCategory.forEach(item => {
        if (!byCategory[item.category]) {
          byCategory[item.category] = { total: 0, unread: 0 };
        }
        byCategory[item.category].total++;
        if (!item.isRead) byCategory[item.category].unread++;
      });

      return {
        total: result.total,
        unread: result.unread,
        byType,
        byCategory
      };
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications() {
    try {
      const now = new Date();
      const scheduledNotifications = await Notification.find({
        scheduledFor: { $lte: now },
        'deliveryStatus.inApp.sent': false
      });

      for (const notification of scheduledNotifications) {
        const preferences = await UserNotificationPreferences.getUserPreferences(notification.userId);
        if (preferences) {
          await this._sendThroughChannels(notification, preferences);
        }
      }

      logger.info(`Processed ${scheduledNotifications.length} scheduled notifications`);
    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const now = new Date();
      const result = await Notification.deleteMany({
        expiresAt: { $lte: now }
      });

      logger.info(`Cleaned up ${result.deletedCount} expired notifications`);
      return result;
    } catch (error) {
      logger.error('Error cleaning up expired notifications:', error);
    }
  }
}

export default NotificationService;
