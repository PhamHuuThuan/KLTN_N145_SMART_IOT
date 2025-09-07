import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const DeviceSelector = ({ devices, selectedDevice, onSelectDevice, onPressDetails }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="devices" size={20} color={CONFIG.COLORS.primary} />
        <Text style={styles.sectionTitle}>Connected Devices</Text>
      </View>
      {devices.length > 0 ? (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.selectBox}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chevron-down" size={20} color={CONFIG.COLORS.gray} />
            <Text style={styles.selectText} numberOfLines={1}>
              {selectedDevice || 'Select a device'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailButton}
            onPress={onPressDetails}
            activeOpacity={0.9}
            disabled={!selectedDevice}
          >
            <MaterialCommunityIcons name="information-outline" size={18} color={CONFIG.THEME.surface} />
            <Text style={styles.detailText}>Details</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.noDevicesText}>No devices connected</Text>
      )}

      <Modal
        visible={showPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Device</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <MaterialCommunityIcons name="close" size={20} color={CONFIG.COLORS.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {devices.map((deviceId) => (
                <TouchableOpacity
                  key={deviceId}
                  style={[
                    styles.modalItem,
                    selectedDevice === deviceId && styles.modalItemActive
                  ]}
                  onPress={() => {
                    setShowPicker(false);
                    onSelectDevice && onSelectDevice(deviceId);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedDevice === deviceId && styles.modalItemTextActive]}>
                    {deviceId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CONFIG.COLORS.light,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: CONFIG.COLORS.dark,
    fontWeight: '600',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CONFIG.THEME.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  detailText: {
    color: CONFIG.THEME.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  noDevicesText: {
    fontSize: 16,
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CONFIG.COLORS.primary,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalItemActive: {
    backgroundColor: CONFIG.COLORS.light,
  },
  modalItemText: {
    fontSize: 14,
    color: CONFIG.COLORS.dark,
  },
  modalItemTextActive: {
    fontWeight: '700',
  },
});

export default DeviceSelector;
