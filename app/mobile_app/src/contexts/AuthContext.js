import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import authService from '../services/authService';
import { notificationService } from '../services/notificationService';
import { setAuthToken, clearAuthToken } from '../services/apiService';
import chatSessionManager from '../services/chatSessionManager';
import * as Notifications from 'expo-notifications';
import { createLogger } from '../utils/logger';
import { LOGOUT_EVENT } from '../utils/authHandler';

const log = createLogger('Auth');

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);
  const logoutRef = useRef(null);

  useEffect(() => {
    checkAuthStatus();
    
    // Listen for logout events from services (e.g., when 401 occurs)
    const logoutListener = DeviceEventEmitter.addListener(LOGOUT_EVENT, () => {
      log.info('Logout event received - performing logout');
      if (logoutRef.current) {
        logoutRef.current();
      }
    });
    
    return () => {
      logoutListener.remove();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const authStatus = await authService.isAuthenticated();
      
      if (authStatus.isAuthenticated) {
        const profile = await authService.getProfile();
        if (profile?.success && profile.user) {
          setUser(profile.user);
        } else {
          setUser(authStatus.user);
        }
        setIsAuthenticated(true);
        setToken(authStatus.token);
        // Set token for notification service
        notificationService.setAuthToken(authStatus.token);
        setAuthToken(authStatus.token);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setToken(null);
        // Clear token for notification service
        notificationService.clearAuthToken();
      }
    } catch (error) {
      log.error('Error checking auth status', error?.message || error);
      setUser(null);
      setIsAuthenticated(false);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const result = await authService.login(email, password);
      
      if (result.success) {
        const profile = await authService.getProfile();
        const currentUser = profile?.success && profile.user ? profile.user : result.user;
        setUser(currentUser);
        setIsAuthenticated(true);
        setToken(result.token);
        // Set token for all services
        notificationService.setAuthToken(result.token);
        setAuthToken(result.token);
        
        // Initialize chat session for the logged-in user
        if (currentUser?.id) {
          try {
            await chatSessionManager.initializeSessionOnLogin(currentUser.id);
            log.info('Chat session initialized for user:', currentUser.id);
          } catch (chatError) {
            log.error('Failed to initialize chat session:', chatError);
          }
        }
        
        // Register FCM token after successful login
        try {
          await registerFCMToken(result.user.userId);
        } catch (fcmError) {
          log.warn('FCM token registration failed during login', fcmError?.message || fcmError);
        }
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Đăng nhập thất bại' };
      }
    } catch (error) {
      log.error('Login error:', error);
      return { success: false, error: 'Đăng nhập thất bại' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, name) => {
    try {
      const result = await authService.register(email, password, name);
      
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Remove FCM token and clear chat session before logout
      if (user?.id) {
        try {
          await removeFCMToken(user.userId);
        } catch (fcmError) {
          log.warn('Failed to remove FCM token during logout', fcmError?.message || fcmError);
        }
        
        // Clear chat session for the user
        try {
          await chatSessionManager.clearCurrentSession();
          log.info('Chat session cleared during logout');
        } catch (chatError) {
          log.warn('Failed to clear chat session during logout', chatError?.message || chatError);
          // Don't fail logout if chat session cleanup fails
        }
      }
      
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      setToken(null);
      // Clear token for all services
      notificationService.clearAuthToken();
      clearAuthToken();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    } finally {
      setIsLoading(false);
    }
  };

  // Store logout function in ref so it can be called from event listener
  // Using direct assignment is safe for refs and avoids dependency issues
  logoutRef.current = logout;

  const updateProfile = async (name, phone, avatar) => {
    try {
      setIsLoading(true);
      const result = await authService.updateProfile(name, phone, avatar);
      
      if (result.success) {
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Profile update failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      setIsLoading(true);
      const result = await authService.changePassword(currentPassword, newPassword);
      return result;
    } catch (error) {
      return { success: false, error: 'Password change failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const result = await authService.forgotPassword(email);
      return result;
    } catch (error) {
      return { success: false, error: 'Failed to request password reset' };
    }
  };

  const verifyResetCode = async (email, code) => {
    try {
      const result = await authService.verifyResetCode(email, code);
      return result;
    } catch (error) {
      return { success: false, error: 'Failed to verify reset code' };
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      const result = await authService.resetPassword(email, code, newPassword);
      return result;
    } catch (error) {
      return { success: false, error: 'Failed to reset password' };
    }
  };

  const refreshProfile = async () => {
    try {
      const result = await authService.getProfile();
      if (result.success) {
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Failed to refresh profile' };
    }
  };

  const registerFCMToken = async (userId) => {
    try {
      if (!userId) {
        return;
      }

      let fcmToken = null;
      let platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = devicePushToken?.data;
      } catch (nativeErr) {
        return;
      }

      if (!fcmToken) {
        log.warn('No FCM token available');
        return;
      }

      const result = await notificationService.addFCMToken(userId, fcmToken, platform);
      if (result?.success) {
      } else {
        log.warn('FCM token registration failed', result?.message);
      }
    } catch (error) {
      log.warn('Error registering FCM token (non-fatal)', error?.message || String(error));
    }
  };

  const removeFCMToken = async (userId) => {
    try {
      if (!userId) {
        log.warn('No userId provided for FCM token removal');
        return;
      }

      // Try to get the current FCM token to remove it
      let fcmToken = null;
      
      try {
        // Try to get device push token (preferred method)
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = devicePushToken?.data;
      } catch (deviceError) {
        
        try {
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: '5ea86a56-b10e-4a1b-88a7-6692b50872ed'
          });

          if (token.data.startsWith('ExponentPushToken[')) {
            return;
          } else {
            fcmToken = token.data;
          }
        } catch (expoError) {
          log.warn('Error getting Expo push token for removal', expoError?.message || expoError);
          fcmToken = null;
        }
      }

      // Remove token from notification service
      if (fcmToken) {
        const result = await notificationService.removeFCMToken(userId, fcmToken);
        
        if (result.success) {
          log.info('FCM token removed successfully for user', userId);
        } else {
          log.warn('FCM token removal failed', result.message);
          throw new Error(result.message || 'FCM token removal failed');
        }
      } else {
        log.info('No FCM token to remove for user', userId);
      }
    } catch (error) {
      log.error('Error removing FCM token', error?.message || error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    token,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    refreshProfile,
    checkAuthStatus,
    registerFCMToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
