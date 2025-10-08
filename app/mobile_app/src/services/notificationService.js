import axios from 'axios';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';

const log = createLogger('Notifications');

class NotificationService {
  constructor() {
    const gatewayUrl = environment.getApiUrl('GATEWAY');
    this.baseUrl = `${gatewayUrl}/api/notifications`;
    this.authToken = null;
    this.client = null; // Cache axios client
    
    // Minimal init log
    log.info('Initialized', this.baseUrl);
  }

  // Set auth token (should be called from AuthContext)
  setAuthToken(token) {
    this.authToken = token;
    this.client = null; // Reset client to recreate with new token
    log.debug('Auth token set');
  }

  // Clear auth token
  clearAuthToken() {
    this.authToken = null;
    this.client = null; // Reset client
    log.debug('Auth token cleared');
  }

  getApiClient() {
    // Return cached client if exists and token hasn't changed
    if (this.client) {
      return this.client;
    }
    
    // Create axios client
    
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
        log.info(`${(config.method || 'GET').toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        log.error('Request error', error?.message || error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        log.info(`${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url;
        log.error('Response error', status ? `${status} ${url}` : error?.message || String(error));
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
      log.warn('Could not get auth token', error?.message || error);
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
      log.error('getNotifications error', error?.message || error);
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
      log.error('markAsRead error', error?.message || error);
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
      log.error('markAllAsRead error', error?.message || error);
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
      log.error('deleteNotification error', error?.message || error);
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
      log.error('getNotificationStats error', error?.message || error);
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
      log.error('getPreferences error', error?.message || error);
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
      log.error('updatePreferences error', error?.message || error);
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
      log.error('addFCMToken error', error?.message || error);
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
      log.error('removeFCMToken error', error?.message || error);
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
      log.error('testNotification error', error?.message || error);
      return {
        success: false,
        message: error.message,
        data: null
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
