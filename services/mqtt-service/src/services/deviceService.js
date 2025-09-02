const axios = require('axios');

class DeviceService {
  constructor() {
    this.deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3002';
    this.deviceCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.validationEnabled = process.env.DEVICE_VALIDATION_ENABLED !== 'false';
  }

  async getDevice(deviceId) {
    try {
      // Check cache first
      const cached = this.deviceCache.get(deviceId);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.device;
      }

      // Fetch from devices-service
      const response = await axios.get(`${this.deviceServiceUrl}/api/devices/${deviceId}`, {
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data.success) {
        const device = response.data.data;
        
        // Cache the result
        this.deviceCache.set(deviceId, {
          device,
          timestamp: Date.now()
        });
        
        return device;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error fetching device ${deviceId}:`, error.message);
      
      // Fallback: if devices-service is down, allow known devices
      const knownDevices = ['KITCHEN-ESP32-LED1', 'LIVING-ROOM-ESP32'];
      if (knownDevices.includes(deviceId)) {
        console.log(`⚠️ Using fallback for known device: ${deviceId}`);
        return { deviceId, status: 'online' };
      }
      
      return null;
    }
  }

  async getAllDevices() {
    try {
      const response = await axios.get(`${this.deviceServiceUrl}/api/devices`);
      
      if (response.data.success) {
        const devices = response.data.data;
        
        // Update cache
        devices.forEach(device => {
          this.deviceCache.set(device.deviceId, {
            device,
            timestamp: Date.now()
          });
        });
        
        return devices;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error fetching all devices:', error.message);
      return [];
    }
  }

  async isValidDevice(deviceId) {
    // Skip validation if disabled
    if (!this.validationEnabled) {
      console.log(`⚠️ Device validation disabled - allowing ${deviceId}`);
      return true;
    }

    const device = await this.getDevice(deviceId);
    console.log(`🔍 Device validation for ${deviceId}:`, device ? 'Found' : 'Not found');
    if (device) {
      console.log(`🔍 Device status: ${device.status || 'undefined'}`);
      // Device is valid if it exists and is not in error or maintenance mode
      const isValid = device.status !== 'error' && device.status !== 'maintenance';
      console.log(`🔍 Device valid: ${isValid}`);
      return isValid;
    }
    return false;
  }

  clearCache() {
    this.deviceCache.clear();
  }

  getCachedDevices() {
    const now = Date.now();
    const validDevices = [];
    
    for (const [deviceId, cached] of this.deviceCache.entries()) {
      if (now - cached.timestamp < this.cacheExpiry) {
        validDevices.push(cached.device);
      }
    }
    
    return validDevices;
  }
}

module.exports = new DeviceService();
