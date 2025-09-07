import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const DeviceSelector = ({ devices, selectedDevice, onSelectDevice }) => {
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="devices" size={20} color={CONFIG.COLORS.primary} />
        <Text style={styles.sectionTitle}>Connected Devices</Text>
      </View>
      {devices.length > 0 ? (
        <View style={styles.deviceList}>
          {devices.map((deviceId) => (
            <TouchableOpacity
              key={deviceId}
              style={[
                styles.deviceItem,
                selectedDevice === deviceId && styles.deviceItemSelected
              ]}
              onPress={() => onSelectDevice(deviceId)}
            >
              <Text style={[
                styles.deviceText,
                selectedDevice === deviceId && styles.deviceTextSelected
              ]}>
                {deviceId}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.noDevicesText}>No devices connected</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 15,
  },
  deviceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  deviceItem: {
    backgroundColor: CONFIG.COLORS.light,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  deviceItemSelected: {
    backgroundColor: CONFIG.COLORS.secondary,
    borderColor: CONFIG.COLORS.secondary,
  },
  deviceText: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
  },
  deviceTextSelected: {
    color: CONFIG.COLORS.white,
    fontWeight: 'bold',
  },
  noDevicesText: {
    fontSize: 16,
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DeviceSelector;
