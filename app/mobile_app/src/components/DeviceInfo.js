import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { createLogger } from '../utils/logger';

const log = createLogger('DeviceInfo');

const Row = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <MaterialCommunityIcons name={icon} size={18} color={CONFIG.THEME.gray} />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <Text style={styles.rowValue} numberOfLines={1}>
      {value ?? '--'}
    </Text>
  </View>
);

const DeviceInfo = ({ deviceData, compact = false }) => {
  if (!deviceData) return null;

  const meta = deviceData.metadata || {};
  const firmwareVersion = meta.firmwareVersion || deviceData.firmware?.version;
  const statusLabel = deviceData.isOnline ? 'Online' : 'Offline';
  const lastActiveValue =
    deviceData.lastSeenAt ??
    deviceData.updatedAt;

  const toDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      return new Date(Number(value));
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed);
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return new Date(numeric);
      }
    }
    return null;
  };

  const lastActiveDate = toDate(lastActiveValue);
  const lastActiveLabel = lastActiveDate ? lastActiveDate.toLocaleString() : '--';
  const statusWithTime = lastActiveValue ? `${statusLabel} · ${lastActiveLabel}` : statusLabel;

  React.useEffect(() => {
    log.debug('deviceData updated');
  }, [deviceData]);

  const rows = compact
    ? [
        { icon: 'power', label: 'Status', value: statusWithTime },
        { icon: 'factory', label: 'Manufacturer', value: meta.manufacturer },
        { icon: 'update', label: 'Firmware', value: firmwareVersion },
        { icon: 'ip', label: 'IP Address', value: meta.ipAddress },
        { icon: 'alphabetical-variant', label: 'MAC Address', value: meta.macAddress },
      ]
    : [
        { icon: 'power', label: 'Status', value: statusWithTime },
        { icon: 'factory', label: 'Manufacturer', value: meta.manufacturer },
        { icon: 'chip', label: 'Hardware', value: meta.hardwareVersion },
        { icon: 'update', label: 'Firmware', value: firmwareVersion },
        { icon: 'ip', label: 'IP Address', value: meta.ipAddress },
        { icon: 'alphabetical-variant', label: 'MAC Address', value: meta.macAddress },
        { icon: 'wifi', label: 'Wi‑Fi SSID', value: meta.wifiSSID },
        { icon: 'mqtt', label: 'MQTT Broker', value: meta.mqttBroker },
        { icon: 'calendar-plus', label: 'Created', value: deviceData.createdAt ? new Date(deviceData.createdAt).toLocaleString() : '--' },
        { icon: 'calendar-sync', label: 'Updated', value: deviceData.updatedAt ? new Date(deviceData.updatedAt).toLocaleString() : '--' },
        { icon: 'alert-decagram', label: 'Emergency Mode', value: deviceData.emergencyMode ? 'ENABLED' : 'Disabled' },
      ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Information</Text>

      <View style={styles.card}>
        {rows.map((r) => (
          <Row key={r.label} icon={r.icon} label={r.label} value={r.value} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
  },
  rowValue: {
    maxWidth: '55%',
    fontSize: 14,
    color: CONFIG.COLORS.dark,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default DeviceInfo;


