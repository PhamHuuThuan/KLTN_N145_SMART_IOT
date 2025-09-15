import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';

const DeviceSelector = ({ devices, selectedDevice, onSelectDevice, onPressDetails, onDeviceAdded }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const { user } = useAuth();

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
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="plus" size={18} color={CONFIG.THEME.surface} />
            <Text style={styles.addText}>Add</Text>
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

      {/* Add device modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Device</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialCommunityIcons name="close" size={20} color={CONFIG.COLORS.gray} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10, paddingHorizontal: 4, paddingBottom: 8 }}>
              <Text style={styles.inputLabel}>Device ID / Pairing Code</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter deviceId"
                autoCapitalize="none"
                value={newDeviceId}
                onChangeText={setNewDeviceId}
              />
              <Text style={styles.inputLabel}>Name (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="My Kitchen Controller"
                value={newDeviceName}
                onChangeText={setNewDeviceName}
              />
              <TouchableOpacity
                style={[styles.addConfirmButton, submitting && { opacity: 0.7 }]}
                onPress={async () => {
                  if (!newDeviceId?.trim()) {
                    Alert.alert('Validation', 'Please enter a deviceId');
                    return;
                  }
                  if (!user?.id) {
                    Alert.alert('Not logged in', 'Please login to add devices');
                    return;
                  }
                  try {
                    setSubmitting(true);
                    setShowLoader(true);
                    const payload = {
                      deviceId: newDeviceId.trim(),
                      ownerId: user.id,
                      name: (newDeviceName || newDeviceId).trim(),
                      location: { room: 'kitchen', floor: '1' }
                    };
                    const resp = await apiService.post('/api/devices', payload);
                    if (resp?.data?.success) {
                      setFeedback({ visible: true, type: 'success', message: 'Device added successfully' });
                      setShowAddModal(false);
                      setNewDeviceId('');
                      setNewDeviceName('');
                      onSelectDevice && onSelectDevice(payload.deviceId);
                      onDeviceAdded && onDeviceAdded(resp.data.data);
                    } else {
                      setFeedback({ visible: true, type: 'error', message: resp?.data?.message || 'Could not add device' });
                    }
                  } catch (e) {
                    setFeedback({ visible: true, type: 'error', message: e?.message || 'Failed to add device' });
                  } finally {
                    setSubmitting(false);
                    setShowLoader(false);
                  }
                }}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator color={CONFIG.THEME.surface} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={18} color={CONFIG.THEME.surface} />
                    <Text style={styles.addConfirmText}>Add Device</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global overlays */}
      <OverlayLoader
        visible={showLoader}
        message="Adding device..."
        onCancel={() => {
          setShowLoader(false);
          setSubmitting(false);
        }}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CONFIG.THEME.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addText: {
    color: CONFIG.THEME.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: CONFIG.COLORS.gray,
  },
  textInput: {
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: CONFIG.COLORS.dark,
    backgroundColor: CONFIG.COLORS.light,
  },
  addConfirmButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CONFIG.THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addConfirmText: {
    color: CONFIG.THEME.surface,
    fontWeight: '700',
    fontSize: 14,
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
