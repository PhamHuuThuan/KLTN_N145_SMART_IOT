import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const SensorGrid = ({ deviceData }) => {
  if (!deviceData) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No sensor data available</Text>
      </View>
    );
  }

  const { latestTelemetry } = deviceData;
  if (!latestTelemetry) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No telemetry data available</Text>
      </View>
    );
  }

  const sensorData = [
    {
      id: 'temperature',
      label: 'Temperature',
      value: latestTelemetry.temperature ? `${latestTelemetry.temperature}°C` : '--',
      icon: 'thermostat',
      color: CONFIG.COLORS.danger,
      unit: '°C'
    },
    {
      id: 'humidity',
      label: 'Humidity',
      value: latestTelemetry.humidity ? `${latestTelemetry.humidity}%` : '--',
      icon: 'water-drop',
      color: CONFIG.COLORS.info,
      unit: '%'
    },
    {
      id: 'gas',
      label: 'Gas Level',
      value: latestTelemetry.gasPpm ? `${latestTelemetry.gasPpm} ppm` : '--',
      icon: 'air',
      color: CONFIG.COLORS.warning,
      unit: 'ppm'
    },
    {
      id: 'smoke',
      label: 'Smoke',
      value: latestTelemetry.smoke ? 'Detected' : 'Clear',
      icon: 'smoke-free',
      color: latestTelemetry.smoke ? CONFIG.COLORS.danger : CONFIG.COLORS.success,
      unit: ''
    },
    {
      id: 'mq2',
      label: 'MQ2 Voltage',
      value: latestTelemetry.mq2Voltage ? `${latestTelemetry.mq2Voltage}V` : '--',
      icon: 'electrical-services',
      color: CONFIG.COLORS.secondary,
      unit: 'V'
    },
    {
      id: 'flame',
      label: 'Flame',
      value: latestTelemetry.flame ? 'Detected' : 'Clear',
      icon: 'local-fire-department',
      color: latestTelemetry.flame ? CONFIG.COLORS.danger : CONFIG.COLORS.success,
      unit: ''
    }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Sensor Data</Text>
      <View style={styles.grid}>
        {sensorData.map((sensor) => (
          <View key={sensor.id} style={styles.sensorCard}>
            <View style={styles.sensorHeader}>
              <MaterialIcons 
                name={sensor.icon} 
                size={24} 
                color={sensor.color} 
              />
              <Text style={styles.sensorLabel}>{sensor.label}</Text>
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
    backgroundColor: CONFIG.COLORS.light,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sensorLabel: {
    fontSize: 12,
    color: CONFIG.COLORS.gray,
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
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SensorGrid;