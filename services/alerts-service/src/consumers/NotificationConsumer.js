import NotificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

class NotificationConsumer {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Handle device alert messages
   */
  async handleDeviceAlert(topic, message) {
    try {
      const { deviceId, deviceName, sensorType, sensorValue, threshold, alertType, userId } = message;
      
      // Validate required userId
      if (!userId) {
        logger.warn('Device alert message missing userId, skipping notification', {
          deviceId,
          alertType,
          sensorType,
          message
        });
        return;
      }

      // Validate userId format (MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn('Device alert message has invalid userId format, skipping notification', {
          deviceId,
          alertType,
          sensorType,
          userId,
          message
        });
        return;
      }
      
      // Determine effective category/priority (prefer message overrides)
      const effectiveCategory = message.category || (['gas_ppm', 'smoke'].includes(sensorType) ? 'security' : 'sensor');
      const effectivePriority = message.priority || this._getAlertPriority(alertType, sensorType, sensorValue, threshold);

      const notificationData = {
        userId,
        title: this._getAlertTitle(alertType, sensorType),
        message: this._getAlertMessage(alertType, sensorType, sensorValue, threshold),
        type: effectiveCategory === 'security' ? 'security_alert' : 'device_alert',
        category: effectiveCategory,
        priority: effectivePriority,
        metadata: {
          deviceId,
          deviceName,
          sensorType,
          sensorValue,
          threshold,
          alertType
        }
      };

      console.log(`🚨 Device alert notification data:`, notificationData);
      console.log(`🚨 Emergency check: category=${effectiveCategory}, priority=${effectivePriority}, type=${effectiveCategory === 'security' ? 'security_alert' : 'device_alert'}`);
      
      await this.notificationService.sendNotification(notificationData);
      
      logger.notification('Device alert notification sent', {
        deviceId,
        userId,
        alertType,
        sensorType
      });
    } catch (error) {
      logger.error('Error handling device alert:', error);
    }
  }

  /**
   * Handle notification request messages
   */
  async handleNotificationRequest(topic, message) {
    try {
      const { userId, title, message: notificationMessage, type, category, priority, metadata } = message;
      
      // Validate required userId
      if (!userId) {
        logger.warn('Notification request message missing userId, skipping notification', {
          title,
          type,
          category,
          message
        });
        return;
      }

      // Validate userId format (MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn('Notification request message has invalid userId format, skipping notification', {
          title,
          type,
          category,
          userId,
          message
        });
        return;
      }
      
      const notificationData = {
        userId,
        title,
        message: notificationMessage,
        type: type || 'system_notification',
        category: category || 'system',
        priority: priority || 'medium',
        metadata: metadata || {}
      };

      await this.notificationService.sendNotification(notificationData);
      
      logger.notification('Notification request processed', {
        userId,
        type,
        category
      });
    } catch (error) {
      logger.error('Error handling notification request:', error);
    }
  }

  /**
   * Handle user action messages
   */
  async handleUserAction(topic, message) {
    try {
      // Validate message structure
      if (!message || typeof message !== 'object') {
        logger.warn('Invalid message format in handleUserAction', { topic, message });
        return;
      }

      const { userId, action, deviceId, deviceName, result, outletId, outletName, status } = message;
      
      // Validate required userId
      if (!userId) {
        logger.warn('User action message missing userId, skipping notification', {
          action,
          deviceId,
          message
        });
        return;
      }

      // Validate userId format (MongoDB ObjectId)
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn('User action message has invalid userId format, skipping notification', {
          action,
          deviceId,
          userId,
          message
        });
        return;
      }
      
      let notificationData;
      
      // Handle outlet toggle specifically - DISABLED
      if (action === 'outlet_toggled') {
        console.log(`🔌 Outlet toggle: ${outletName} -> ${status} -> ${action} - NOTIFICATION DISABLED`);
        
        // Skip outlet notifications completely
        console.log(`⏭️ Skipping outlet notification - disabled by user request`);
        return;
      } else if (action === 'emergency_mode_activated') {
        notificationData = {
          userId,
          title: 'Emergency Mode Activated',
          message: `Emergency mode has been activated for device ${deviceName}`,
          type: 'system_notification',
          category: 'system',
          priority: 'normal',
          metadata: {
            deviceId,
            deviceName,
            action,
            result
          }
        };
      } else if (action === 'emergency_mode_deactivated') {
        notificationData = {
          userId,
          title: 'Emergency Mode Deactivated',
          message: `Emergency mode has been deactivated for device ${deviceName}`,
          type: 'system_notification',
          category: 'system',
          priority: 'medium',
          metadata: {
            deviceId,
            deviceName,
            action,
            result
          }
        };
      } else if (action === 'outlet_settings_updated') {
        notificationData = {
          userId,
          title: 'Outlet Settings Updated',
          message: `Outlet ${outletId} settings have been updated`,
          type: 'system_notification',
          category: 'outlet',
          priority: 'low',
          metadata: {
            deviceId,
            deviceName,
            action,
            outletId,
            result
          }
        };
      } else {
        // Handle other user actions
        notificationData = {
          userId,
          title: 'Device Action Completed',
          message: this._getActionMessage(action, deviceName, result),
          type: 'system_notification',
          category: 'outlet',
          priority: 'low',
          metadata: {
            deviceId,
            deviceName,
            action,
            result
          }
        };
      }
  
      console.log(`📤 Sending notification for action: ${action}`, notificationData);
      console.log(`📤 About to call notificationService.sendNotification for userId: ${userId}`);
      await this.notificationService.sendNotification(notificationData);
      console.log(`📤 notificationService.sendNotification completed for userId: ${userId}`);
      
      logger.notification('User action notification sent', {
        userId,
        action,
        deviceId
      });
      console.log(`✅ Notification sent successfully for action: ${action}`);
    } catch (error) {
      logger.error('Error handling user action:', error);
    }
  }

  /**
   * Handle system event messages
   */
  async handleSystemEvent(topic, message) {
    try {
      const { eventType, message: eventMessage, affectedUsers, metadata } = message;
      
      if (affectedUsers && affectedUsers.length > 0) {
        // Filter out invalid userIds
        const validUserIds = affectedUsers.filter(userId => 
          userId && mongoose.Types.ObjectId.isValid(userId)
        );

        if (validUserIds.length === 0) {
          logger.warn('System event has no valid userIds, skipping notifications', {
            eventType,
            originalCount: affectedUsers.length,
            message
          });
          return;
        }

        const notifications = validUserIds.map(userId => ({
          userId,
          title: this._getSystemEventTitle(eventType),
          message: eventMessage,
          type: 'system_notification',
          category: 'system',
          priority: this._getSystemEventPriority(eventType),
          metadata: metadata || {}
        }));

        await this.notificationService.sendBulkNotifications(notifications);
        
        logger.notification('System event notifications sent', {
          eventType,
          userCount: validUserIds.length,
          originalCount: affectedUsers.length,
          filteredCount: affectedUsers.length - validUserIds.length
        });
      }
    } catch (error) {
      logger.error('Error handling system event:', error);
    }
  }

  /**
   * Get alert title based on alert type and sensor type
   * @private
   */
  _getAlertTitle(alertType, sensorType) {
    const sensorNames = {
      temperature: 'Nhiệt độ',
      humidity: 'Độ ẩm',
      gas: 'Khí gas',
      smoke: 'Khói',
      motion: 'Chuyển động',
      light: 'Ánh sáng'
    };

    const sensorName = sensorNames[sensorType] || sensorType;
    
    switch (alertType) {
      case 'threshold_exceeded':
        return `Cảnh báo ${sensorName}`;
      case 'threshold_below':
        return `Cảnh báo ${sensorName} thấp`;
      case 'sensor_failure':
        return `Lỗi cảm biến ${sensorName}`;
      case 'sensor_offline':
        return `Cảm biến ${sensorName} mất kết nối`;
      default:
        return `Cảnh báo ${sensorName}`;
    }
  }

  /**
   * Get alert message based on alert type and values
   * @private
   */
  _getAlertMessage(alertType, sensorType, sensorValue, threshold) {
    const sensorNames = {
      temp: 'nhiệt độ',
      humid: 'độ ẩm',
      gas_ppm: 'khí gas',
      smoke: 'khói',
    };

    const sensorName = sensorNames[sensorType] || sensorType;
    
    switch (alertType) {
      case 'threshold_exceeded':
        return `Cảm biến ${sensorName} đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`;
      case 'threshold_below':
        return `Cảm biến ${sensorName} đã xuống dưới ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`;
      case 'sensor_failure':
        return `Cảm biến ${sensorName} gặp lỗi và cần được kiểm tra.`;
      case 'sensor_offline':
        return `Cảm biến ${sensorName} đã mất kết nối với hệ thống.`;
      default:
        return `Cảnh báo từ cảm biến ${sensorName}. Giá trị: ${sensorValue}`;
    }
  }

  /**
   * Get alert priority based on alert type
   * @private
   */
  _getAlertPriority(alertType, sensorType, sensorValue, threshold) {
    // Elevate to urgent for dangerous sensors or severe breaches
    if (alertType === 'threshold_exceeded') {
      if (sensorType === 'smoke' || sensorType === 'gas_ppm') {
        return 'urgent';
      }
      if (sensorType === 'temperature') {
        const val = Number(sensorValue);
        const thr = Number(threshold);
        if (!Number.isNaN(val)) {
          if (val >= 80) return 'urgent';
          if (!Number.isNaN(thr) && val >= thr + 10) return 'high';
        }
        return 'medium';
      }
      return 'medium';
    }
    switch (alertType) {
      case 'sensor_failure':
      case 'sensor_offline':
        return 'high';
      case 'threshold_below':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Get action message based on action and result
   * @private
   */
  _getActionMessage(action, deviceName, result) {
    const actionNames = {
      ON: 'bật',
      OFF: 'tắt',
    };

    const actionName = actionNames[action] || action;
    const status = result === 'success' ? 'thành công' : 'thất bại';
    
    return `Hành động ${actionName} thiết bị ${deviceName} ${status}.`;
  }

  /**
   * Get system event title based on event type
   * @private
   */
  _getSystemEventTitle(eventType) {
    const eventTitles = {
      maintenance: 'Bảo trì hệ thống',
      update: 'Cập nhật hệ thống',
      security: 'Cảnh báo bảo mật',
      outage: 'Sự cố hệ thống',
      recovery: 'Khôi phục hệ thống'
    };

    return eventTitles[eventType] || 'Sự kiện hệ thống';
  }

  /**
   * Get system event priority based on event type
   * @private
   */
  _getSystemEventPriority(eventType) {
    switch (eventType) {
      case 'security':
      case 'outage':
        return 'urgent';
      case 'maintenance':
      case 'update':
        return 'medium';
      case 'recovery':
        return 'low';
      default:
        return 'medium';
    }
  }
}

export default NotificationConsumer;
