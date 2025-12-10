import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import UserNotificationPreferences from '../models/UserNotificationPreferences.js';
import EmailService from './EmailService.js';
import SMSService from './SMSService.js';
import FCMService from './FCMService.js';
import InAppService from './InAppService.js';
import logger from '../utils/logger.js';

const PRIORITY_CHANNEL_MAP = {
  urgent: ['inApp', 'email', 'sms', 'fcm'],
  high: ['inApp', 'email', 'sms'],
  medium: ['inApp', 'email'],
  low: ['inApp'],
};

const DEFAULT_CHANNELS = ['inApp'];

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.fcmService = new FCMService();
    this.inAppService = new InAppService();
  }

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

      if (!userId || typeof userId !== 'string') {
        throw new Error('userId is required and must be a valid string');
      }

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

      const savePromise = notification.save();
      const saveTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Notification save timeout')), 10000)
      );

      await Promise.race([savePromise, saveTimeoutPromise]);

      const preferencesPromise = UserNotificationPreferences.getUserPreferences(userId);
      const preferencesTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User preferences fetch timeout')), 5000)
      );
      
      const preferences = await Promise.race([preferencesPromise, preferencesTimeoutPromise]);
      if (!preferences) {
        logger.warn(`No notification preferences found for user ${userId}`);
        return notification;
      }

      if (scheduledFor && scheduledFor > new Date()) {
        return notification;
      }

      await this._sendThroughChannels(notification, preferences);

      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  async _sendThroughChannels(notification, preferences) {
    const { category, priority } = notification;
    const normalizedPriority = (priority || 'medium').toLowerCase();
    const allowedChannels =
      PRIORITY_CHANNEL_MAP[normalizedPriority] || PRIORITY_CHANNEL_MAP.medium || DEFAULT_CHANNELS;

    for (const channel of allowedChannels) {
      try {
        if (preferences.shouldSendNotification(channel, priority)) {
          await this._sendThroughChannel(notification, preferences, channel);
        }
      } catch (error) {
        logger.error(`Error sending notification through ${channel}:`, error);
        notification.deliveryStatus[channel].error = error.message;
        await notification.save();
      }
    }

    const allChannels = ['inApp', 'email', 'sms', 'fcm'];
    for (const channel of allChannels) {
      if (!allowedChannels.includes(channel) && notification.deliveryStatus[channel]) {
        notification.deliveryStatus[channel].sent = false;
        notification.deliveryStatus[channel].error = null;
        notification.deliveryStatus[channel].sentAt = null;
      }
    }

    const savePromise = notification.save();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Notification update timeout')), 5000)
    );
    await Promise.race([savePromise, timeoutPromise]);
  }

  async _sendThroughChannel(notification, preferences, channel) {
    const { userId, title, message, metadata } = notification;
    const deliveryStatus = notification.deliveryStatus[channel];

    let result;
    switch (channel) {
      case 'inApp':
        result = await this.inAppService.send(
          userId,
          title,
          message,
          metadata,
          notification.type,
          notification.category,
          notification.priority
        );
        break;
      case 'email':
        if (preferences.email.addresses && preferences.email.addresses.length > 0) {
          const emailData = preferences.email.addresses.map(emailAddr => ({
            to: emailAddr.address,
            subject: title,
            message: message,
            metadata: { ...metadata, recipientName: emailAddr.name }
          }));
          
          result = await this.emailService.sendBulk(emailData);
        } else {
          logger.warn('No email addresses configured for user');
          result = null;
        }
        break;
      case 'sms':
        if (preferences.sms.phoneNumbers && preferences.sms.phoneNumbers.length > 0) {
          const smsData = preferences.sms.phoneNumbers.map(phoneNum => ({
            to: phoneNum.phoneNumber,
            message: message,
            metadata: { ...metadata, recipientName: phoneNum.name }
          }));
          
          result = await this.smsService.sendBulk(smsData);
        } else {
          logger.warn('No phone numbers configured for user');
          result = null;
        }
        break;
      case 'fcm':
        if (preferences.fcm.tokens.length > 0) {
          if (notification.priority === 'urgent' || notification.category === 'security' || notification.type === 'security_alert' || notification.type === 'consolidated_alert' || notification.type === 'escalation_alert') {
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
            result = await this.fcmService.send(
              preferences.fcm.tokens,
              title,
              message,
              metadata
            );
          }
        }
        break;
    }

    if (result) {
      deliveryStatus.sent = true;
      deliveryStatus.sentAt = new Date();
      deliveryStatus.error = null;
    }

    const savePromise = notification.save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Notification update timeout')), 5000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
  }

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

  async getUserNotifications(userId, options = {}) {
    try {
      const notifications = await Notification.getUserNotifications(userId, options);
      const total = await Notification.countDocuments({ userId: userId });
      
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

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        notificationId: notificationId,
        userId: userId
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

  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId: userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      
      return result;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        notificationId: notificationId,
        userId: userId
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

  async getNotificationStats(userId) {
    try {
      const stats = await Notification.aggregate([
        { $match: { userId: userId } },
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
      
      const byType = {};
      result.byType.forEach(item => {
        if (!byType[item.type]) {
          byType[item.type] = { total: 0, unread: 0 };
        }
        byType[item.type].total++;
        if (!item.isRead) byType[item.type].unread++;
      });

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

}

export default NotificationService;
