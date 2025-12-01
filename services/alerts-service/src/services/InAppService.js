import logger from '../utils/logger.js';

class InAppService {
  constructor() {
    this.activeConnections = new Map();
  }

  async send(userId, title, message, metadata = {}, type = undefined, category = undefined, priority = undefined) {
    try {
      const notification = {
        id: this._generateId(),
        userId,
        title,
        message,
        metadata,
        timestamp: new Date().toISOString(),
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {})
      };

      if (this.activeConnections.has(userId)) {
        const connection = this.activeConnections.get(userId);
        this._sendViaWebSocket(connection, notification);
      }

      if (global.io) {
        const isEmergency = priority === 'urgent' || category === 'security' || type === 'security_alert' || type === 'consolidated_alert';
        
        if (isEmergency) {
          global.io.emit('emergency_notification', notification);
        } else {
          global.io.to(`user_${userId}`).emit('notification', notification);
        }
      } else {
        logger.error('Socket.IO not available (global.io is null)');
      }
      return notification;
    } catch (error) {
      logger.error('Error sending in-app notification:', error);
      throw error;
    }
  }

  _generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default InAppService;
