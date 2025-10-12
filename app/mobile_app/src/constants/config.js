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
    DEVICE_DETAIL: '/api/devices/:deviceId',    // GET device by id (full info)
    OUTLET_TOGGLE: '/api/devices/:deviceId/outlets/:outletId/toggle', // PUT toggle outlet
    OUTLET_UPDATE: '/api/devices/:deviceId/outlets/:outletId', // PUT update outlet settings
    EMERGENCY_ENTER: '/api/devices/:deviceId/emergency/enter', // PUT enter emergency mode
    EMERGENCY_EXIT: '/api/devices/:deviceId/emergency/exit',   // PUT exit emergency mode
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

  // Theme colors will be provided by ThemeContext
  // This is kept for backward compatibility
  THEME: {
    primary: '#2563EB',      // blue-600
    secondary: '#14B8A6',    // teal-500
    success: '#22C55E',      // green-500
    danger: '#EF4444',       // red-500
    info: '#8B5CF6',         // violet-500
    gray: '#94A3B8',         // slate-400
    grayLight: '#CBD5E1',    // slate-300
    surface: '#FFFFFF',      // white
    background: '#F1F5F9',   // slate-100
    border: '#E2E8F0',       // slate-200
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
