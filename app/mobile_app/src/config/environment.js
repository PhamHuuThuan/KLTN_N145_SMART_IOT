// Environment configuration for Smart IoT Kitchen Mobile App
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get local IP address (better defaults for emulators)
const getLocalIP = () => {
  // Prefer explicit config from app.json → extra.apiHost or extra.apiUrl
  const extra = Constants.expoConfig?.extra || {};
  if (extra.apiUrl) {
    try {
      const url = new URL(extra.apiUrl);
      return url.hostname;
    } catch {}
  }
  if (extra.apiHost) {
    return String(extra.apiHost);
  }
  // Emulator defaults
  if (Platform.OS === 'android') return '10.0.2.2';
  if (Platform.OS === 'ios') return '127.0.0.1';
  return '127.0.0.1';
};

const ENV = {
  // Server URLs
  DEVICES_SERVICE: {
    HTTP: `http://${getLocalIP()}:3002`,
    HTTPS: `https://${getLocalIP()}:3002`,
    LOCAL: 'http://127.0.0.1:3002',
  },
  
  MQTT_SERVICE: {
    HTTP: `http://${getLocalIP()}:3001`,
    HTTPS: `https://${getLocalIP()}:3001`,
    LOCAL: 'http://127.0.0.1:3001',
  },
  
  RULES_SERVICE: {
    HTTP: `http://${getLocalIP()}:3003`,
    HTTPS: `https://${getLocalIP()}:3003`,
    LOCAL: 'http://127.0.0.1:3003',
  },
  
  ALERTS_SERVICE: {
    HTTP: `http://${getLocalIP()}:3004`,
    HTTPS: `https://${getLocalIP()}:3004`,
    LOCAL: 'http://127.0.0.1:3004',
  },

  AUTH_SERVICE: {
    HTTP: `http://${getLocalIP()}:3005`,
    HTTPS: `https://${getLocalIP()}:3005`,
    LOCAL: 'http://127.0.0.1:3005',
  },
  
  // Current API Configuration (devices-service)
  API_BASE_URL: Constants.expoConfig?.extra?.apiUrl || `http://${getLocalIP()}:3002`,
  
  // Network Configuration
  USE_HTTPS: false,
  ALLOW_HTTP: true,
  
  // Platform detection
  IS_WEB: typeof window !== 'undefined',
  IS_MOBILE: typeof window === 'undefined',
  IS_TUNNEL: false, // Will be set dynamically
};

// Auto-detect if running in tunnel mode (HTTPS)
const isTunnelMode = () => {
  if (ENV.IS_WEB) {
    try {
      return window.location.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }
  return false;
};

// Get appropriate API URL based on environment
const getApiUrl = (service = 'DEVICES_SERVICE') => {
  const tunnelMode = isTunnelMode();
  
  if (tunnelMode) {
    // When using Expo tunnel, use local IP with HTTP
    return ENV[service].HTTP;
  }
  
  // For local development, use local IP
  return ENV[service].HTTP;
};

// Get service URL
const getServiceUrl = (service, useHttps = false) => {
  const serviceConfig = ENV[service];
  if (!serviceConfig) {
    throw new Error(`Service ${service} not found`);
  }
  
  return useHttps ? serviceConfig.HTTPS : serviceConfig.HTTP;
};

export default {
  ...ENV,
  isTunnelMode,
  getApiUrl,
  getServiceUrl,
};
