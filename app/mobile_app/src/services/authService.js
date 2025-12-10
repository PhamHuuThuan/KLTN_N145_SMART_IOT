import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import environment from '../config/environment';
import { createLogger } from '../utils/logger';
import { handleUnauthorized } from '../utils/authHandler';

const authClient = axios.create({
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
      await handleUnauthorized();
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
      
      let errorMessage = 'Đăng ký thất bại';
      
      if (error.response?.status === 400 || error.response?.status === 409) {
        const backendError = error.response?.data?.error || error.response?.data?.message || '';
        const errorLower = backendError.toLowerCase();
        
        if (errorLower.includes('email') && (errorLower.includes('already') || errorLower.includes('exists') || errorLower.includes('duplicate'))) {
          errorMessage = 'Email này đã được sử dụng';
        } else if (errorLower.includes('email') && errorLower.includes('required')) {
          errorMessage = 'Vui lòng nhập email';
        } else if (errorLower.includes('password') && errorLower.includes('required')) {
          errorMessage = 'Vui lòng nhập mật khẩu';
        } else if (errorLower.includes('name') && errorLower.includes('required')) {
          errorMessage = 'Vui lòng nhập họ và tên';
        } else if (backendError) {
          errorMessage = backendError;
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
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
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = 'Đăng nhập thất bại';
      
      if (error.response?.status === 401) {
        errorMessage = 'Email hoặc mật khẩu không đúng';
      } else if (error.response?.status === 400) {
        errorMessage = 'Thông tin đăng nhập không hợp lệ';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
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
      this.log.error('Failed to change password:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = 'Đổi mật khẩu thất bại';
      
      if (error.response?.status === 400) {
        const backendError = error.response?.data?.error;
        if (backendError === 'current_password_incorrect') {
          errorMessage = 'Mật khẩu hiện tại không đúng';
        } else if (backendError === 'new_password_must_be_at_least_6_characters') {
          errorMessage = 'Mật khẩu mới phải có ít nhất 6 ký tự';
        } else if (backendError === 'current_password and new_password are required') {
          errorMessage = 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới';
        } else if (backendError) {
          errorMessage = backendError;
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async forgotPassword(email) {
    try {
      this.log.info('Requesting password reset for:', email);
      
      const response = await authClient.post('/auth/forgot-password', {
        email,
      });
      
      this.log.info('Password reset request sent successfully');
      return { success: true, message: response.data.message };
    } catch (error) {
      this.log.error('Failed to request password reset:', error.message);
      const errorMessage = error.response?.data?.error || 'Failed to request password reset';
      return { success: false, error: errorMessage };
    }
  }

  async verifyResetCode(email, code) {
    try {
      this.log.info('Verifying reset code for:', email);
      
      const response = await authClient.post('/auth/verify-reset-code', {
        email,
        code,
      });
      
      this.log.info('Reset code verified successfully');
      return { success: true, message: response.data.message, expiresAt: response.data.expiresAt };
    } catch (error) {
      this.log.error('Failed to verify reset code:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = 'Mã xác nhận không hợp lệ';
      
      if (error.response?.status === 400) {
        errorMessage = 'Mã xác nhận không đúng hoặc đã hết hạn';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy mã xác nhận';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async resetPassword(email, code, newPassword) {
    try {
      this.log.info('Resetting password for:', email);
      
      const response = await authClient.post('/auth/reset-password', {
        email,
        code,
        newPassword,
      });
      
      this.log.info('Password reset successfully');
      return { success: true, message: response.data.message };
    } catch (error) {
      this.log.error('Failed to reset password:', error.message);
      const errorMessage = error.response?.data?.error || 'Failed to reset password';
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
