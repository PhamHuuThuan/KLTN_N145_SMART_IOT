import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('EmergencyScreen');

const EmergencyScreen = ({ navigation, emergency, onCheckNow, onActivateEmergency, onDismiss }) => {
  const [activating, setActivating] = useState(false);
  const deviceName = emergency?.metadata?.deviceName || emergency?.metadata?.deviceId || 'Thiết bị';
  const sensorType = emergency?.metadata?.sensorType || emergency?.type || 'sensor';
  const value = emergency?.metadata?.sensorValue;
  const threshold = emergency?.metadata?.threshold;

  const handleActivateEmergency = async () => {
    if (typeof onActivateEmergency === 'function') {
      // Allow container to also call API (from native intent flow)
      try {
        await onActivateEmergency();
      } catch (_) {}
      return;
    }
    try {
      const deviceId = emergency?.metadata?.deviceId;
      if (!deviceId) {
        log.error('Missing deviceId in emergency payload');
        return;
      }
      setActivating(true);
      // Let server handle emergency logic (turn off kitchen, turn on safety)
      await apiService.enterEmergencyMode(deviceId);
      log.info('Entered emergency mode', deviceId);
      // Optionally refresh device status here if needed by caller
    } catch (error) {
      log.error('Failed to activate emergency mode', error?.message || String(error));
    } finally {
      setActivating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D90429" />
      <View style={styles.header}>
        <Text style={styles.headerText}>Chế độ khẩn cấp</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="alert" size={64} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Cảnh báo an toàn</Text>
        <Text style={styles.subtitle}>
          {deviceName}: {sensorType}
          {(value !== undefined && value !== null) ? ` = ${value}` : ''}
          {(threshold !== undefined && threshold !== null) ? ` (ngưỡng ${threshold})` : ''}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.checkButton]} onPress={onCheckNow} activeOpacity={0.9}>
            <MaterialCommunityIcons name="eye" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Kiểm tra ngay</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.emergencyButton]} onPress={handleActivateEmergency} activeOpacity={0.9} disabled={activating}>
            <MaterialCommunityIcons name="shield-alert" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>{activating ? 'Đang kích hoạt...' : 'Bật chế độ khẩn cấp'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dismiss} onPress={onDismiss}>
          <Text style={styles.dismissText}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1B1B',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#D90429',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#EF233C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E5EA',
    textAlign: 'center',
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  checkButton: {
    backgroundColor: CONFIG.THEME.primary,
  },
  emergencyButton: {
    backgroundColor: '#D90429',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dismiss: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    color: '#C7C7CC',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default EmergencyScreen;


