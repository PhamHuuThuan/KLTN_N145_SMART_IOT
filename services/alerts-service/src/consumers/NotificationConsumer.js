import NotificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';

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
      
      const notificationData = {
        userId,
        title: this._getAlertTitle(alertType, sensorType),
        message: this._getAlertMessage(alertType, sensorType, sensorValue, threshold),
        type: 'device_alert',
        category: 'sensor',
        priority: this._getAlertPriority(alertType),
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
      const { userId, action, deviceId, deviceName, result } = message;
      
      const notificationData = {
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

      await this.notificationService.sendNotification(notificationData);
      
      logger.notification('User action notification sent', {
        userId,
        action,
        deviceId
      });
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
        const notifications = affectedUsers.map(userId => ({
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
          userCount: affectedUsers.length
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
      temperature: 'nhiệt độ',
      humidity: 'độ ẩm',
      gas: 'khí gas',
      smoke: 'khói',
      motion: 'chuyển động',
      light: 'ánh sáng'
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
  _getAlertPriority(alertType) {
    switch (alertType) {
      case 'sensor_failure':
      case 'sensor_offline':
        return 'high';
      case 'threshold_exceeded':
        return 'medium';
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
      turn_on: 'bật',
      turn_off: 'tắt',
      toggle: 'chuyển đổi trạng thái',
      adjust: 'điều chỉnh'
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
