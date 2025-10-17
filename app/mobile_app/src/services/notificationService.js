import axios from 'axios';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';

const log = createLogger('Notifications');

class NotificationService {
  constructor() {
    const gatewayUrl = environment.getApiUrl('GATEWAY');
    this.baseUrl = `${gatewayUrl}/api/notifications`;
    this.authToken = null;
    this.client = null;
    
    log.info('Initialized', this.baseUrl);
  }

  // Set auth token
  setAuthToken(token) {
    this.authToken = token;
    this.client = null;
    log.debug('Auth token set');
  }

  // Clear auth token
  clearAuthToken() {
    this.authToken = null;
    this.client = null;
    log.debug('Auth token cleared');
  }

  getApiClient() {
    if (this.client) {
      return this.client;
    }
    
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
    try {
      if (this.authToken) {
        return this.authToken;
      }
      
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

  createDemoNotifications() {
    return [
    ];
  }
}

export const notificationService = new NotificationService();
