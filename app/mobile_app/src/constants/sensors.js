// Sensor configuration and metadata

export const SENSOR_TYPES = {
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  SMOKE: 'smoke',
  GAS_PPM: 'gasPpm',
  MQ2_VOLTAGE: 'mq2Voltage',
  FLAME: 'flame',
};

export const SENSOR_CONFIG = {
  [SENSOR_TYPES.TEMPERATURE]: {
    label: 'Temperature',
    unit: '°C',
    icon: '🌡️',
    color: '#E74C3C',
    precision: 1,
  },
  [SENSOR_TYPES.HUMIDITY]: {
    label: 'Humidity',
    unit: '%',
    icon: '💧',
    color: '#3498DB',
    precision: 1,
  },
  [SENSOR_TYPES.SMOKE]: {
    label: 'Smoke',
    unit: '',
    icon: '🚬',
    color: '#E74C3C',
    precision: 0,
    isBoolean: true,
    trueValue: 'Detected',
    falseValue: 'Normal',
  },
  [SENSOR_TYPES.GAS_PPM]: {
    label: 'Gas PPM',
    unit: 'ppm',
    icon: '💨',
    color: '#F39C12',
    precision: 1,
  },
  [SENSOR_TYPES.MQ2_VOLTAGE]: {
    label: 'MQ2 Voltage',
    unit: 'V',
    icon: '⚡',
    color: '#9B59B6',
    precision: 3,
  },
  [SENSOR_TYPES.FLAME]: {
    label: 'Flame',
    unit: '',
    icon: '🔥',
    color: '#E74C3C',
    precision: 0,
    isBoolean: true,
    trueValue: 'Detected',
    falseValue: 'Normal',
  },
};

export const SENSOR_ORDER = [
  SENSOR_TYPES.TEMPERATURE,
  SENSOR_TYPES.HUMIDITY,
  SENSOR_TYPES.SMOKE,
  SENSOR_TYPES.GAS_PPM,
  SENSOR_TYPES.MQ2_VOLTAGE,
  SENSOR_TYPES.FLAME,
];

export default {
  SENSOR_TYPES,
  SENSOR_CONFIG,
  SENSOR_ORDER,
};
