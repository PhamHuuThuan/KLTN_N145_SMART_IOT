import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { createLogger } from './logger';

const log = createLogger('AuthHandler');

export const LOGOUT_EVENT = 'AUTH_LOGOUT_REQUIRED';

export const handleUnauthorized = async () => {
  try {
    log.warn('401 Unauthorized detected - clearing auth data and triggering logout');
    
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
    
    DeviceEventEmitter.emit(LOGOUT_EVENT);
    
    log.info('Auth data cleared and logout event emitted');
  } catch (error) {
    log.error('Error handling unauthorized:', error?.message || error);
  }
};

