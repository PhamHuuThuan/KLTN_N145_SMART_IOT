import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import environment from '../config/environment';

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
  async register(email, password, name) {
    try {
      console.log('🚀 AuthService: Attempting to register user:', { email, name });
      console.log('🌐 AuthService: Base URL:', authClient.defaults.baseURL);
      
      const response = await authClient.post('/auth/register', {
        email,
        password,
        name,
      });
      
      console.log('✅ AuthService: Registration successful:', response.data);
      
      const { token, user } = response.data;
      
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      return { success: true, user, token };
    } catch (error) {
      console.error('❌ AuthService: Registration failed:', error);
      console.error('❌ AuthService: Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      return { success: false, error: errorMessage };
    }
  }

  async login(email, password) {
    try {
      const response = await authClient.post('/auth/login', {
        email,
        password,
      });
      
      const { token, user } = response.data;
      
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      return { success: true, user, token };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      return { success: false, error: errorMessage };
    }
  }

  async getProfile() {
    try {
      const response = await authClient.get('/auth/me');
      const { user } = response.data;
      
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      return { success: true, user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to get profile';
      return { success: false, error: errorMessage };
    }
  }

  async updateProfile(name, phone, avatar) {
    try {
      const response = await authClient.patch('/auth/profile', {
        name,
        phone,
        avatar,
      });
      
      const { user } = response.data;
      
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      return { success: true, user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to update profile';
      return { success: false, error: errorMessage };
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      const response = await authClient.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      return { success: false, error: errorMessage };
    }
  }

  async logout() {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  }

  async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (token && userData) {
        return { 
          isAuthenticated: true, 
          user: JSON.parse(userData),
          token 
        };
      }
      
      return { isAuthenticated: false };
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  async getUserData() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }
}

export default new AuthService();
