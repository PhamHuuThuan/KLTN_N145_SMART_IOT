import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useNotificationContext } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import NotificationItem from '../components/NotificationItem';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';
import { notificationService } from '../services/notificationService';

const NotificationScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refreshing,
    loadingMore,
    hasMore,
    loadNotifications,
    refreshNotifications,
    loadMoreNotifications,
    markAllAsRead,
  } = useNotificationContext();
  
  const { user } = useAuth();

  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRefresh = async () => {
    setShowLoader(true);
    try {
      await refreshNotifications();
      setFeedback({ visible: true, type: 'success', message: t('common.refresh') });
    } catch (e) {
      setFeedback({ visible: true, type: 'error', message: t('errors.refreshFailed') });
    } finally {
      setShowLoader(false);
    }
  };

  

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    try {
      await loadMoreNotifications();
    } catch (error) {
      console.error('Error loading more notifications:', error);
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) return;

    Alert.alert(
      t('notifications.markAllAsRead'),
      t('notifications.markAllConfirm', { count: unreadCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setShowLoader(true);
            try {
              await markAllAsRead();
              setFeedback({ visible: true, type: 'success', message: t('notifications.allMarkedAsRead') });
            } catch (_) {
              setFeedback({ visible: true, type: 'error', message: t('errors.markAllFailed') });
            } finally {
              setShowLoader(false);
            }
          },
        },
      ]
    );
  };

  

  const handleNotificationPress = (notification) => {
    // Navigate to relevant screen based on notification type
    switch (notification.category) {
      case 'sensor':
        // Navigate to sensor details
        break;
      case 'outlet':
        // Navigate to outlet control
        break;
      case 'rule':
        // Navigate to rules screen
        break;
      default:
        // Default behavior
        break;
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifications.title')}</Text>
      </View>
      <View style={styles.headerRight}>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllButton, { backgroundColor: colors.primary }]}
            onPress={handleMarkAllAsRead}
          >
            <Text style={[styles.markAllText, { color: colors.white }]}>{t('notifications.markAllAsRead')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => navigation.navigate('NotificationSettingsFromNotifications')}
        >
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color={colors.gray} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.noNotifications')}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
        {t('notifications.emptyMessage')}
      </Text>
      
    </View>
  );

  const renderNotificationItem = ({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handleNotificationPress}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>{t('common.loadingMore')}</Text>
      </View>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('notifications.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.danger }]}>
          <Text style={[styles.errorText, { color: colors.white }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} onPress={handleRefresh}>
            <Text style={[styles.retryText, { color: colors.white }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId || item.id}
        renderItem={renderNotificationItem}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      <OverlayLoader
        visible={showLoader}
        message={t('common.loading')}
        onCancel={() => setShowLoader(false)}
      />
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onHide={() => setFeedback({ ...feedback, visible: false })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testButton: {
    padding: 8,
    borderRadius: 20,
  },
  testButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
    marginTop: 16,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    // color handled by theme
    marginLeft: 8,
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    marginLeft: 8,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NotificationScreen;
