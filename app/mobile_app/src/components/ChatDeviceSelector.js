import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatDeviceSelector');

const ChatDeviceSelector = ({ visible, onClose, onDeviceSelect, selectedDevice }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      loadDevices();
    }
  }, [visible]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDevices();
      if (response.success) {
        setDevices(response.data || []);
      } else {
        setError(response.message || t('common.errorLoadingData'));
      }
    } catch (error) {
      log.error('Error loading devices:', error);
      setError(t('common.errorLoadingData'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceSelect = (device) => {
    onDeviceSelect(device);
    onClose();
  };

  const renderDeviceItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
        selectedDevice?.id === item.id && { borderColor: colors.primary, borderWidth: 2 }
      ]}
      onPress={() => handleDeviceSelect(item)}
    >
      <View style={styles.deviceInfo}>
        <View style={[styles.deviceIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="hardware-chip" size={24} color={colors.primary} />
        </View>
        <View style={styles.deviceDetails}>
          <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
            {item.name || item.id}
          </Text>
          <Text style={[styles.deviceId, { color: colors.textSecondary }]} numberOfLines={1}>
            ID: {item.id}
          </Text>
          <View style={styles.deviceStatus}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: item.status === 'online' ? colors.success : colors.gray }
            ]} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {item.status === 'online' ? t('common.online') : t('common.offline')}
            </Text>
          </View>
        </View>
      </View>
      {selectedDevice?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="hardware-chip-outline" size={48} color={colors.gray} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {t('chat.noDevicesFound')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {t('chat.addDeviceFirst')}
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        {t('common.error')}
      </Text>
      <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
        {error}
      </Text>
      <TouchableOpacity 
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={loadDevices}
      >
        <Text style={[styles.retryButtonText, { color: colors.white }]}>
          {t('common.retry')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('chat.selectDevice')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.gray} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loading')}
              </Text>
            </View>
          ) : error ? (
            renderErrorState()
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={renderDeviceItem}
              style={styles.deviceList}
              contentContainerStyle={styles.deviceListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    minHeight: '60%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  deviceList: {
    flex: 1,
    minHeight: 300,
  },
  deviceListContent: {
    padding: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    marginBottom: 4,
  },
  deviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorState: {
    flex: 1,
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChatDeviceSelector;
