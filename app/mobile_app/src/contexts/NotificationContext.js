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
  emergency: null,
  // Pagination state
  currentPage: 1,
  hasMore: true,
  loadingMore: false,
  totalPages: 0,
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
  SET_EMERGENCY: 'SET_EMERGENCY',
  LOAD_MORE_NOTIFICATIONS: 'LOAD_MORE_NOTIFICATIONS',
  SET_LOADING_MORE: 'SET_LOADING_MORE',
  SET_PAGINATION: 'SET_PAGINATION',
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
      
      const paginationData = action.payload.data || {};
      
      return {
        ...state,
        notifications: notifications,
        unreadCount: notifications.filter(n => !n.isRead).length,
        loading: false,
        error: null,
        currentPage: paginationData.page || 1,
        totalPages: paginationData.pages || 1,
        hasMore: (paginationData.page || 1) < (paginationData.pages || 1),
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
        notification.notificationId === action.payload
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
        notification => notification.notificationId !== action.payload
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
    
    case NOTIFICATION_ACTIONS.SET_EMERGENCY:
      return { ...state, emergency: action.payload };
    
    case NOTIFICATION_ACTIONS.LOAD_MORE_NOTIFICATIONS:
      const moreNotifications = Array.isArray(action.payload) 
        ? action.payload 
        : action.payload.data?.notifications || [];
      
      const morePaginationData = action.payload.data || {};
      
      return {
        ...state,
        notifications: [...state.notifications, ...moreNotifications],
        unreadCount: [...state.notifications, ...moreNotifications].filter(n => !n.isRead).length,
        loadingMore: false,
        currentPage: morePaginationData.page || state.currentPage,
        totalPages: morePaginationData.pages || state.totalPages,
        hasMore: (morePaginationData.page || state.currentPage) < (morePaginationData.pages || state.totalPages),
      };
    
    case NOTIFICATION_ACTIONS.SET_LOADING_MORE:
      return { ...state, loadingMore: action.payload };
    
    case NOTIFICATION_ACTIONS.SET_PAGINATION:
      return {
        ...state,
        currentPage: action.payload.currentPage || state.currentPage,
        totalPages: action.payload.totalPages || state.totalPages,
        hasMore: action.payload.hasMore !== undefined ? action.payload.hasMore : state.hasMore,
      };
    
    default:
      return state;
  }
};

// Provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, isAuthenticated, logout, checkAuthStatus } = useAuth();

  useEffect(() => {
    const recentKeys = new Set();
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

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification?.request?.content?.data || {};
      const isEmergency = (data.priority || '').toLowerCase() === 'urgent' ||
                          (data.category || '').toLowerCase() === 'security' ||
                          (data.type || '').toLowerCase() === 'security_alert';
      if (!isEmergency) {
        return;
      }
    });

    const handleFCMDataMessage = (message) => {
      const data = (message && message.data) || {};
      const isEmergency = (data.priority || '').toLowerCase() === 'urgent' ||
                          (data.category || '').toLowerCase() === 'security' ||
                          (data.type || '').toLowerCase() === 'security_alert';
      if (!isEmergency) {
        return;
      }
    };

    const fcmDataListener = DeviceEventEmitter.addListener('FCMDataMessage', (message) => {
      handleFCMDataMessage(message);
    });

    let socket = null;
    const connectSocket = () => {
      try {
        const gatewayUrl = ENV.getApiUrl('GATEWAY');
        
        socket = io(gatewayUrl, {
          path: '/ws/notifications',
          auth: user?.userId ? { userId: user.userId } : undefined,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
          forceNew: true
        });

        socket.on('connect', () => {
          if (user?.id) {
            socket.emit('authenticate', { userId: user.userId });
          } else {
            setTimeout(() => {
              if (user?.id && socket?.connected) {
                socket.emit('authenticate', { userId: user.userId });
              }
            }, 1000);
          }
        });

        socket.on('reconnect', () => {
          if (user?.id && socket?.connected) {
            socket.emit('authenticate', { userId:userId });
          }
        });

        socket.on('notification', (notification) => {
          const notificationData = {
            notificationId: notification.notificationId || `ws_${Date.now()}`,
            title: notification.title || 'Notification',
            body: notification.message || notification.body || '',
            message: notification.message || notification.body || '',
            data: notification.metadata || {},
            metadata: notification.metadata || {},
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            type: notification.type || 'system_notification',
            priority: notification.priority || 'low',
            category: notification.category || 'system',
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
          
          dispatch({
            type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
            payload: notificationData
          });

          const isEmergency = String(notificationData.priority).toLowerCase() === 'urgent'
            || String(notificationData.category).toLowerCase() === 'security'
            || String(notificationData.type).toLowerCase() === 'security_alert'
            || String(notificationData.type).toLowerCase() === 'emergency_alert';
          if (isEmergency) {
            dispatch({ type: NOTIFICATION_ACTIONS.SET_EMERGENCY, payload: notificationData });
          }
          
          const newBadgeCount = state.notifications.length + 1;
          Notifications.setBadgeCountAsync(newBadgeCount);
        });

        socket.on('emergency_notification', (notification) => {
          const notificationData = {
            notificationId: notification.notificationId || notification.id || `emergency_${Date.now()}`,
            title: notification.title || 'Emergency Alert',
            body: notification.message || notification.body || '',
            message: notification.message || notification.body || '',
            data: notification.metadata || {},
            metadata: notification.metadata || {},
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            type: notification.type || 'security_alert',
            priority: 'urgent',
            category: 'security',
            deviceId: notification.metadata?.deviceId,
            deviceName: notification.metadata?.deviceName,
            sensorType: notification.metadata?.sensorType,
            sensorValue: notification.metadata?.sensorValue,
            threshold: notification.metadata?.threshold,
            alertType: notification.metadata?.alertType
          };
          
          dispatch({
            type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
            payload: notificationData
          });

          dispatch({ type: NOTIFICATION_ACTIONS.SET_EMERGENCY, payload: notificationData });
        });

        socket.on('disconnect', () => {});

        socket.on('error', (error) => {
          log.error('[NotifContext] WebSocket error:', {
            message: error?.message,
            name: error?.name,
            description: error?.description,
            type: error?.type,
            stack: error?.stack,
            rawError: error
          });
        });

        socket.on('connect_error', (error) => {
          log.error('[NotifContext] WebSocket connect_error:', {
            message: error?.message,
            name: error?.name,
            description: error?.description,
            type: error?.type,
            stack: error?.stack,
            code: error?.code,
            errno: error?.errno,
            syscall: error?.syscall,
            address: error?.address,
            port: error?.port,
            rawError: error
          });
        });

      } catch (error) {
        log.error('WebSocket connection failed', error?.message || error);
      }
    };

    connectSocket();

    const reconnectOnAuth = () => {
      if (socket) {
        try { socket.disconnect(); } catch {}
      }
      connectSocket();
    };

    const visibilityHandler = () => {
      if (!socket || !socket.connected) {
        reconnectOnAuth();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
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
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    let canceled = false;
    const init = async () => {
      if (isAuthenticated && user?.id) {
        registerFCMToken();

        const maxWaitMs = 1500;
        const start = Date.now();
        while (!notificationService.getAuthToken() && Date.now() - start < maxWaitMs) {
          await new Promise(r => setTimeout(r, 100));
        }
        await new Promise(r => setTimeout(r, 100));
        if (!canceled) await loadNotifications();
      } else {
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

  useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated || !user?.id) {
        return;
      }
      try {
        const result = await notificationService.testConnection();
        if (!result?.success) {
          await checkAuthStatus();
        }
      } catch (e) {
        const status = e?.response?.status || e?.status;
        if (status === 401) {
          try { await logout(); } catch {}
        }
      }
    };
    validateToken();
  }, [isAuthenticated, user?.id]);

  const registerFCMToken = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }

      let rawToken = null;
      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        rawToken = devicePushToken?.data;
      } catch (nativeErr) {
        return;
      }
      if (!rawToken) {
        return;
      }

      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      await notificationService.addFCMToken(user.userId, rawToken, platform);
    } catch (error) {
    }
  };

  const loadNotifications = async (page = 1, limit = 20) => {
    if (!isAuthenticated || !user?.id) {
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
      return;
    }
    if (!notificationService.getAuthToken()) {
      await new Promise(r => setTimeout(r, 200));
      if (!notificationService.getAuthToken()) return;
    }

    if (state.loading) {
      return;
    }

    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING, payload: true });
      const response = await notificationService.getNotifications(user.userId, page, limit);
      
      if (response.success) {
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: response.data,
        });
      } else {
        const demoNotifications = notificationService.createDemoNotifications();
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: demoNotifications,
        });
      }
    } catch (error) {
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
    }
  };

  const refreshNotifications = async () => {
    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_REFRESHING, payload: true });
      await loadNotifications();
    } finally {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_REFRESHING, payload: false });
    }
  };

  const loadMoreNotifications = async () => {
    if (!isAuthenticated || !user?.id || state.loadingMore || !state.hasMore) {
      return;
    }

    const nextPage = state.currentPage + 1;

    try {
      dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING_MORE, payload: true });
      
      if (!notificationService.getAuthToken()) {
        await new Promise(r => setTimeout(r, 200));
        if (!notificationService.getAuthToken()) {
          dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING_MORE, payload: false });
          return;
        }
      }

      const response = await notificationService.getNotifications(user.userId, nextPage, 20);
      
      if (response.success && response.data) {
        dispatch({
          type: NOTIFICATION_ACTIONS.LOAD_MORE_NOTIFICATIONS,
          payload: response.data,
        });
      } else {
        dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING_MORE, payload: false });
      }
    } catch (error) {
      log.error('Load more error:', error.message);
      dispatch({ type: NOTIFICATION_ACTIONS.SET_LOADING_MORE, payload: false });
    }
  };

  const markAsRead = async (notificationId) => {
    if (!isAuthenticated || !user?.id) {
      dispatch({
        type: NOTIFICATION_ACTIONS.MARK_AS_READ,
        payload: notificationId,
      });
      return;
    }

    try {
      const response = await notificationService.markAsRead(notificationId, user.userId);
      
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

  const markAllAsRead = async () => {
    if (!isAuthenticated || !user?.id) {
      dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
      return;
    }

    try {
      const response = await notificationService.markAllAsRead(user.userId);
      
      if (response.success) {
        dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
      }
    } catch (error) {
      log.error('Error marking all notifications as read', error?.message || error);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!isAuthenticated || !user?.id) {
      dispatch({
        type: NOTIFICATION_ACTIONS.DELETE_NOTIFICATION,
        payload: notificationId,
      });
      return;
    }

    try {
      const response = await notificationService.deleteNotification(notificationId, user.userId);
      
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

  const addNotification = (notification) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
      payload: notification,
    });
  };

  const getNotificationStats = async () => {
    if (!isAuthenticated || !user?.id) {
      return null;
    }

    try {
      const response = await notificationService.getNotificationStats(user.userId);
      return response.data;
    } catch (error) {
      log.error('Error getting notification stats', error?.message || error);
      return null;
    }
  };

  const testApiConnection = async () => {
    try {
      const result = await notificationService.testConnection();
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
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    getNotificationStats,
    testApiConnection,
    registerFCMToken,
    dispatch,
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
