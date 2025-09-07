// Configuration constants for Smart IoT Kitchen Mobile App
import environment from '../config/environment';

export const CONFIG = {
  // API Configuration
  API_BASE_URL: environment.getApiUrl(), // Dynamic API URL based on environment
  
  // Refresh intervals (in milliseconds)
  AUTO_REFRESH_INTERVAL: 5000, // 5 seconds
  
  // API Endpoints - Updated for devices-service
  ENDPOINTS: {
    DEVICES: '/api/devices',                    // GET all devices
    STATUS: '/api/devices/status',              // GET general status
    DEVICE_STATUS: '/api/devices/:deviceId/status', // GET device status
    OUTLET_TOGGLE: '/api/devices/:deviceId/outlets/:outletId/toggle', // PUT toggle outlet
    OUTLET_UPDATE: '/api/devices/:deviceId/outlets/:outletId', // PUT update outlet settings
  },
  
  // UI Configuration
  COLORS: {
    primary: '#2C3E50',
    secondary: '#3498DB',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    info: '#9B59B6',
    light: '#F8F9FA',
    dark: '#2C3E50',
    white: '#FFFFFF',
    gray: '#6C757D',
  },
  
  // Sensor thresholds
  THRESHOLDS: {
    temperature: {
      min: 0,
      max: 50,
      warning: 35,
    },
    humidity: {
      min: 0,
      max: 100,
      warning: 80,
    },
    gasPpm: {
      min: 0,
      max: 10000,
      warning: 1000,
    },
    mq2Voltage: {
      min: 0,
      max: 5,
      warning: 2,
    },
  },
  
  // UI Dimensions
  DIMENSIONS: {
    borderRadius: 12,
    cardPadding: 15,
    buttonHeight: 48,
    sensorCardHeight: 120,
  },
};

export default CONFIG;
