import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationContext } from '../contexts/NotificationContext';

const NotificationItem = ({ notification, onPress }) => {
  const { markAsRead, deleteNotification } = useNotificationContext();

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#FF3B30';
      case 'high':
        return '#FF9500';
      case 'medium':
        return '#FFCC00';
      case 'low':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'sensor':
        return 'thermometer-outline';
      case 'outlet':
        return 'flash-outline';
      case 'rule':
        return 'settings-outline';
      case 'system':
        return 'cog-outline';
      case 'security':
        return 'shield-checkmark-outline';
      case 'maintenance':
        return 'construct-outline';
      case 'marketing':
        return 'megaphone-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'device_alert':
        return '#FF9500';
      case 'security_alert':
        return '#FF3B30';
      case 'system_notification':
        return '#007AFF';
      case 'maintenance':
        return '#8E8E93';
      case 'promotion':
        return '#AF52DE';
      default:
        return '#8E8E93';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Vừa xong';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} phút trước`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} giờ trước`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} ngày trước`;
    }
  };

  const handleMarkAsRead = async () => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Xóa thông báo',
      'Bạn có chắc chắn muốn xóa thông báo này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => deleteNotification(notification.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.isRead && styles.unreadContainer,
      ]}
      onPress={() => {
        handleMarkAsRead();
        onPress && onPress(notification);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={getCategoryIcon(notification.category)}
              size={24}
              color={getTypeColor(notification.type)}
            />
            {!notification.isRead && (
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: getPriorityColor(notification.priority) },
                ]}
              />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, !notification.isRead && styles.unreadTitle]}>
              {notification.title}
            </Text>
            <Text style={styles.time}>
              {formatTime(notification.createdAt)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-outline" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <Text style={styles.message}>{notification.message}</Text>

        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
          <View style={styles.metadata}>
            {notification.metadata.deviceName && (
              <Text style={styles.metadataText}>
                Thiết bị: {notification.metadata.deviceName}
              </Text>
            )}
            {notification.metadata.sensorType && (
              <Text style={styles.metadataText}>
                Loại: {notification.metadata.sensorType}
              </Text>
            )}
            {notification.metadata.sensorValue !== undefined && (
              <Text style={styles.metadataText}>
                Giá trị: {notification.metadata.sensorValue}
              </Text>
            )}
            {notification.metadata.threshold !== undefined && (
              <Text style={styles.metadataText}>
                Ngưỡng: {notification.metadata.threshold}
              </Text>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: getTypeColor(notification.type) }]}>
              <Text style={styles.badgeText}>
                {notification.type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(notification.priority) }]}>
              <Text style={styles.badgeText}>
                {notification.priority.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
    marginTop: 2,
  },
  priorityDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    color: '#8E8E93',
  },
  deleteButton: {
    padding: 4,
  },
  message: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 20,
    marginBottom: 12,
  },
  metadata: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  metadataText: {
    fontSize: 12,
    color: '#6D6D70',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default NotificationItem;
