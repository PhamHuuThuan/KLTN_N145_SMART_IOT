import environment from '../config/environment';

export const CONFIG = {
  API_BASE_URL: environment.getApiUrl(),
  AUTO_REFRESH_INTERVAL: 5000,
  ENDPOINTS: {
    DEVICES: '/api/devices',
    DEVICE_STATUS: '/api/devices/:deviceId/status',
    DEVICE_DETAIL: '/api/devices/:deviceId',
    OUTLET_TOGGLE: '/api/devices/:deviceId/outlets/:outletId/toggle',
    OUTLET_UPDATE: '/api/devices/:deviceId/outlets/:outletId',
    BUZZER_TEST: '/api/devices/:deviceId/buzzer/test',
    BUZZER_ON: '/api/devices/:deviceId/buzzer/on',
    BUZZER_OFF: '/api/devices/:deviceId/buzzer/off',
    EMERGENCY_ENTER: '/api/devices/:deviceId/emergency/enter',
    EMERGENCY_EXIT: '/api/devices/:deviceId/emergency/exit',
  },
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
  THEME: {
    primary: '#2563EB',
    secondary: '#14B8A6',
    success: '#22C55E',
    danger: '#EF4444',
    info: '#8B5CF6',
    gray: '#94A3B8',
    grayLight: '#CBD5E1',
    surface: '#FFFFFF',
    background: '#F1F5F9',
    border: '#E2E8F0',
  },
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
  DIMENSIONS: {
    borderRadius: 12,
    cardPadding: 15,
    buttonHeight: 48,
    sensorCardHeight: 120,
  },
};

export default CONFIG;
