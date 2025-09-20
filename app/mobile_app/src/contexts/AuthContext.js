import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { notificationService } from '../services/notificationService';
import * as Notifications from 'expo-notifications';

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
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setToken(null);
        // Clear token for notification service
        notificationService.clearAuthToken();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
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
        setUser(profile?.success && profile.user ? profile.user : result.user);
        setIsAuthenticated(true);
        setToken(result.token);
        // Set token for notification service
        notificationService.setAuthToken(result.token);
        
        // Register FCM token after successful login
        try {
          await registerFCMToken(result.user.id);
        } catch (fcmError) {
          console.warn('FCM token registration failed during login:', fcmError);
          // Don't fail login if FCM registration fails
        }
        
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, name) => {
    try {
      setIsLoading(true);
      const result = await authService.register(email, password, name);
      
      if (result.success) {
        const profile = await authService.getProfile();
        setUser(profile?.success && profile.user ? profile.user : result.user);
        setIsAuthenticated(true);
        setToken(result.token);
        // Set token for notification service
        notificationService.setAuthToken(result.token);
        
        // Register FCM token after successful registration
        try {
          await registerFCMToken(result.user.id);
        } catch (fcmError) {
          console.warn('FCM token registration failed during registration:', fcmError);
          // Don't fail registration if FCM registration fails
        }
        
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      setToken(null);
      // Clear token for notification service
      notificationService.clearAuthToken();
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
        console.warn('No userId provided for FCM token registration');
        return;
      }

      // Get FCM token
      const token = await Notifications.getExpoPushTokenAsync();

      if (token && token.data) {
        console.log('🔔 Native push token acquired:', token);
        
        // Register token with notification service
        const result = await notificationService.addFCMToken(userId, token.data, 'android');
        
        if (result.success) {
          console.log('✅ FCM token registered successfully');
        } else {
          console.warn('⚠️ FCM token registration failed:', result.message);
        }
      } else {
        console.warn('No FCM token available');
      }
    } catch (error) {
      console.error('Error registering FCM token:', error);
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
    refreshProfile,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
