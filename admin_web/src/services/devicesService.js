import api from '../utils/api';

class DevicesService {
  // Get all devices
  async getAllDevices(params = {}) {
    try {
      const response = await api.get('/api/devices', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
  }

  // Get device by ID
  async getDeviceById(deviceId) {
    try {
      const response = await api.get(`/api/devices/${deviceId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device:', error);
      throw error;
    }
  }

  // Create new device
  async createDevice(deviceData) {
    try {
      const response = await api.post('/api/devices', deviceData);
      return response.data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  }

  // Update device
  async updateDevice(deviceId, deviceData) {
    try {
      const response = await api.patch(`/api/devices/${deviceId}`, deviceData);
      return response.data;
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  }

  // Delete device
  async deleteDevice(deviceId) {
    try {
      const response = await api.delete(`/api/devices/${deviceId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  }

  // Get device telemetry history
  // Note: When sensorType is not provided, backend may have issues with path collision
  // So we'll try to get all data by calling without sensorType, but handle errors gracefully
  async getTelemetryHistory(deviceId, hours = 24, sensorType = null) {
    try {
      const params = { hours };
      if (sensorType) {
        params.sensorType = sensorType;
      }
      
      const response = await api.get(`/api/logs/${deviceId}/history`, {
        params
      });
      // Return the full response data, which should include success flag and data array
      return response.data;
    } catch (error) {
      console.error('Error fetching telemetry history:', error);
      // Always return an object, never throw
      // This allows the component to handle errors gracefully
      if (error.response?.data) {
        // Server returned an error response with data
        return {
          success: false,
          message: error.response.data.message || error.response.data.error || 'Server error',
          error: error.response.data.error || error.response.data.message,
          status: error.response.status
        };
      }
      // Network error or other error without response
      return {
        success: false,
        message: error.message || 'Failed to fetch telemetry history',
        error: error.message || 'Network error',
        status: error.response?.status || 0
      };
    }
  }
}

export default new DevicesService();
