import { apiService } from './apiService';

class NotificationService {
  constructor() {
    this.baseUrl = '/api/notifications';
  }

  // Get user notifications with pagination
  async getNotifications(page = 1, limit = 20, filters = {}) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });

      const response = await apiService.get(`${this.baseUrl}/user/current?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const response = await apiService.patch(
        `${this.baseUrl}/${notificationId}/read/current`
      );
      return response.data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const response = await apiService.patch(`${this.baseUrl}/user/current/read-all`);
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const response = await apiService.delete(
        `${this.baseUrl}/${notificationId}/user/current`
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get notification statistics
  async getNotificationStats() {
    try {
      const response = await apiService.get(`${this.baseUrl}/user/current/stats`);
      return response.data;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  // Get user notification preferences
  async getPreferences() {
    try {
      const response = await apiService.get(`${this.baseUrl}/user/current/preferences`);
      return response.data;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  // Update user notification preferences
  async updatePreferences(preferences) {
    try {
      const response = await apiService.put(
        `${this.baseUrl}/user/current/preferences`,
        preferences
      );
      return response.data;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Add FCM token
  async addFCMToken(token, platform) {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/user/current/fcm-token`,
        { token, platform }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding FCM token:', error);
      throw error;
    }
  }

  // Remove FCM token
  async removeFCMToken(token) {
    try {
      const response = await apiService.delete(
        `${this.baseUrl}/user/current/fcm-token`,
        { data: { token } }
      );
      return response.data;
    } catch (error) {
      console.error('Error removing FCM token:', error);
      throw error;
    }
  }

  // Test notification
  async testNotification(methods = ['inApp']) {
    try {
      const response = await apiService.post(
        `${this.baseUrl}/user/current/test`,
        { methods }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  // Create demo notifications for testing
  createDemoNotifications() {
    return [
      {
        id: 'demo-1',
        title: 'Cảnh báo nhiệt độ',
        message: 'Nhiệt độ trong bếp đã vượt quá 35°C. Hãy kiểm tra thiết bị.',
        type: 'device_alert',
        category: 'sensor',
        priority: 'high',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        metadata: {
          deviceName: 'Cảm biến nhiệt độ bếp',
          sensorType: 'temperature',
          sensorValue: 36.5,
          threshold: 35,
        },
      },
      {
        id: 'demo-2',
        title: 'Thiết bị đã tắt',
        message: 'Ổ cắm thông minh "Quạt bếp" đã được tắt thành công.',
        type: 'system_notification',
        category: 'outlet',
        priority: 'low',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        metadata: {
          deviceName: 'Quạt bếp',
          action: 'turn_off',
        },
      },
      {
        id: 'demo-3',
        title: 'Bảo trì hệ thống',
        message: 'Hệ thống sẽ được bảo trì vào lúc 02:00 - 04:00 ngày mai.',
        type: 'maintenance',
        category: 'system',
        priority: 'medium',
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        metadata: {},
      },
      {
        id: 'demo-4',
        title: 'Cảnh báo khí gas',
        message: 'Phát hiện khí gas rò rỉ! Hãy kiểm tra ngay lập tức.',
        type: 'security_alert',
        category: 'security',
        priority: 'urgent',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
        metadata: {
          deviceName: 'Cảm biến khí gas',
          sensorType: 'gas',
          sensorValue: 85,
          threshold: 50,
        },
      },
      {
        id: 'demo-5',
        title: 'Quy tắc tự động kích hoạt',
        message: 'Quy tắc "Tự động bật quạt khi nhiệt độ cao" đã được kích hoạt.',
        type: 'system_notification',
        category: 'rule',
        priority: 'low',
        isRead: true,
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        metadata: {
          ruleId: 'rule-001',
          ruleName: 'Tự động bật quạt khi nhiệt độ cao',
        },
      },
    ];
  }
}

export const notificationService = new NotificationService();
