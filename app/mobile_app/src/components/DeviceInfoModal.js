import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CONFIG from '../constants/config';
import DeviceInfo from './DeviceInfo';

const DeviceInfoModal = ({ visible, onClose, deviceData }) => {
  const { t } = useTranslation();
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('devices.deviceInformation')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={CONFIG.COLORS.gray} />
            </TouchableOpacity>
          </View>

          <DeviceInfo deviceData={deviceData} compact={true} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CONFIG.THEME.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: CONFIG.THEME.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: CONFIG.COLORS.primary,
  },
  closeBtn: {
    padding: 6,
  },
});

export default DeviceInfoModal;


