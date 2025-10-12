import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

const SensorGrid = ({ deviceData }) => {
  const { colors } = useTheme();
  
  if (!deviceData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>Device data not found</Text>
      </View>
    );
  }

  const { latestTelemetry } = deviceData;
  if (!latestTelemetry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.noDataText, { color: colors.textSecondary }]}>No telemetry data</Text>
      </View>
    );
  }

  const sensorData = [
    {
      id: 'temperature',
      label: 'Temperature',
      value: latestTelemetry.temp !== null && latestTelemetry.temp !== undefined ? `${latestTelemetry.temp}°C` : '--',
      icon: 'thermometer',
      color: CONFIG.COLORS.danger,
      unit: '°C'
    },
    {
      id: 'humidity',
      label: 'Humidity',
      value: latestTelemetry.humid !== null && latestTelemetry.humid !== undefined ? `${latestTelemetry.humid}%` : '--',
      icon: 'water-percent',
      color: CONFIG.COLORS.info,
      unit: '%'
    },
    {
      id: 'gas',
      label: 'Gas Level',
      value: latestTelemetry.gas_ppm !== null && latestTelemetry.gas_ppm !== undefined ? `${latestTelemetry.gas_ppm} ppm` : '--',
      icon: 'molecule-co2',
      color: CONFIG.COLORS.warning,
      unit: 'ppm'
    },
    {
      id: 'smoke',
      label: 'Smoke',
      value: latestTelemetry.smoke !== null && latestTelemetry.smoke !== undefined ? (latestTelemetry.smoke > 0 ? 'Detected' : 'Clear') : '--',
      icon: 'smoke-detector',
      color: latestTelemetry.smoke > 0 ? CONFIG.COLORS.danger : CONFIG.COLORS.success,
      unit: ''
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.primary }]}>📊 Sensor Data</Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
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