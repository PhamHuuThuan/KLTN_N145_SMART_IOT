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
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 MQTT reconnecting...');
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      console.log(`📨 MQTT: ${topic}`);
      
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
      
      console.log(`✅ Valid device: ${deviceId}`);
      
      const data = JSON.parse(message.toString());

      if (messageType === 'telemetry') {
        console.log(`🌡️ Telemetry from ${deviceId}: temp=${data.temp}°C, humid=${data.humid}%, smoke=${data.smoke}, gas=${data.gas_ppm}ppm`);
        
        // Store data for this specific device
        const deviceData = {
          deviceId: deviceId,
          temperature: data.temp || null,
          humidity: data.humid || null,
          smoke: data.smoke || 0, 
          gasPpm: data.gas_ppm || null,
          mq2Voltage: data.mq2_v || null,
          flame: data.flame || 0,
          outlets: {
            o1: data.o?.o1 || false,
            o2: data.o?.o2 || false,
            o3: data.o?.o3 || false,
            o4: data.o?.o4 || false,
            o5: data.o?.o5 || false,
          },
          timestamp: new Date().toISOString(),
        };

        // Update device-specific data
        devicesData.set(deviceId, deviceData);
        
        // Update latest data (for backward compatibility)
        latestData = deviceData;

        console.log(`💾 Data updated for device ${deviceId}`);

        // emit to server/socket layer with device info
        mqttEvents.emit('sensorData', deviceData);
        mqttEvents.emit('deviceData', { deviceId, data: deviceData });

        // Publish to Kafka 
        console.log('🔄 Publishing to Kafka...');
        const telemetryData = {
          type: 'telemetry',
          deviceId: deviceId,
          topic,
          payload: {
            ts: Date.now(),
            temp: Number(data.temp) || 0,
            humid: Number(data.humid) || 0,
            smoke: Number(data.smoke) || 0,
            gas_ppm: Number(data.gas_ppm) || 0,
            o: {
              o1: Boolean(data.o?.o1) || false,
              o2: Boolean(data.o?.o2) || false,
              o3: Boolean(data.o?.o3) || false,
              o4: Boolean(data.o?.o4) || false,
              o5: Boolean(data.o?.o5) || false,
            }
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0'
          }
        };

        publishTelemetryLog(telemetryData)
          .then(() => {
            console.log('✅ Telemetry published to Kafka');
          })
          .catch(error => {
            console.error(`❌ Failed to publish to Kafka: ${error.message}`);
          });
      } else if (messageType === 'ack') {
        console.log('✅ ACK received');
        mqttEvents.emit('ack', data);
        
        // Publish ACK event to Kafka
        console.log('🔄 Publishing ACK to Kafka...');
        const ackData = {
          type: 'event',
          deviceId: deviceId,
          topic,
          payload: {
            ts: Date.now(),
            temp: 0,
            humid: 0,
            smoke: 0,
            gas_ppm: 0,
            o: { o1: false, o2: false, o3: false, o4: false, o5: false }
          },
          severity: 'low',
          metadata: {
            source: 'esp32',
            version: '1.0',
            ackData: data
          }
        };

        publishEventLog(ackData)
          .then(() => {
            console.log('✅ ACK published to Kafka');
          })
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
  console.log(`🔍 sendCommand called: deviceId=${deviceId}, action=${action}, payload=`, JSON.stringify(payload));
  
  if (!mqttClient) {
    console.error('❌ Cannot send command: MQTT client not initialized');
    return false;
  }
  
  if (!mqttClient.connected) {
    console.error('❌ Cannot send command: MQTT client not connected');
    console.log(`🔍 MQTT client state: connected=${mqttClient.connected}, reconnecting=${mqttClient.reconnecting}`);
    return false;
  }

  if (!deviceId) {
    console.error('❌ Cannot send command: deviceId is required');
    return false;
  }

  // Validate deviceId from database
  console.log(`🔍 Validating device: ${deviceId}`);
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

  console.log(`📤 Sending command: ${command.action} to ${deviceId}`);
  console.log(`📡 Publishing to topic: ${cmdTopic}`);
  console.log(`📋 Command payload:`, JSON.stringify(command));

  mqttClient.publish(cmdTopic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish command: ${err.message}`);
    } else {
      console.log('✅ Command published successfully');
    }
  });

  return true;
}

async function turnOnOutlet(deviceId) {
  console.log(`🔌 Turning ON outlet o1 for device ${deviceId}`);
  return await sendCommand(deviceId, 'SET_OUTLET', {
    params: { key: 'o1', state: 'ON' },
  });
}

async function turnOffOutlet(deviceId) {
  console.log(`🔌 Turning OFF outlet o1 for device ${deviceId}`);
  return await sendCommand(deviceId, 'SET_OUTLET', {
    params: { key: 'o1', state: 'OFF' },
  });
}

async function toggleOutlet(deviceId) {
  console.log(`🔌 Toggling outlet o1 for device ${deviceId}`);
  return await sendCommand(deviceId, 'TOGGLE_OUTLET', {
    params: { key: 'o1' },
  });
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
};


