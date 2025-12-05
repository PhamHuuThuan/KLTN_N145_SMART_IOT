import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getLocalIP = () => {
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
  if (Platform.OS === 'android') return '127.0.0.1';
  if (Platform.OS === 'ios') return '127.0.0.1';
  return '127.0.0.1';
};

const ENV = {
  GATEWAY: {
    HTTP: `http://${getLocalIP()}:3000`,
    HTTPS: `https://${getLocalIP()}:3000`,
    LOCAL: 'http://127.0.0.1:3000',
  },
  API_BASE_URL: Constants.expoConfig?.extra?.apiUrl || `http://${getLocalIP()}:3000`,
  USE_HTTPS: false,
  ALLOW_HTTP: true,
  IS_WEB: typeof window !== 'undefined',
  IS_MOBILE: typeof window === 'undefined',
  IS_TUNNEL: false,
};

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

const getApiUrl = (service = 'GATEWAY') => {
  const extra = Constants.expoConfig?.extra || {};
  if (extra.apiUrl) {
    return String(extra.apiUrl);
  }
  
  if (ENV.API_BASE_URL && ENV.API_BASE_URL !== `http://${getLocalIP()}:3000`) {
    return ENV.API_BASE_URL;
  }
  
  const tunnelMode = isTunnelMode();
  return tunnelMode ? ENV[service].HTTPS : ENV[service].HTTP;
};

export default {
  ...ENV,
  isTunnelMode,
  getApiUrl,
};
