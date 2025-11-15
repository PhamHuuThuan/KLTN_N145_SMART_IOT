import React, { useState } from 'react';
import {
  ScrollView,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceData } from '../hooks/useDeviceData';
import { useOutletControl } from '../hooks/useOutletControl';
import Header from '../components/Header';
import DeviceSelector from '../components/DeviceSelector';
import SensorGrid from '../components/SensorGrid';
import OutletGrid from '../components/OutletGrid';
import DeviceInfoModal from '../components/DeviceInfoModal';
import ActionFeedback from '../components/ActionFeedback';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('Home');
import CONFIG from '../constants/config';

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    deviceData,
    deviceDetail,
    devicesList,
    selectedDevice,
    loading,
    error,
    hasMore,
    loadingMore,
    fetchDevices,
    loadMoreDevices,
    selectDevice,
    fetchDeviceStatus,
    fetchDeviceDetail,
  } = useDeviceData();

  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const { controlOutlet, loading: controlLoading } = useOutletControl();

  const onRefresh = async () => {
    await fetchDevices(1, 20);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <Header onNotificationPress={() => navigation?.navigate('Notifications')} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <DeviceSelector
          devices={devicesList}
          selectedDevice={selectedDevice}
          onSelectDevice={async (deviceId) => {
            await selectDevice(deviceId);
            await fetchDeviceDetail(deviceId);
          }}
          onPressDetails={() => setShowDeviceInfo(true)}
          onDeviceAdded={async () => {
            // Refresh devices list when a new device is added
            await fetchDevices(1, 20);
          }}
          onDeviceRemoved={async (deviceId, newSelectedDevice = null) => {
            // Refresh devices list when a device is removed
            if (selectedDevice === deviceId && !newSelectedDevice) {
              await selectDevice(null);
            }

            await fetchDevices(1, 20);

            if (newSelectedDevice) {
              await selectDevice(newSelectedDevice);
              await fetchDeviceDetail(newSelectedDevice);
            }
          }}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMoreDevices}
        />

        {deviceData?.deviceId && (
          <View style={[
            styles.statusCard,
            { backgroundColor: colors.surfaceSecondary }
          ]}>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <View style={[
                  styles.statusIndicatorDot,
                  { backgroundColor: deviceData?.isOnline ? colors.success : colors.danger }
                ]} />
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  {deviceData?.isOnline ? t('devices.online', 'Online') : t('devices.offline', 'Offline')}
                </Text>
              </View>
              {deviceData?.lastSeenAt || deviceData?.lastUpdate ? (
                <Text style={[styles.statusTime, { color: colors.textSecondary }]}>
                  {new Date(deviceData.lastSeenAt || deviceData.lastUpdate).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <SensorGrid 
          deviceData={deviceData} 
          onViewChart={(deviceId) => {
            navigation?.navigate?.('SensorChart');
          }}
        />

        <OutletGrid
          selectedDevice={selectedDevice}
          deviceData={deviceData}
          onControlOutlet={controlOutlet}
          onUpdateOutletSettings={async (outletId, settings) => {
            try {
              const response = await apiService.updateOutletSettings(selectedDevice, outletId, settings);
              log.info('Outlet settings updated');
              // Refresh device data
              await fetchDeviceStatus(selectedDevice);
            } catch (error) {
              log.error('Error updating outlet settings', error?.message || error);
              setFeedback({ visible: true, type: 'error', message: error.message || t('devices.updateOutletSettingsFailed') });
            }
          }}
          loading={controlLoading}
          onRefreshDeviceData={() => fetchDeviceStatus(selectedDevice)}
        />

        <DeviceInfoModal
          visible={showDeviceInfo}
          onClose={() => setShowDeviceInfo(false)}
          deviceData={
            deviceDetail && deviceData
              ? { ...deviceDetail, ...deviceData }
              : (deviceData || deviceDetail)
          }
        />

        {error && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{t('common.error')}: {error}</Text>
          </View>
        )}
      </ScrollView>
      
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onHide={() => setFeedback({ ...feedback, visible: false })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCard: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTime: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HomeScreen;
