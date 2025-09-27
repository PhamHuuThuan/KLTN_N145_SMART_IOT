import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { io } from 'socket.io-client';
import ENV from '../config/environment';
import { createLogger } from '../utils/logger';

const log = createLogger('NotifContext');

const NotificationContext = createContext();

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  refreshing: false,
};

// Action types
const NOTIFICATION_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  MARK_AS_READ: 'MARK_AS_READ',
  MARK_ALL_AS_READ: 'MARK_ALL_AS_READ',
  DELETE_NOTIFICATION: 'DELETE_NOTIFICATION',
  SET_REFRESHING: 'SET_REFRESHING',
  UPDATE_UNREAD_COUNT: 'UPDATE_UNREAD_COUNT',
};

// Reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case NOTIFICATION_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case NOTIFICATION_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case NOTIFICATION_ACTIONS.SET_NOTIFICATIONS:
      // Handle both array and object with notifications property
      const notifications = Array.isArray(action.payload) 
        ? action.payload 
        : action.payload.data?.notifications || [];
      
      return {
        ...state,
        notifications: notifications,
        unreadCount: notifications.filter(n => !n.isRead).length,
        loading: false,
        error: null,
      };
    
    case NOTIFICATION_ACTIONS.ADD_NOTIFICATION:
      const newNotifications = [action.payload, ...state.notifications];
      return {
        ...state,
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.isRead).length,
      };
    
    case NOTIFICATION_ACTIONS.MARK_AS_READ:
      const updatedNotifications = state.notifications.map(notification =>
        notification.id === action.payload
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      );
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.isRead).length,
      };
    
    case NOTIFICATION_ACTIONS.MARK_ALL_AS_READ:
      const allReadNotifications = state.notifications.map(notification => ({
        ...notification,
        isRead: true,
        readAt: new Date().toISOString(),
      }));
      return {
        ...state,
        notifications: allReadNotifications,
        unreadCount: 0,
      };
    
    case NOTIFICATION_ACTIONS.DELETE_NOTIFICATION:
      const filteredNotifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
      return {
        ...state,
        notifications: filteredNotifications,
        unreadCount: filteredNotifications.filter(n => !n.isRead).length,
      };
    
    case NOTIFICATION_ACTIONS.SET_REFRESHING:
      return { ...state, refreshing: action.payload };
    
    case NOTIFICATION_ACTIONS.UPDATE_UNREAD_COUNT:
      return { ...state, unreadCount: action.payload };
    
    default:
      return state;
  }
};

// Provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, isAuthenticated, logout, checkAuthStatus } = useAuth();

  // Configure notification behavior
  useEffect(() => {
    // Small in-memory window to prevent duplicates between Socket and FCM
    const recentKeys = new Set();
    let lastSocketAt = 0;
    const pushRecentKey = (key) => {
      if (!key) return;
      recentKeys.add(key);
      setTimeout(() => recentKeys.delete(key), 3000);
    };
    // Configure how notifications are handled when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Set notification handler for foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      // Do NOT update list/unread via FCM. Only use FCM to drive full-screen emergency UI.
      const data = notification?.request?.content?.data || {};
      const isEmergency = (data.priority || '').toLowerCase() === 'urgent' ||
                          (data.category || '').toLowerCase() === 'security' ||
                          (data.type || '').toLowerCase() === 'security_alert';
      if (!isEmergency) {
        log.debug('Ignore non-emergency FCM (socket handles list/unread)');
        return;
      }
      log.info('Emergency FCM (handled natively). Skipping list/unread.');
    });

    // Handle FCM data-only messages (when app is in foreground)
    const handleFCMDataMessage = (message) => {
      // Ignore FCM data messages for list/unread. Socket is the single source of truth.
      const data = (message && message.data) || {};
      const isEmergency = (data.priority || '').toLowerCase() === 'urgent' ||
                          (data.category || '').toLowerCase() === 'security' ||
                          (data.type || '').toLowerCase() === 'security_alert';
      if (!isEmergency) {
        log.debug('Ignore non-emergency FCM data');
        return;
      }
      log.info('Emergency FCM data — native layer handles full screen');
    };

    // Listen for FCM data messages from Android native code
    const fcmDataListener = DeviceEventEmitter.addListener('FCMDataMessage', (message) => {
      log.debug('FCMDataMessage from native', message);
      handleFCMDataMessage(message);
    });

    // WebSocket connection for real-time notifications with auto-reconnect
    let socket = null;
    const connectSocket = () => {
      try {
        const alertsUrl = ENV.getServiceUrl('ALERTS_SERVICE');
        
        socket = io(alertsUrl, {
          auth: user?.id ? { userId: user.id } : undefined,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
          forceNew: true
        });

        socket.on('connect', () => {
          log.info('WebSocket connected');
          log.debug('Socket ID', socket.id);
          // Send authentication once userId is available
          if (user?.id) {
            socket.emit('authenticate', { userId: user.id });
          } else {
            setTimeout(() => {
              if (user?.id && socket?.connected) {
                socket.emit('authenticate', { userId: user.id });
              }
            }, 1000);
          }
        });

        // Also authenticate after any reconnect
        socket.on('reconnect', () => {
          if (user?.id && socket?.connected) {
            socket.emit('authenticate', { userId: user.id });
          }
        });

        socket.on('notification', (notification) => {
          log.debug('WS notification received');
          
          // Map WebSocket notification to match API structure
          const notificationData = {
            id: notification.id || `ws_${Date.now()}`,
            title: notification.title || 'Notification',
            body: notification.message || notification.body || '',
            message: notification.message || notification.body || '', // Add message field for compatibility
            data: notification.metadata || {},
            metadata: notification.metadata || {}, // Add metadata field for compatibility
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            type: notification.type || 'system_notification',
            priority: notification.priority || 'low',
            category: notification.category || 'system',
            // Add additional fields that might be missing
            deviceId: notification.metadata?.deviceId,
            deviceName: notification.metadata?.deviceName,
            sensorType: notification.metadata?.sensorType,
            sensorValue: notification.metadata?.sensorValue,
            threshold: notification.metadata?.threshold,
            alertType: notification.metadata?.alertType
          };
          
          // Dedupe: record this key so upcoming FCM for same event is skipped
          const dedupeKey = `${notificationData.type}|${notificationData.title}|${notificationData.body}|${notificationData.deviceId || ''}|${notificationData.sensorType || ''}`;
          pushRecentKey(dedupeKey);
          lastSocketAt = Date.now();

          log.debug('Process WS notification', notificationData?.id);
          
          // Add to local state
          dispatch({
            type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
            payload: notificationData
          });
          
          // Update badge count
          const newBadgeCount = state.notifications.length + 1;
          Notifications.setBadgeCountAsync(newBadgeCount);
        });

        socket.on('disconnect', (reason) => {
          log.info('WebSocket disconnected', reason);
        });

        socket.on('error', (error) => {
          log.error('WebSocket error', error?.message || error);
        });

        socket.on('connect_error', (error) => {
          log.error('WebSocket connect_error', error?.message || error);
        });

      } catch (error) {
        log.error('WebSocket connection failed', error?.message || error);
      }
    };

    connectSocket();

    // Reconnect on auth changes
    const reconnectOnAuth = () => {
      if (socket) {
        try { socket.disconnect(); } catch {}
      }
      connectSocket();
    };

    // Reconnect on app resume/focus (basic)
    const visibilityHandler = () => {
      if (!socket || !socket.connected) {
        log.debug('App visible -> ensure socket connected');
        reconnectOnAuth();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    // Set response handler for user interactions
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      log.debug('Notification response');
      // Mark as read when user taps notification
      if (response.notification.request.identifier) {
        dispatch({
          type: NOTIFICATION_ACTIONS.MARK_AS_READ,
          payload: response.notification.request.identifier
        });
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      fcmDataListener.remove();
      if (socket) {
        socket.disconnect();
        log.debug('WebSocket disconnected on cleanup');
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [isAuthenticated, user?.id]);

  // Load notifications after auth is ready (token set), with small delay to avoid race on login
  useEffect(() => {
    let canceled = false;
    const init = async () => {
      if (isAuthenticated && user?.id) {
        // Try to register FCM token in background
        registerFCMToken();

        // Wait until auth token is available to NotificationService
        const maxWaitMs = 1500;
        const start = Date.now();
        while (!notificationService.getAuthToken() && Date.now() - start < maxWaitMs) {
          await new Promise(r => setTimeout(r, 100));
        }
        // Extra small delay to ensure axios client is created with token
        await new Promise(r => setTimeout(r, 100));
        if (!canceled) await loadNotifications();
      } else {
        // Load demo notifications for testing when not authenticated
        const demoNotifications = notificationService.createDemoNotifications();
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: demoNotifications,
        });
      }
    };
    init();
    return () => { canceled = true; };
  }, [isAuthenticated, user?.id]);

  // Validate token and redirect to Login if missing/invalid
  useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated || !user?.id) {
        return;
      }
      try {
        // simple ping; backend will return 401 if token invalid/expired
        const result = await notificationService.testConnection();
        if (!result?.success) {
          // fall through to re-check auth
          await checkAuthStatus();
        }
      } catch (e) {
        // If unauthorized -> force logout to show login screen
        const status = e?.response?.status || e?.status;
        if (status === 401) {
          log.warn('Token invalid or expired. Redirecting to login...');
          try { await logout(); } catch {}
        }
      }
    };
    validateToken();
  }, [isAuthenticated, user?.id]);

  // Register device token for push notifications
  const registerFCMToken = async () => {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        log.warn('Push notification permission not granted');
        return;
      }

      // Get device push token (FCM on Android / APNs on iOS)
      let rawToken = null;
      let tokenType = null;
      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        rawToken = devicePushToken?.data;
        tokenType = devicePushToken?.type; // 'fcm' on Android, 'apns' on iOS
        log.info('Native push token acquired', { tokenType, token: rawToken?.substring(0, 20) + '...' });
      } catch (nativeErr) {
        log.warn('Native device token not available (dev/Expo Go likely). Skipping FCM registration.', nativeErr.message);
        return;
      }
      if (!rawToken) {
        log.warn('Failed to get device push token');
        return;
      }

      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const res = await notificationService.addFCMToken(user.id, rawToken, platform);
      log.info('Registered push token with backend', res?.success ?? true);
    } catch (error) {
      log.warn('Failed to register FCM token', error?.message || String(error));
    }
  };

  // Load notifications
  const loadNotifications = async (page = 1, limit = 20) => {
    if (!isAuthenticated || !user?.id) {
      log.warn('User not authenticated, using demo notifications');
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
      return;
    }
    // Ensure auth token is present
    if (!notificationService.getAuthToken()) {
      log.warn('Auth token not ready yet, delaying notifications load');
      await new Promise(r => setTimeout(r, 200));
      if (!notificationService.getAuthToken()) return; // skip if still not ready
    }

    // Prevent multiple simultaneous calls
    if (state.loading) {
      log.debug('Already loading notifications, skipping...');
      return;
    }

    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING, payload: true });
      const response = await notificationService.getNotifications(user.id, page, limit);
      
      if (response.success) {
        // Pass the entire response.data object to the reducer
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: response.data,
        });
      } else {
        // If API fails, fall back to demo notifications
        log.warn('API failed, using demo notifications', response.message);
        const demoNotifications = notificationService.createDemoNotifications();
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: demoNotifications,
        });
      }
    } catch (error) {
      log.warn('API error, using demo notifications', error.message);
      // If API fails, fall back to demo notifications
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
    }
  };

  // Refresh notifications
  const refreshNotifications = async () => {
    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_REFRESHING, payload: true });
      await loadNotifications();
    } finally {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_REFRESHING, payload: false });
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!isAuthenticated || !user?.id) {
      // If not authenticated, just update local state
      dispatch({
        type: NOTIFICATION_ACTIONS.MARK_AS_READ,
        payload: notificationId,
      });
      return;
    }

    try {
      const response = await notificationService.markAsRead(notificationId, user.id);
      
      if (response.success) {
        dispatch({
          type: NOTIFICATION_ACTIONS.MARK_AS_READ,
          payload: notificationId,
        });
      }
    } catch (error) {
      log.error('Error marking notification as read', error?.message || error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!isAuthenticated || !user?.id) {
      // If not authenticated, just update local state
      dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
      return;
    }

    try {
      const response = await notificationService.markAllAsRead(user.id);
      
      if (response.success) {
        dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
      }
    } catch (error) {
      log.error('Error marking all notifications as read', error?.message || error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!isAuthenticated || !user?.id) {
      // If not authenticated, just update local state
      dispatch({
        type: NOTIFICATION_ACTIONS.DELETE_NOTIFICATION,
        payload: notificationId,
      });
      return;
    }

    try {
      const response = await notificationService.deleteNotification(notificationId, user.id);
      
      if (response.success) {
        dispatch({
          type: NOTIFICATION_ACTIONS.DELETE_NOTIFICATION,
          payload: notificationId,
        });
      }
    } catch (error) {
      log.error('Error deleting notification', error?.message || error);
    }
  };

  // Add new notification (for real-time updates)
  const addNotification = (notification) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
      payload: notification,
    });
  };

  // Get notification stats
  const getNotificationStats = async () => {
    if (!isAuthenticated || !user?.id) {
      return null;
    }

    try {
      const response = await notificationService.getNotificationStats(user.id);
      return response.data;
    } catch (error) {
      log.error('Error getting notification stats', error?.message || error);
      return null;
    }
  };

  // Test API connection
  const testApiConnection = async () => {
    log.info('Testing API connection from NotificationContext...');
    try {
      const result = await notificationService.testConnection();
      log.info('API Test Result', result);
      return result;
    } catch (error) {
      log.error('Error testing API connection', error?.message || error);
      return {
        success: false,
        message: error.message
      };
    }
  };

  useEffect(() => {
    const ensurePermissionsAndChannels = async () => {
      if (Platform.OS === 'android') {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          enableVibrate: true,
          enableLights: true,
        });
  
        await Notifications.setNotificationChannelAsync('emergency', {
          name: 'Emergency',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'emergy_sound',
          vibrationPattern: [0, 1000, 500, 1000],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          enableVibrate: true,
          enableLights: true,
        });
      } else {
        await Notifications.requestPermissionsAsync({
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        });
      }
    };
  
    ensurePermissionsAndChannels();
  }, []);

  const value = {
    ...state,
    loadNotifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    getNotificationStats,
    testApiConnection,
    // expose for manual re-registration if needed
    registerFCMToken,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Hook to use notification context
export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
