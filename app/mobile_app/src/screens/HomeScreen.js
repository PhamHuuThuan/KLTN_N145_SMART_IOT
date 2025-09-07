import React from 'react';
import {
  ScrollView,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useDeviceData } from '../hooks/useDeviceData';
import { useOutletControl } from '../hooks/useOutletControl';
import Header from '../components/Header';
import DeviceSelector from '../components/DeviceSelector';
import SensorGrid from '../components/SensorGrid';
import OutletGrid from '../components/OutletGrid';
import apiService from '../services/apiService';
import CONFIG from '../constants/config';

const HomeScreen = () => {
  const {
    deviceData,
    devicesList,
    selectedDevice,
    loading,
    error,
    fetchDevices,
    selectDevice,
  } = useDeviceData();

  const { controlOutlet, loading: controlLoading } = useOutletControl();

  const onRefresh = async () => {
    await fetchDevices();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.COLORS.primary} />
      
      <Header />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <DeviceSelector
          devices={devicesList}
          selectedDevice={selectedDevice}
          onSelectDevice={selectDevice}
        />

        <SensorGrid deviceData={deviceData} />

        <OutletGrid
          selectedDevice={selectedDevice}
          deviceData={deviceData}
          onControlOutlet={controlOutlet}
          onUpdateOutletSettings={async (outletId, settings) => {
            try {
              const response = await apiService.updateOutletSettings(selectedDevice, outletId, settings);
              console.log('Outlet settings updated:', response);
              // Refresh device data
              await fetchDeviceStatus(selectedDevice);
            } catch (error) {
              console.error('Error updating outlet settings:', error);
              Alert.alert('Error', error.message);
            }
          }}
          loading={controlLoading}
        />

        {deviceData?.timestamp && (
          <View style={styles.section}>
            <Text style={styles.lastUpdate}>
              Last update: {new Date(deviceData.timestamp).toLocaleString()}
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.section}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}
      </ScrollView>
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
