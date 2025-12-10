import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { createLogger } from './logger';

const log = createLogger('AuthHandler');

// Event name for logout trigger
export const LOGOUT_EVENT = 'AUTH_LOGOUT_REQUIRED';

/**
 * Handle 401 Unauthorized errors by clearing tokens and triggering logout
 * This can be called from any service when a 401 error is detected
 */
export const handleUnauthorized = async () => {
  try {
    log.warn('401 Unauthorized detected - clearing auth data and triggering logout');
    
    // Clear tokens from storage
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
    
    // Emit event to trigger logout in AuthContext
    DeviceEventEmitter.emit(LOGOUT_EVENT);
    
    log.info('Auth data cleared and logout event emitted');
  } catch (error) {
    log.error('Error handling unauthorized:', error?.message || error);
  }
};

