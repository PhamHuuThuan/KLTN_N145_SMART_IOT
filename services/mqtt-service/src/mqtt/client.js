const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const config = require('../config');
const { publishTelemetryLog, publishEventLog } = require('../config/kafka');
const deviceService = require('../services/deviceService');
const { logger } = require('../utils/logger');

const mqttEvents = new EventEmitter();

let mqttClient = null;
let mqttConnected = false;

// Store data for multiple devices
let devicesData = new Map();
let latestData = {
  temperature: null,
  humidity: null,
  smoke: false,
  gasPpm: null,
  outlets: { o1: false, o2: false, o3: false, o4: false },
  timestamp: null,
  deviceId: null,
};

function startMqtt() {
  logger.info(`Connecting to MQTT: ${config.mqtt.host}:${config.mqtt.port}`);

  mqttClient = mqtt.connect(`mqtt://${config.mqtt.host}:${config.mqtt.port}`, {
    clientId: 'mqtt-service-' + Math.random().toString(16).substr(2, 8),
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10 * 1000,
    keepalive: 60,
    protocolVersion: 4,
    rejectUnauthorized: false,
    username: config.mqtt.username,
    password: config.mqtt.password,
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;
    logger.info('MQTT connected');
    const topics = ['iot/+/telemetry', 'iot/+/ack'];
    logger.info(`Subscribing to topics: ${topics.join(', ')}`);
    mqttClient.subscribe(topics, (err, granted) => {
      if (err) {
        logger.error(`Subscription error: ${err.message}`);
      } else {
        logger.info(`Subscription successful. Granted:`, granted);
      }
    });
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
    logger.error('MQTT connection closed');
  });

  mqttClient.on('error', (error) => {
    logger.error(`MQTT error: ${error.message}`);
    logger.error('MQTT error details:', error);
  });

  mqttClient.on('reconnect', () => {
    logger.info('MQTT reconnecting...');
  });

  mqttClient.on('offline', () => {
    mqttConnected = false;
    logger.info('MQTT client offline');
  });

  mqttClient.on('disconnect', () => {
    mqttConnected = false;
    logger.info('MQTT client disconnected');
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      // Extract deviceId from topic (format: iot/{deviceId}/telemetry or iot/{deviceId}/ack)
      const topicParts = topic.split('/');
      if (topicParts.length !== 3 || topicParts[0] !== 'iot') {
        return;
      }
      
      const deviceId = topicParts[1];
      const messageType = topicParts[2];
      
      // Validate deviceId from database (skip if validation disabled)
      const validationEnabled = process.env.DEVICE_VALIDATION_ENABLED === 'true';
      if (validationEnabled) {
        const isValidDevice = await deviceService.isValidDevice(deviceId);
        if (!isValidDevice) {
          logger.warn(`Device validation failed for ${deviceId}, skipping message`);
          return;
        }
      }
      
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (parseErr) {
        logger.error(`MQTT message parse error on topic ${topic}: ${parseErr.message}`);
        return;
      }
      const toNumber = (value) => (value ?? null) !== null ? Number(value) : null;
      const toBoolean = (value) => (value ?? null) !== null ? Boolean(Number(value)) : null;

      if (messageType === 'telemetry') {
        
        // Store data for this specific device
        const deviceData = {
          deviceId: deviceId,
          temperature: toNumber(data.temp),
          humidity: toNumber(data.humid),
          smoke: toNumber(data.smoke),
          gasPpm: toNumber(data.gas_ppm),
          mq2Voltage: toNumber(data.mq2_v),
          flame: toBoolean(data.flame),
          outlets: {
            o1: (data.o?.o1 ?? null),
            o2: (data.o?.o2 ?? null),
            o3: (data.o?.o3 ?? null),
            o4: (data.o?.o4 ?? null)
          },
          timestamp: new Date().toISOString(),
        };

        // Update device-specific data
        devicesData.set(deviceId, deviceData);
        
        // Update latest data (for backward compatibility)
        latestData = deviceData;

        // emit to server/socket layer with device info
        mqttEvents.emit('sensorData', deviceData);
        mqttEvents.emit('deviceData', { deviceId, data: deviceData });

        // Get device info to get ownerId (skip if validation disabled for better performance)
        // ownerId will be set by devices-service when processing from Kafka
        let ownerId = null;
        const deviceInfo = await deviceService.getDevice(deviceId);
        ownerId = deviceInfo?.ownerId;

        // Publish to Kafka (let devices-service handle device creation/validation) 
        const telemetryData = {
          type: 'telemetry',
          deviceId: deviceId,
          ownerId: ownerId, // Add ownerId here
          topic,
          payload: {
            ts: Date.now(),
            temp: toNumber(data.temp),
            humid: toNumber(data.humid),
            smoke: toNumber(data.smoke),
            gas_ppm: toNumber(data.gas_ppm),
            flame: toBoolean(data.flame),
            o: {
              o1: (data.o?.o1 ?? null),
              o2: (data.o?.o2 ?? null),
              o3: (data.o?.o3 ?? null),
              o4: (data.o?.o4 ?? null)
            }
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0'
          }
        };

        try {
          await publishTelemetryLog(telemetryData);
        } catch (error) {
          logger.error(`Failed to publish telemetry to Kafka (skipped): ${error.message}`);
        }
      } else if (messageType === 'ack') {
        logger.info(`ACK received from ${deviceId}:`, data);
        mqttEvents.emit('ack', data);
        
        // Get device info to get ownerId (skip if validation disabled)
        let ownerId = null;
        if (validationEnabled) {
          const deviceInfo = await deviceService.getDevice(deviceId);
          ownerId = deviceInfo?.ownerId;
        }
        
        // Publish ACK event to Kafka with outlet info if available
        const ackData = {
          type: 'event',
          deviceId: deviceId,
          ownerId: ownerId,
          topic,
          payload: {
            ts: Date.now(),
            ack: true,
            // Include outlet info if ESP32 sends it in ACK
            ...(data.o && { o: data.o })
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0',
            ackData: data, // Store full ACK data for debugging
            timestamp: new Date().toISOString(),
            // Store ACK-specific fields
            action: data.action,
            message: data.message,
            status: data.status
          }
        };

        try {
          await publishEventLog(ackData);
          logger.info(`Published event to Kafka: ${deviceId}`);
        } catch (error) {
          logger.error(`Failed to publish ACK to Kafka (skipped): ${error.message}`);
        }
      }
    } catch (err) {
      logger.error(`Error processing MQTT message: ${err.message}`);
    }
  });
}

function isConnected() {
  const connected = !!mqttClient && mqttConnected;
  logger.info(`MQTT connection status: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
  return connected;
}

function getLatestData() {
  return latestData;
}

function getDeviceData(deviceId) {
  return devicesData.get(deviceId) || null;
}

function getAllDevicesData() {
  const result = {};
  for (const [deviceId, data] of devicesData.entries()) {
    result[deviceId] = data;
  }
  return result;
}

function getDevicesList() {
  return Array.from(devicesData.keys());
}

async function sendCommand(deviceId, action, payload = {}) {
  logger.info(`sendCommand: ${deviceId}, action: ${action}, payload:`, payload);
  
  if (!mqttClient) {
    logger.error('Cannot send command: MQTT client not initialized');
    return false;
  }
  
  if (!mqttClient.connected) {
    logger.error('Cannot send command: MQTT client not connected');
    return false;
  }

  if (!deviceId) {
    logger.error('Cannot send command: deviceId is required');
    return false;
  }

  // Validate deviceId from database
  const isValidDevice = await deviceService.isValidDevice(deviceId);
  if (!isValidDevice) {
    logger.error(`Cannot send command: Invalid or inactive device ${deviceId}`);
    return false;
  }

  const params = payload.params ?? payload;

  const command = {
    action,
    params: params || {},
  };

  const cmdTopic = `iot/${deviceId}/cmd`;
  
  mqttClient.publish(cmdTopic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) {
      logger.error(`Failed to publish command to topic: ${cmdTopic}: ${err.message}`);
    } else {
      
      logger.info(`Command published successfully to topic: ${cmdTopic}`);
    }
  });

  return true;
}

async function turnOnOutlet(deviceId) {
  return await sendCommand(deviceId, 'SET_OUTLET', {
    params: { key: 'o1', state: 'ON' },
  });
}

async function turnOffOutlet(deviceId) {
  return await sendCommand(deviceId, 'SET_OUTLET', {
    params: { key: 'o1', state: 'OFF' },
  });
}

async function toggleOutlet(deviceId) {
  return await sendCommand(deviceId, 'TOGGLE_OUTLET', {
    params: { key: 'o1' },
  });
}

async function updateDeviceOutletSettings(deviceId, outletId, settings) {
  try {
    // Update local device data
    const deviceData = devicesData.get(deviceId);
    if (deviceData && deviceData.outlets) {
      deviceData.outlets[outletId] = {
        ...deviceData.outlets[outletId],
        ...settings
      };
      devicesData.set(deviceId, deviceData);
    }

    // Emit event for real-time updates
    mqttEvents.emit('outletSettingsUpdated', {
      deviceId,
      outletId,
      settings
    });

    return true;
  } catch (error) {
    logger.error('Error updating outlet settings:', error);
    return false;
  }
}

module.exports = {
  startMqtt,
  mqttEvents,
  isConnected,
  getLatestData,
  getDeviceData,
  getAllDevicesData,
  getDevicesList,
  sendCommand,
  turnOnOutlet,
  turnOffOutlet,
  toggleOutlet,
  updateDeviceOutletSettings,
};


