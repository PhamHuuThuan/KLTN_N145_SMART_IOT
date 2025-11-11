import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { notificationService } from '../services/notificationService';
import { setAuthToken, clearAuthToken } from '../services/apiService';
import chatSessionManager from '../services/chatSessionManager';
import * as Notifications from 'expo-notifications';
import { createLogger } from '../utils/logger';

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

  useEffect(() => {
    checkAuthStatus();
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
          await registerFCMToken(result.user.id);
        } catch (fcmError) {
          log.warn('FCM token registration failed during login', fcmError?.message || fcmError);
          // Don't fail login if FCM registration fails
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
          await removeFCMToken(user.id);
          log.info('FCM token removed successfully during logout');
        } catch (fcmError) {
          log.warn('Failed to remove FCM token during logout', fcmError?.message || fcmError);
          // Don't fail logout if FCM token removal fails
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
        log.warn('No userId provided for FCM token registration');
        return;
      }

      // Prefer native device push token (FCM/APNs); avoid Expo token to prevent network dependency
      let fcmToken = null;
      let platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = devicePushToken?.data;
        log.info('Native push token acquired', fcmToken ? fcmToken.substring(0, 20) + '...' : null);
      } catch (nativeErr) {
        log.warn('Native device token not available. Skipping FCM registration.', nativeErr?.message || nativeErr);
        return; // do not throw to avoid UI errors
      }

      if (!fcmToken) {
        log.warn('No FCM token available');
        return;
      }

      // Register token with notification service via gateway
      const result = await notificationService.addFCMToken(userId, fcmToken, platform);
      if (result?.success) {
        log.info('FCM token registered successfully for user', userId);
        log.debug('Token count', result.data?.tokenCount);
      } else {
        log.warn('FCM token registration failed', result?.message);
      }
    } catch (error) {
      // Do not propagate failures to UI; just warn
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
        log.debug('Getting device push token for removal', fcmToken?.substring(0, 20) + '...');
      } catch (deviceError) {
        log.warn('Device push token not available, trying Expo push token', deviceError.message);
        
        try {
          // Fallback to Expo push token
          const token = await Notifications.getExpoPushTokenAsync({
            projectId: '5ea86a56-b10e-4a1b-88a7-6692b50872ed'
          });

          log.debug('Getting Expo push token for removal', token?.data?.substring(0, 20) + '...');
          
          // Check if it's a real FCM token or Expo push token
          if (token.data.startsWith('ExponentPushToken[')) {
            log.warn('Got Expo push token instead of FCM token - skipping removal');
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
    registerFCMToken, // Export FCM token registration function
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
