const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const config = require('../config');
const { publishTelemetryLog, publishEventLog } = require('../config/kafka');
const deviceService = require('../services/deviceService');

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
  outlets: { o1: false, o2: false, o3: false, o4: false, o5: false },
  timestamp: null,
  deviceId: null,
};

function startMqtt() {
  console.log(`🔌 Connecting to MQTT: ${config.mqtt.host}:${config.mqtt.port}`);

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
    console.log('✅ MQTT connected');
    // Subscribe to all device topics using wildcards
    mqttClient.subscribe(['iot/+/telemetry', 'iot/+/ack']);
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
    console.log('❌ MQTT connection closed');
  });

  mqttClient.on('error', (error) => {
    console.error(`🚨 MQTT error: ${error.message}`);
    console.error('🚨 MQTT error details:', error);
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
  });

  mqttClient.on('offline', () => {
    mqttConnected = false;
    console.log('📴 MQTT client offline');
  });

  mqttClient.on('disconnect', () => {
    mqttConnected = false;
    console.log('🔌 MQTT client disconnected');
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      // Extract deviceId from topic (format: iot/{deviceId}/telemetry or iot/{deviceId}/ack)
      const topicParts = topic.split('/');
      if (topicParts.length !== 3 || topicParts[0] !== 'iot') {
        console.error(`❌ Invalid topic format: ${topic}`);
        return;
      }
      
      const deviceId = topicParts[1];
      const messageType = topicParts[2];
      
      // Validate deviceId from database
      const isValidDevice = await deviceService.isValidDevice(deviceId);
      if (!isValidDevice) {
        console.error(`❌ Invalid or inactive device: ${deviceId}`);
        return;
      }
      
      const data = JSON.parse(message.toString());

      if (messageType === 'telemetry') {
        console.log(`🌡️ Telemetry from ${deviceId}: temp=${data.temp}°C, humid=${data.humid}%, smoke=${data.smoke}, gas=${data.gas_ppm}ppm`);
        
        // Store data for this specific device
        const deviceData = {
          deviceId: deviceId,
          temperature: (data.temp ?? null),
          humidity: (data.humid ?? null),
          smoke: (data.smoke ?? null),
          gasPpm: (data.gas_ppm ?? null),
          mq2Voltage: (data.mq2_v ?? null),
          flame: (data.flame ?? null),
          outlets: {
            o1: (data.o?.o1 ?? null),
            o2: (data.o?.o2 ?? null),
            o3: (data.o?.o3 ?? null),
            o4: (data.o?.o4 ?? null),
            o5: (data.o?.o5 ?? null),
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

        // Publish to Kafka 
        const telemetryData = {
          type: 'telemetry',
          deviceId: deviceId,
          topic,
          payload: {
            ts: Date.now(),
            temp: (data.temp ?? null) !== null ? Number(data.temp) : null,
            humid: (data.humid ?? null) !== null ? Number(data.humid) : null,
            smoke: (data.smoke ?? null) !== null ? Number(data.smoke) : null,
            gas_ppm: (data.gas_ppm ?? null) !== null ? Number(data.gas_ppm) : null,
            o: {
              o1: (data.o?.o1 ?? null),
              o2: (data.o?.o2 ?? null),
              o3: (data.o?.o3 ?? null),
              o4: (data.o?.o4 ?? null),
              o5: (data.o?.o5 ?? null),
            }
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0'
          }
        };

        publishTelemetryLog(telemetryData)
          .catch(error => {
            console.error(`❌ Failed to publish to Kafka: ${error.message}`);
          });
      } else if (messageType === 'ack') {
        console.log('✅ ACK received');
        mqttEvents.emit('ack', data);
        
        // Publish ACK event to Kafka
        const ackData = {
          type: 'event',
          deviceId: deviceId,
          topic,
          payload: {
            ts: Date.now(),
            ack: true
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0',
            ackData: data
          }
        };

        publishEventLog(ackData)
          .catch(error => {
            console.error(`❌ Failed to publish ACK to Kafka: ${error.message}`);
          });
      }
    } catch (err) {
      console.error(`❌ Error processing MQTT message: ${err.message}`);
      console.error('📋 Topic:', topic);
    }
  });
}

function isConnected() {
  const connected = !!mqttClient && mqttConnected;
  console.log(`🔌 MQTT connection status: ${connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
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
  console.log(`🔌 sendCommand: ${deviceId}, action: ${action}, payload:`, payload);
  
  if (!mqttClient) {
    console.error('❌ Cannot send command: MQTT client not initialized');
    return false;
  }
  
  if (!mqttClient.connected) {
    console.error('❌ Cannot send command: MQTT client not connected');
    return false;
  }

  if (!deviceId) {
    console.error('❌ Cannot send command: deviceId is required');
    return false;
  }

  // Validate deviceId from database
  const isValidDevice = await deviceService.isValidDevice(deviceId);
  if (!isValidDevice) {
    console.error(`❌ Cannot send command: Invalid or inactive device ${deviceId}`);
    return false;
  }

  const params = payload.params ?? payload;

  const command = {
    action,
    params: params || {},
  };

  const cmdTopic = `iot/${deviceId}/cmd`;

  console.log(`📡 Publishing MQTT command to topic: ${cmdTopic}`);
  console.log(`📋 Command payload:`, JSON.stringify(command, null, 2));
  
  mqttClient.publish(cmdTopic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish command: ${err.message}`);
    } else {
      console.log(`✅ MQTT command published successfully`);
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
    console.error('❌ Error updating outlet settings:', error);
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


