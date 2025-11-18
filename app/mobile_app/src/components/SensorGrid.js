import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const SensorGrid = ({ deviceData, onViewChart }) => {
  const { colors, isDarkMode } = useTheme();
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

  // Thresholds for sensor levels
  const THRESHOLDS = {
    temperature: { low: 15, normal: 40, high: 50 },
    humidity: { low: 30, normal: 80, high: 90 },
    gas: { low: 200, normal: 500, high: 1000 },
    smoke: { low: 1.0, normal: 1.4, high: 1.6 },
  };

  //levels - Light mode
  const LEVEL_COLORS_LIGHT = {
    low: '#E3F2FD', 
    normal: '#F5F5F5',
    high: '#FFF3E0',
    veryHigh: '#FFEBEE',
  };

  //levels - Dark mode
  const LEVEL_COLORS_DARK = {
    low:      '#1E3A8A',
    normal:   '#4B5563',
    high:     '#DC6A00',
    veryHigh: '#DC2626',
  };

  // Select colors based on theme
  const LEVEL_COLORS = isDarkMode ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;

  // Determine sensor level
  const getSensorLevel = (value, thresholds) => {
    if (value === null || value === undefined) return 'normal';
    if (value < thresholds.low) return 'low';
    if (value < thresholds.normal) return 'normal';
    if (value < thresholds.high) return 'high';
    return 'veryHigh';
  };

  // Smoke threshold: 1.6V (based on firmware SMOKE_AO_ON_V)
  const SMOKE_THRESHOLD = 1.6;
  const smokeVoltage = latestTelemetry.smoke !== null && latestTelemetry.smoke !== undefined 
    ? Number(latestTelemetry.smoke) 
    : null;
  const smokeDetected = smokeVoltage !== null && smokeVoltage >= SMOKE_THRESHOLD;
  const smokeDisplay = smokeVoltage !== null 
    ? `${smokeVoltage.toFixed(2)} V` 
    : '--';

  // Calculate levels for each sensor
  const tempLevel = getSensorLevel(latestTelemetry.temp, THRESHOLDS.temperature);
  const humidLevel = getSensorLevel(latestTelemetry.humid, THRESHOLDS.humidity);
  const gasLevel = getSensorLevel(latestTelemetry.gas_ppm, THRESHOLDS.gas);
  const smokeLevel = getSensorLevel(smokeVoltage, THRESHOLDS.smoke);

  const sensorData = [
    {
      id: 'temperature',
      label: t('sensors.labels.temperature'),
      value: latestTelemetry.temp !== null && latestTelemetry.temp !== undefined ? `${latestTelemetry.temp}°C` : '--',
      icon: 'thermometer',
      color: CONFIG.COLORS.danger,
      unit: '°C',
      level: tempLevel,
      backgroundColor: LEVEL_COLORS[tempLevel],
    },
    {
      id: 'humidity',
      label: t('sensors.labels.humidity'),
      value: latestTelemetry.humid !== null && latestTelemetry.humid !== undefined ? `${latestTelemetry.humid}%` : '--',
      icon: 'water-percent',
      color: CONFIG.COLORS.info,
      unit: '%',
      level: humidLevel,
      backgroundColor: LEVEL_COLORS[humidLevel],
    },
    {
      id: 'gas',
      label: t('sensors.labels.gasLevel'),
      value: latestTelemetry.gas_ppm !== null && latestTelemetry.gas_ppm !== undefined ? `${Math.round(latestTelemetry.gas_ppm)} ppm` : '--',
      icon: 'molecule-co2',
      color: CONFIG.COLORS.warning,
      unit: 'ppm',
      level: gasLevel,
      backgroundColor: LEVEL_COLORS[gasLevel],
    },
    {
      id: 'smoke',
      label: t('sensors.labels.smoke'),
      value: smokeDisplay,
      icon: 'smoke-detector',
      color: smokeDetected ? CONFIG.COLORS.danger : CONFIG.COLORS.success,
      unit: 'V',
      level: smokeLevel,
      backgroundColor: LEVEL_COLORS[smokeLevel],
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.primary }]}>📊 {t('sensors.title')}</Text>
        {onViewChart && deviceData?.deviceId && (
          <TouchableOpacity
            style={[styles.chartButton, { backgroundColor: colors.primary }]}
            onPress={() => onViewChart(deviceData?.deviceId)}
          >
            <MaterialCommunityIcons name="chart-line" size={18} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.grid}>
        {sensorData.map((sensor) => (
          <View key={sensor.id} style={[styles.sensorCard, { backgroundColor: sensor.backgroundColor || colors.backgroundSecondary, borderColor: colors.border }]}>
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
      
      {/* Color Legend Bar */}
      <View style={styles.legendContainer}>
        <View style={styles.legendBar}>
          <View style={[styles.legendSegment, { backgroundColor: LEVEL_COLORS.low }]}>
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {t('sensors.legend.low', 'Thấp')}
            </Text>
          </View>
          <View style={[styles.legendSegment, { backgroundColor: LEVEL_COLORS.normal }]}>
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {t('sensors.legend.normal', 'Bình thường')}
            </Text>
          </View>
          <View style={[styles.legendSegment, { backgroundColor: LEVEL_COLORS.high }]}>
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {t('sensors.legend.high', 'Cao')}
            </Text>
          </View>
          <View style={[styles.legendSegment, { backgroundColor: LEVEL_COLORS.veryHigh }]}>
            <Text style={[styles.legendLabel, { color: colors.text }]}>
              {t('sensors.legend.veryHigh', 'Rất cao')}
            </Text>
          </View>
        </View>
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
  legendContainer: {
    paddingTop: 0,
  },
  legendBar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 5,
    overflow: 'hidden',
  },
  legendSegment: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
  },
});

export default SensorGrid;