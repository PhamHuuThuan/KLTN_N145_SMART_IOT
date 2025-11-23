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
  if (Platform.OS === 'android') return '127.0.0.1';
  if (Platform.OS === 'ios') return '127.0.0.1';
  return '127.0.0.1';
};

const ENV = {
  // Server URLs (only expose API Gateway to clients)
  GATEWAY: {
    HTTP: `http://${getLocalIP()}:3000`,
    HTTPS: `https://${getLocalIP()}:3000`,
    LOCAL: 'http://127.0.0.1:3000',
  },

  // Current API Configuration → route everything via API Gateway
  API_BASE_URL: Constants.expoConfig?.extra?.apiUrl || `http://${getLocalIP()}:3000`,
  
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
const getApiUrl = (service = 'GATEWAY') => {
  // Priority 1: Use explicit API_URL from app.json extra (set via app.config.js from .env)
  const extra = Constants.expoConfig?.extra || {};
  if (extra.apiUrl) {
    const url = String(extra.apiUrl);
    console.log(`[ENV] Using API URL from app.json extra: ${url}`);
    return url;
  }
  
  // Priority 2: Use ENV.API_BASE_URL (also from app.json extra)
  if (ENV.API_BASE_URL && ENV.API_BASE_URL !== `http://${getLocalIP()}:3000`) {
    console.log(`[ENV] Using API_BASE_URL: ${ENV.API_BASE_URL}`);
    return ENV.API_BASE_URL;
  }
  
  // Priority 3: Fallback to service-specific URL
  const tunnelMode = isTunnelMode();
  const url = tunnelMode ? ENV[service].HTTPS : ENV[service].HTTP;
  console.log(`[ENV] Using fallback URL for ${service}: ${url}`);
  return url;
};

export default {
  ...ENV,
  isTunnelMode,
  getApiUrl,
};
