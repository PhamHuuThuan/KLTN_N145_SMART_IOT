import NotificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

class NotificationConsumer {
  constructor() {
    this.notificationService = new NotificationService();
  }

  async handleDeviceAlert(topic, message) {
    try {
      const { deviceId, deviceName, sensorType, sensorValue, threshold, alertType, userId } = message;
      
      if (!userId) {
        logger.warn('Device alert message missing userId, skipping notification', {
          deviceId,
          alertType,
          sensorType,
          message
        });
        return;
      }
      
      const effectiveCategory = message.category || (['gas_ppm', 'smoke'].includes(sensorType) ? 'security' : 'sensor');
      const effectivePriority = message.priority || this._getAlertPriority(alertType, sensorType, sensorValue, threshold);

      const notificationData = {
        userId,
        title: this._getAlertTitle(alertType, sensorType),
        message: this._getAlertMessage(alertType, sensorType, sensorValue, threshold),
        type: message.type || (effectiveCategory === 'security' ? 'security_alert' : 'device_alert'),
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

      await this.notificationService.sendNotification(notificationData);
    } catch (error) {
      logger.error('Error handling device alert:', error);
    }
  }

  async handleNotificationRequest(topic, message) {
    try {
      const { userId, title, message: notificationMessage, type, category, priority, metadata } = message;
      
      if (!userId) {
        logger.warn('Notification request message missing userId, skipping notification', {
          title,
          type,
          category,
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
    } catch (error) {
      logger.error('Error handling notification request:', error);
    }
  }

  async handleUserAction(topic, message) {
    try {
      if (!message || typeof message !== 'object') {
        logger.warn('Invalid message format in handleUserAction', { topic, message });
        return;
      }

      const { userId, action, deviceId, deviceName, result, outletId, outletName, status } = message;
      
      if (!userId) {
        logger.warn('User action message missing userId, skipping notification', {
          action,
          deviceId,
          message
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn('User action message has invalid userId format, skipping notification', {
          userId,
          message
        });
        return;
      }
      
      let notificationData;
      
      if (action === 'emergency_mode_activated') {
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
  
      await this.notificationService.sendNotification(notificationData);
    } catch (error) {
      logger.error('Error handling user action:', error);
    }
  }

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

  _getAlertPriority(alertType, sensorType, sensorValue, threshold) {
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

  _getActionMessage(action, deviceName, result) {
    const actionNames = {
      ON: 'bật',
      OFF: 'tắt',
    };

    const actionName = actionNames[action] || action;
    const status = result === 'success' ? 'thành công' : 'thất bại';
    
    return `Hành động ${actionName} thiết bị ${deviceName} ${status}.`;
  }


}

export default NotificationConsumer;
