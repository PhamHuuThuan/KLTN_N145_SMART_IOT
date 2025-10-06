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
  const {
    deviceData,
    deviceDetail,
    devicesList,
    selectedDevice,
    loading,
    error,
    fetchDevices,
    selectDevice,
    fetchDeviceStatus,
    fetchDeviceDetail,
  } = useDeviceData();

  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const { controlOutlet, loading: controlLoading } = useOutletControl();

  const onRefresh = async () => {
    await fetchDevices();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.COLORS.primary} />
      
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
            await fetchDevices();
          }}
          onDeviceRemoved={async (deviceId, newSelectedDevice = null) => {
            // Refresh devices list when a device is removed
            await fetchDevices();
            
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
              setFeedback({ visible: true, type: 'error', message: error.message || 'Failed to update outlet settings' });
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
          <View style={styles.section}>
            <Text style={styles.lastUpdate}>
              Last update: {new Date(deviceData.lastUpdate).toLocaleString()}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.section}>
            <Text style={styles.errorText}>Error: {error}</Text>
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
    backgroundColor: '#ECF0F1',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: CONFIG.COLORS.white,
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
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: CONFIG.COLORS.danger,
    textAlign: 'center',
  },
});

export default HomeScreen;
