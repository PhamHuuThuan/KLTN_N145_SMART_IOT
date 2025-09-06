import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SENSOR_CONFIG } from '../constants/sensors';
import CONFIG from '../constants/config';

const SensorCard = ({ sensorType, value }) => {
  const config = SENSOR_CONFIG[sensorType];
  
  if (!config) {
    return null;
  }

  const formatValue = () => {
    if (value === null || value === undefined) {
      return '--';
    }

    if (config.isBoolean) {
      return value ? config.trueValue : config.falseValue;
    }

    return value.toFixed(config.precision) + config.unit;
  };

  return (
    <View style={[styles.sensorCard, { borderLeftColor: config.color }]}>
      <Text style={styles.sensorIcon}>{config.icon}</Text>
      <Text style={styles.sensorTitle}>{config.label}</Text>
      <Text style={styles.sensorValue}>{formatValue()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  sensorCard: {
    width: '48%',
    backgroundColor: CONFIG.COLORS.light,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    alignItems: 'center',
    minHeight: CONFIG.DIMENSIONS.sensorCardHeight,
    justifyContent: 'center',
  },
  sensorIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  sensorTitle: {
    fontSize: 12,
    color: CONFIG.COLORS.gray,
    marginBottom: 5,
    textAlign: 'center',
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    textAlign: 'center',
  },
});

export default SensorCard;
