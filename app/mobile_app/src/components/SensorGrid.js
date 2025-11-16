import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const SensorGrid = ({ deviceData, onViewChart }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  if (!deviceData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>{t('sensors.noDeviceData')}</Text>
      </View>
    );
  }

  const { latestTelemetry } = deviceData;
  if (!latestTelemetry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>{t('sensors.noTelemetryData')}</Text>
      </View>
    );
  }

  const sensorData = [
    {
      id: 'temperature',
      label: t('sensors.labels.temperature'),
      value: latestTelemetry.temp !== null && latestTelemetry.temp !== undefined ? `${latestTelemetry.temp}°C` : '--',
      icon: 'thermometer',
      color: CONFIG.COLORS.danger,
      unit: '°C'
    },
    {
      id: 'humidity',
      label: t('sensors.labels.humidity'),
      value: latestTelemetry.humid !== null && latestTelemetry.humid !== undefined ? `${latestTelemetry.humid}%` : '--',
      icon: 'water-percent',
      color: CONFIG.COLORS.info,
      unit: '%'
    },
    {
      id: 'gas',
      label: t('sensors.labels.gasLevel'),
      value: latestTelemetry.gas_ppm !== null && latestTelemetry.gas_ppm !== undefined ? `${latestTelemetry.gas_ppm} ppm` : '--',
      icon: 'molecule-co2',
      color: CONFIG.COLORS.warning,
      unit: 'ppm'
    },
    {
      id: 'smoke',
      label: t('sensors.labels.smoke'),
      value: latestTelemetry.smoke !== null && latestTelemetry.smoke !== undefined ? (latestTelemetry.smoke > 0 ? t('sensors.values.detected') : t('sensors.values.clear')) : '--',
      icon: 'smoke-detector',
      color: latestTelemetry.smoke > 0 ? CONFIG.COLORS.danger : CONFIG.COLORS.success,
      unit: ''
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.primary }]}>📊 {t('sensors.title')}</Text>
        {onViewChart && deviceData?.deviceId && (
          <TouchableOpacity
            style={[styles.chartButton, { backgroundColor: colors.primary }]}
            onPress={() => onViewChart(deviceData.deviceId)}
          >
            <MaterialCommunityIcons name="chart-line" size={18} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.grid}>
        {sensorData.map((sensor) => (
          <View key={sensor.id} style={[styles.sensorCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <View style={styles.sensorHeader}>
              <MaterialCommunityIcons 
                name={sensor.icon} 
                size={24} 
                color={sensor.color} 
              />
              <Text style={[styles.sensorLabel, { color: colors.textSecondary }]}>{sensor.label}</Text>
            </View>
            <Text style={[styles.sensorValue, { color: sensor.color }]}>
              {sensor.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  chartButton: {
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sensorCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sensorLabel: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SensorGrid;