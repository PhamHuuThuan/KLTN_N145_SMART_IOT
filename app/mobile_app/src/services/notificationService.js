import axios from 'axios';
import environment from '../config/environment';

class NotificationService {
  constructor() {
    const serviceUrl = environment.getServiceUrl('ALERTS_SERVICE');
    this.baseUrl = `${serviceUrl}/api/notifications`;
    this.authToken = null;
    this.client = null; // Cache axios client
    
    // Log configuration on initialization
    console.log('🔔 NotificationService initialized:', this.baseUrl);
  }

  // Set auth token (should be called from AuthContext)
  setAuthToken(token) {
    this.authToken = token;
    this.client = null; // Reset client to recreate with new token
    console.log('🔔 Auth token set');
  }

  // Clear auth token
  clearAuthToken() {
    this.authToken = null;
    this.client = null; // Reset client
    console.log('🔔 Auth token cleared');
  }

  getApiClient() {
    // Return cached client if exists and token hasn't changed
    if (this.client) {
      return this.client;
    }
    
    // console.log('🔔 Creating axios client with baseURL:', this.baseUrl);
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔔 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ NotificationService Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ ${error.response?.status || 'ERROR'} ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );

    return this.client;
  }

  getAuthToken() {
    // Try to get token from various sources
    try {
      // First try the instance token
      if (this.authToken) {
        return this.authToken;
      }
      
      // Check if we have access to auth context
      if (typeof window !== 'undefined' && window.authToken) {
        return window.authToken;
      }
      
      // Check localStorage for web
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('authToken');
      }
      
      return null;
    } catch (error) {
      console.warn('Could not get auth token:', error);
      return null;
    }
  }

  // Get user notifications with pagination
  async getNotifications(userId, page = 1, limit = 20, filters = {}) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });

      const url = `/user/${userId}?${params}`;
      const response = await this.getApiClient().get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const url = `/${notificationId}/read/${userId}`;
      const response = await this.getApiClient().patch(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      const url = `/user/${userId}/read-all`;
      const response = await this.getApiClient().patch(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    try {
      const url = `/${notificationId}/user/${userId}`;
      
      const response = await this.getApiClient().delete(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Get notification statistics
  async getNotificationStats(userId) {
    try {
      const url = `/user/${userId}/stats`;
      
      const response = await this.getApiClient().get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Get user notification preferences
  async getPreferences(userId) {
    try {
      const url = `/user/${userId}/preferences`;
      
      const response = await this.getApiClient().get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Update user notification preferences
  async updatePreferences(userId, preferences) {
    try {
      const url = `/user/${userId}/preferences`;
      
      const response = await this.getApiClient().put(url, preferences);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Add FCM token
  async addFCMToken(userId, token, platform) {
    try {
      const url = `/user/${userId}/fcm-token`;
      
      const response = await this.getApiClient().post(url, { token, platform });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error adding FCM token:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Remove FCM token
  async removeFCMToken(userId, token) {
    try {
      const url = `/user/${userId}/fcm-token`;
      
      const response = await this.getApiClient().delete(url, { data: { token } });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error removing FCM token:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Test notification
  async testNotification(userId, methods = ['inApp']) {
    
    try {
      const url = `/user/${userId}/test`;
      
      const response = await this.getApiClient().post(url, { methods });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  // Test API connection
  async testConnection() {
    try {
      // Test with health endpoint first
      const healthResponse = await this.getApiClient().get('/health');
      console.log('✅ Health endpoint successful');
      
      // Try to get user preferences as a simple test
      const testUserId = 'test-user-id';
      const url = `/user/${testUserId}/preferences`;
      
      const response = await this.getApiClient().get(url);
      console.log('✅ API connection successful');
      return {
        success: true,
        message: 'API connection successful',
        status: response.status
      };
    } catch (error) {
      console.error('❌ API connection failed:', error);
      return {
        success: false,
        message: error.message,
        status: error.response?.status,
        error: error.response?.data
      };
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
