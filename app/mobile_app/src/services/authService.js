import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';

const authClient = axios.create({
  // Route auth via API Gateway as well
  baseURL: environment.getApiUrl('GATEWAY') || 'http://127.0.0.1:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

authClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

class AuthService {
  constructor() {
    this.log = createLogger('AuthService');
  }

  async register(email, password, name) {
    try {
      this.log.info('Attempting to register user:', email);
      
      const response = await authClient.post('/auth/register', {
        email,
        password,
        name,
      });
      
      const { token, user } = response.data;
      
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      this.log.info('Registration successful for user:', email);
      return { success: true, user, token };
    } catch (error) {
      this.log.error('Registration failed:', {
        email,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      return { success: false, error: errorMessage };
    }
  }

  async login(email, password) {
    try {
      this.log.info('Attempting to login user:', email);
      
      const response = await authClient.post('/auth/login', {
        email,
        password,
      });
      
      const { token, user } = response.data;
      
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      this.log.info('Login successful for user:', email);
      return { success: true, user, token };
    } catch (error) {
      this.log.error('Login failed:', {
        email,
        message: error.message,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.error || 'Login failed';
      return { success: false, error: errorMessage };
    }
  }

  async getProfile() {
    try {
      this.log.debug('Getting user profile');
      
      const response = await authClient.get('/auth/me');
      const { user } = response.data;
      
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      this.log.debug('Profile retrieved successfully');
      return { success: true, user };
    } catch (error) {
      this.log.error('Failed to get profile:', error.message);
      const errorMessage = error.response?.data?.error || 'Failed to get profile';
      return { success: false, error: errorMessage };
    }
  }

  async updateProfile(name, phone, avatar) {
    try {
      this.log.info('Updating user profile');
      
      const response = await authClient.patch('/auth/profile', {
        name,
        phone,
        avatar,
      });
      
      const { user } = response.data;
      
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      this.log.info('Profile updated successfully');
      return { success: true, user };
    } catch (error) {
      this.log.error('Failed to update profile:', error.message);
      const errorMessage = error.response?.data?.error || 'Failed to update profile';
      return { success: false, error: errorMessage };
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      this.log.info('Changing user password');
      
      const response = await authClient.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      
      this.log.info('Password changed successfully');
      return { success: true, message: response.data.message };
    } catch (error) {
      this.log.error('Failed to change password:', error.message);
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      return { success: false, error: errorMessage };
    }
  }

  async logout() {
    try {
      this.log.info('User logging out');
      
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      
      this.log.info('Logout successful');
      return { success: true };
    } catch (error) {
      this.log.error('Logout failed:', error.message);
      return { success: false, error: 'Logout failed' };
    }
  }

  async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (token && userData) {
        this.log.debug('User is authenticated');
        return { 
          isAuthenticated: true, 
          user: JSON.parse(userData),
          token 
        };
      }
      
      this.log.debug('User is not authenticated');
      return { isAuthenticated: false };
    } catch (error) {
      this.log.error('Error checking authentication:', error.message);
      return { isAuthenticated: false };
    }
  }

  async getUserData() {
    try {
      this.log.debug('Getting user data from storage');
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      this.log.error('Error getting user data:', error.message);
      return null;
    }
  }
}

export default new AuthService();
