import axios from 'axios';
import CONFIG from '../constants/config';
import environment from '../config/environment';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
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

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

// API Service class
class ApiService {
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

  // Toggle outlet
  async toggleOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to toggle outlet: ${error.message}`);
    }
  }

  // Turn outlet ON
  async turnOnOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url, { status: true });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to turn on outlet: ${error.message}`);
    }
  }

  // Turn outlet OFF
  async turnOffOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url, { status: false });
      return response.data;
    } catch (error) {
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
export default new ApiService();
