import axios from 'axios';
import CONFIG from '../constants/config';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';

const log = createLogger('API');

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: environment.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add these for web compatibility
  withCredentials: false,
  // For development, allow self-signed certificates
  ...(environment.IS_WEB && {
    // Add any web-specific configurations here
  }),
});

// Auth token management
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

export const clearAuthToken = () => {
  authToken = null;
  delete apiClient.defaults.headers.common['Authorization'];
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    log.info(`${(config.method || 'GET').toUpperCase()} ${environment.API_BASE_URL}${config.url}`);
    return config;
  },
  (error) => {
    log.error('Request error', error?.message || error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Keep response log concise at info level
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

// API Service class
class ApiService {
  // Generic HTTP methods
  async get(url, config = {}) {
    try {
      const response = await apiClient.get(url, config);
      return response;
    } catch (error) {
      throw new Error(`GET request failed: ${error.message}`);
    }
  }

  async post(url, data = {}, config = {}) {
    try {
      const response = await apiClient.post(url, data, config);
      return response;
    } catch (error) {
      throw new Error(`POST request failed: ${error.message}`);
    }
  }

  async put(url, data = {}, config = {}) {
    try {
      const response = await apiClient.put(url, data, config);
      return response;
    } catch (error) {
      throw new Error(`PUT request failed: ${error.message}`);
    }
  }

  async patch(url, data = {}, config = {}) {
    try {
      const response = await apiClient.patch(url, data, config);
      return response;
    } catch (error) {
      throw new Error(`PATCH request failed: ${error.message}`);
    }
  }

  async delete(url, config = {}) {
    try {
      const response = await apiClient.delete(url, config);
      return response;
    } catch (error) {
      throw new Error(`DELETE request failed: ${error.message}`);
    }
  }

  // Get all devices
  async getDevices() {
    try {
      const response = await apiClient.get(CONFIG.ENDPOINTS.DEVICES);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch devices: ${error.message}`);
    }
  }

  // Get general status
  async getStatus() {
    try {
      const response = await apiClient.get(CONFIG.ENDPOINTS.STATUS);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch status: ${error.message}`);
    }
  }

  // Get device status
  async getDeviceStatus(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.DEVICE_STATUS.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch device status: ${error.message}`);
    }
  }

  // Get full device details
  async getDeviceDetail(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.DEVICE_DETAIL.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch device detail: ${error.message}`);
    }
  }

  // Toggle outlet
  async toggleOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      log.debug('toggleOutlet', url);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      log.error('toggleOutlet error', error?.message || error);
      throw new Error(`Failed to toggle outlet: ${error.message}`);
    }
  }

  // Turn outlet ON
  async turnOnOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      log.debug('turnOnOutlet', url);
      const response = await apiClient.put(url, { status: true });
      return response.data;
    } catch (error) {
      log.error('turnOnOutlet error', error?.message || error);
      throw new Error(`Failed to turn on outlet: ${error.message}`);
    }
  }

  // Turn outlet OFF
  async turnOffOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      log.debug('turnOffOutlet', url);
      const response = await apiClient.put(url, { status: false });
      return response.data;
    } catch (error) {
      log.error('turnOffOutlet error', error?.message || error);
      throw new Error(`Failed to turn off outlet: ${error.message}`);
    }
  }

  // Update outlet settings
  async updateOutletSettings(deviceId, outletId, settings) {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_UPDATE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url, settings);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update outlet settings: ${error.message}`);
    }
  }

  // Enter emergency mode on a device
  async enterEmergencyMode(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.EMERGENCY_ENTER.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to enter emergency mode: ${error.message}`);
    }
  }

  // Exit emergency mode on a device
  async exitEmergencyMode(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.EMERGENCY_EXIT.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to exit emergency mode: ${error.message}`);
    }
  }

  async getDeviceDetail(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.DEVICE_DETAIL.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch device detail: ${error.message}`);
    }
  }

  async getDeviceStatus(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.DEVICE_STATUS.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch device status: ${error.message}`);
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await apiClient.get(CONFIG.ENDPOINTS.DEVICES);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const apiService = new ApiService();
export { apiService };
export default apiService;
