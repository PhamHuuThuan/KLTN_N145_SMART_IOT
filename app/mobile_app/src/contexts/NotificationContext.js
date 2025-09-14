import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';

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
  const { user, isAuthenticated } = useAuth();

  // Load notifications on mount
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadNotifications();
    } else {
      // Load demo notifications for testing when not authenticated
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
    }
  }, [isAuthenticated, user?.id]);

  // Load notifications
  const loadNotifications = async (page = 1, limit = 20) => {
    if (!isAuthenticated || !user?.id) {
      console.warn('User not authenticated, using demo notifications');
      const demoNotifications = notificationService.createDemoNotifications();
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
        payload: demoNotifications,
      });
      return;
    }

    // Prevent multiple simultaneous calls
    if (state.loading) {
      console.log('Already loading notifications, skipping...');
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
        console.warn('API failed, using demo notifications:', response.message);
        const demoNotifications = notificationService.createDemoNotifications();
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_NOTIFICATIONS,
          payload: demoNotifications,
        });
      }
    } catch (error) {
      console.warn('API error, using demo notifications:', error.message);
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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
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
      console.error('Error deleting notification:', error);
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
      console.error('Error getting notification stats:', error);
      return null;
    }
  };

  // Test API connection
  const testApiConnection = async () => {
    console.log('🔔 Testing API connection from NotificationContext...');
    try {
      const result = await notificationService.testConnection();
      console.log('API Test Result:', result);
      return result;
    } catch (error) {
      console.error('Error testing API connection:', error);
      return {
        success: false,
        message: error.message
      };
    }
  };

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
