import axios from 'axios';
import CONFIG from '../constants/config';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';
import { handleUnauthorized } from '../utils/authHandler';

const log = createLogger('API');


const apiClient = axios.create({
  baseURL: environment.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
  ...(environment.IS_WEB && {
  }),
});

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


apiClient.interceptors.response.use(
  (response) => {
    log.info(`${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;
    log.error('Response error', status ? `${status} ${url}` : error?.message || String(error));
    
    if (status === 401) {
      await handleUnauthorized();
    }
    
    return Promise.reject(error);
  }
);

class ApiService {
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

  async getDevices(page = 1, limit = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      const response = await apiClient.get(`${CONFIG.ENDPOINTS.DEVICES}?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch devices: ${error.message}`);
    }
  }

  async getStatus() {
    try {
      const response = await apiClient.get(CONFIG.ENDPOINTS.STATUS);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch status: ${error.message}`);
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

  async getDeviceDetail(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.DEVICE_DETAIL.replace(':deviceId', deviceId);
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch device detail: ${error.message}`);
    }
  }

  async toggleOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      log.error('toggleOutlet error', error?.message || error);
      throw new Error(`Failed to toggle outlet: ${error.message}`);
    }
  }

  async turnOnOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url, { status: true });
      return response.data;
    } catch (error) {
      log.error('turnOnOutlet error', error?.message || error);
      throw new Error(`Failed to turn on outlet: ${error.message}`);
    }
  }

  async turnOffOutlet(deviceId, outletId = 'o1') {
    try {
      const url = CONFIG.ENDPOINTS.OUTLET_TOGGLE
        .replace(':deviceId', deviceId)
        .replace(':outletId', outletId);
      const response = await apiClient.put(url, { status: false });
      return response.data;
    } catch (error) {
      log.error('turnOffOutlet error', error?.message || error);
      throw new Error(`Failed to turn off outlet: ${error.message}`);
    }
  }

  async testBuzzer(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.BUZZER_TEST.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      log.error('testBuzzer error', error?.message || error);
      throw new Error(`Failed to test buzzer: ${error.message}`);
    }
  }

  async turnOnBuzzer(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.BUZZER_ON.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      log.error('turnOnBuzzer error', error?.message || error);
      throw new Error(`Failed to turn on buzzer: ${error.message}`);
    }
  }

  async turnOffBuzzer(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.BUZZER_OFF.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      log.error('turnOffBuzzer error', error?.message || error);
      throw new Error(`Failed to turn off buzzer: ${error.message}`);
    }
  }

  async removeDeviceOwnership(deviceId) {
    try {
      const url = `/api/devices/${deviceId}/ownership`;
      const response = await apiClient.delete(url);
      return response.data;
    } catch (error) {
      log.error('removeDeviceOwnership error', error?.message || error);
      throw new Error(`Failed to remove device ownership: ${error.message}`);
    }
  }

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

  async enterEmergencyMode(deviceId) {
    try {
      const url = CONFIG.ENDPOINTS.EMERGENCY_ENTER.replace(':deviceId', deviceId);
      const response = await apiClient.put(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to enter emergency mode: ${error.message}`);
    }
  }

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

  async getTelemetryHistory(deviceId, hours = 24, sensorType = null, startDate = null, endDate = null) {
    try {
      const params = new URLSearchParams();
      params.append('hours', hours.toString());
      if (sensorType) {
        params.append('sensorType', sensorType);
      }
      if (startDate) {
        params.append('startDate', startDate instanceof Date ? startDate.toISOString() : startDate);
      }
      if (endDate) {
        params.append('endDate', endDate instanceof Date ? endDate.toISOString() : endDate);
      }
      const url = `/api/logs/${deviceId}/history?${params.toString()}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      log.error('getTelemetryHistory error', error?.message || error);
      throw new Error(`Failed to fetch telemetry history: ${error.message}`);
    }
  }

}
const apiService = new ApiService();
export { apiService };
export default apiService;

