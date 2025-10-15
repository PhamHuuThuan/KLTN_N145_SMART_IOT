import logger from '../utils/logger.js';

class InAppService {
  constructor() {
    this.activeConnections = new Map(); // Store WebSocket connections
  }

  /**
   * Send in-app notification
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional metadata
   */
  async send(userId, title, message, metadata = {}, type = undefined, category = undefined, priority = undefined) {
    try {
      const notification = {
        id: this._generateId(),
        userId,
        title,
        message,
        metadata,
        timestamp: new Date().toISOString(),
        // Preserve semantic fields so client can render consistently
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {})
      };

      // Send via WebSocket if user is connected
      if (this.activeConnections.has(userId)) {
        const connection = this.activeConnections.get(userId);
        this._sendViaWebSocket(connection, notification);
      }

      // Send via Socket.IO if available
      if (global.io) {
        console.log(`🔌 Sending notification via Socket.IO to user_${userId}:`, notification);
        
        // Check if this is an emergency notification
        const isEmergency = priority === 'urgent' || category === 'security' || type === 'security_alert' || type === 'consolidated_alert';
        
        // Debug consolidated alert
        if (type === 'consolidated_alert') {
          console.log(`🔄 CONSOLIDATED ALERT InAppService:`, JSON.stringify(notification, null, 2));
          console.log(`🔄 Consolidated alert isEmergency: ${isEmergency}`);
        }
        
        if (isEmergency) {
          console.log(`🚨 EMERGENCY NOTIFICATION - Broadcasting to all users`);
          // For emergency, broadcast to all connected users
          global.io.emit('emergency_notification', notification);
        } else {
          // Regular notification - send to specific user
          global.io.to(`user_${userId}`).emit('notification', notification);
        }
        
        logger.info('In-app notification sent via Socket.IO', { 
          userId, 
          title, 
          notificationId: notification.id,
          isEmergency,
          priority,
          category
        });
        console.log(`✅ Socket.IO notification sent to user_${userId} (emergency: ${isEmergency})`);
      } else {
        console.log('❌ Socket.IO not available (global.io is null)');
      }

      // Store in database (this will be handled by the main notification service)
      logger.info('In-app notification created', { 
        userId, 
        title, 
        notificationId: notification.id 
      });

      return notification;
    } catch (error) {
      logger.error('Error sending in-app notification:', error);
      throw error;
    }
  }

  /**
   * Send notification via WebSocket
   * @private
   */
  _sendViaWebSocket(connection, notification) {
    try {
      if (connection && connection.readyState === 1) { // WebSocket.OPEN
        connection.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        
        logger.info('In-app notification sent via WebSocket', { 
          userId: notification.userId,
          notificationId: notification.id 
        });
      }
    } catch (error) {
      logger.error('Error sending via WebSocket:', error);
    }
  }

  /**
   * Add WebSocket connection for user
   * @param {string} userId - User ID
   * @param {WebSocket} connection - WebSocket connection
   */
  addConnection(userId, connection) {
    this.activeConnections.set(userId, connection);
    
    // Handle connection close
    connection.on('close', () => {
      this.activeConnections.delete(userId);
      logger.info('WebSocket connection closed', { userId });
    });

    // Handle connection error
    connection.on('error', (error) => {
      logger.error('WebSocket connection error:', error);
      this.activeConnections.delete(userId);
    });

    logger.info('WebSocket connection added', { userId });
  }

  /**
   * Remove WebSocket connection for user
   * @param {string} userId - User ID
   */
  removeConnection(userId) {
    if (this.activeConnections.has(userId)) {
      const connection = this.activeConnections.get(userId);
      connection.close();
      this.activeConnections.delete(userId);
      logger.info('WebSocket connection removed', { userId });
    }
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount() {
    return this.activeConnections.size;
  }

  /**
   * Get active user IDs
   */
  getActiveUserIds() {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Send notification to all connected users
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional metadata
   */
  async broadcast(title, message, metadata = {}) {
    try {
      const notification = {
        id: this._generateId(),
        title,
        message,
        metadata,
        timestamp: new Date().toISOString(),
        type: 'broadcast'
      };

      let sentCount = 0;
      for (const [userId, connection] of this.activeConnections) {
        try {
          this._sendViaWebSocket(connection, { ...notification, userId });
          sentCount++;
        } catch (error) {
          logger.error(`Error broadcasting to user ${userId}:`, error);
        }
      }

      logger.info('Broadcast notification sent', { 
        sentCount, 
        totalConnections: this.activeConnections.size 
      });

      return { sentCount, totalConnections: this.activeConnections.size };
    } catch (error) {
      logger.error('Error broadcasting notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to specific users
   * @param {Array} userIds - Array of user IDs
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional metadata
   */
  async sendToUsers(userIds, title, message, metadata = {}) {
    try {
      const results = [];
      
      for (const userId of userIds) {
        try {
          const result = await this.send(userId, title, message, metadata);
          results.push({ userId, success: true, notification: result });
        } catch (error) {
          logger.error(`Error sending to user ${userId}:`, error);
          results.push({ userId, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error sending to users:', error);
      throw error;
    }
  }

  /**
   * Send system message to user
   * @param {string} userId - User ID
   * @param {string} message - System message
   * @param {string} level - Message level (info, warning, error, success)
   */
  async sendSystemMessage(userId, message, level = 'info') {
    try {
      const systemMessage = {
        id: this._generateId(),
        userId,
        title: 'System Message',
        message,
        metadata: { level, type: 'system' },
        timestamp: new Date().toISOString(),
        type: 'system_message'
      };

      if (this.activeConnections.has(userId)) {
        const connection = this.activeConnections.get(userId);
        this._sendViaWebSocket(connection, systemMessage);
      }

      logger.info('System message sent', { userId, level, message });
      return systemMessage;
    } catch (error) {
      logger.error('Error sending system message:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   * @private
   */
  _generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection status for user
   * @param {string} userId - User ID
   */
  getConnectionStatus(userId) {
    const connection = this.activeConnections.get(userId);
    return {
      connected: !!connection,
      readyState: connection ? connection.readyState : null
    };
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    for (const [userId, connection] of this.activeConnections) {
      try {
        connection.close();
      } catch (error) {
        logger.error(`Error closing connection for user ${userId}:`, error);
      }
    }
    this.activeConnections.clear();
    logger.info('All WebSocket connections closed');
  }
}

export default InAppService;
