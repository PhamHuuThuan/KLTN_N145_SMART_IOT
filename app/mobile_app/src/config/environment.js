// Environment configuration for Smart IoT Kitchen Mobile App
import Constants from 'expo-constants';

// Get local IP address
const getLocalIP = () => {
  // For development, use the same IP as the server
  return '127.0.0.1';
};

const ENV = {
  // Server URLs
  DEVICES_SERVICE: {
    HTTP: `http://${getLocalIP()}:3001`,
    HTTPS: `https://${getLocalIP()}:3001`,
    LOCAL: 'http://127.0.0.1:3001',
  },
  
  MQTT_SERVICE: {
    HTTP: `http://${getLocalIP()}:3000`,
    HTTPS: `https://${getLocalIP()}:3000`,
    LOCAL: 'http://127.0.0.1:3000',
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
