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
  async getTelemetryHistory(deviceId, hours = 24) {
    try {
      const response = await api.get(`/api/logs/${deviceId}/history`, {
        params: { hours }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching telemetry history:', error);
      throw error;
    }
  }
}

export default new DevicesService();
