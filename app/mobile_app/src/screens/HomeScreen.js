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
            await fetchDevices(1, 20);
            
            // If the removed device was selected, auto-select another device
            if (selectedDevice === deviceId) {
              if (newSelectedDevice) {
                // Auto-select the new device
                await selectDevice(newSelectedDevice);
                await fetchDeviceDetail(newSelectedDevice);
              } else {
                // No devices left, clear selection
                setSelectedDevice(null);
                setDeviceData(null);
              }
            }
          }}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMoreDevices}
        />

        <SensorGrid deviceData={deviceData} />

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
          deviceData={deviceDetail || deviceData}
        />

        {deviceData?.lastUpdate && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.lastUpdate, { color: colors.textSecondary }]}>
              {t('devices.lastUpdate')}: {new Date(deviceData.lastUpdate).toLocaleString()}
            </Text>
          </View>
        )}

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
  lastUpdate: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HomeScreen;
