const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const Log = require('../models/Log');
const config = require('../config');

const mqttEvents = new EventEmitter();

let mqttClient = null;
let mqttConnected = false;

let latestData = {
  temperature: null,
  humidity: null,
  smoke: false,
  gasPpm: null,
  outlets: { o1: false, o2: false, o3: false, o4: false, o5: false },
  timestamp: null,
};

function getTopics(deviceId) {
  return {
    telemetry: `iot/${deviceId}/telemetry`,
    ack: `iot/${deviceId}/ack`,
    cmd: `iot/${deviceId}/cmd`,
    led: `iot/${deviceId}/led`,
  };
}

function startMqtt() {
  const deviceId = config.service.deviceId;
  const topics = getTopics(deviceId);

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
    mqttClient.subscribe([topics.telemetry, topics.ack]);
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      if (topic === topics.telemetry) {
        latestData = {
          temperature: data.temp || null,
          humidity: data.humid || null,
          smoke: data.smoke === 1,
          gasPpm: data.gas_ppm || null,
          outlets: {
            o1: data.o?.o1 || false,
            o2: data.o?.o2 || false,
            o3: data.o?.o3 || false,
            o4: data.o?.o4 || false,
            o5: data.o?.o5 || false,
          },
          timestamp: new Date().toISOString(),
        };

        // emit to server/socket layer
        mqttEvents.emit('sensorData', latestData);

        // persist log
        Log.create({ type: 'telemetry', deviceId, topic, payload: data }).catch(() => {});
      } else if (topic === topics.ack) {
        mqttEvents.emit('ack', data);
        Log.create({ type: 'ack', deviceId, topic, payload: data }).catch(() => {});
      }
    } catch (err) {
      // ignore parsing errors silently or log as needed
    }
  });
}

function isConnected() {
  return !!mqttClient && mqttConnected;
}

function getLatestData() {
  return latestData;
}

function sendCommand(action, payload = {}) {
  if (!mqttClient || !mqttClient.connected) return false;

  const deviceId = config.service.deviceId;
  const topics = getTopics(deviceId);

  const target = payload.target;
  const params = payload.params ?? payload;

  const command = {
    action,
    ...(target ? { target } : {}),
    params: params || {},
    timestamp: new Date().toISOString(),
  };

  mqttClient.publish(topics.cmd, JSON.stringify(command), { qos: 1 }, (err) => {
    // store regardless of success; include possible err in payload meta
    Log.create({ type: 'command', deviceId, topic: topics.cmd, payload: { command, error: err ? String(err) : null } }).catch(() => {});
  });

  return true;
}

function turnOnOutlet() {
  return sendCommand('SET_STATE', {
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'ON' },
  });
}

function turnOffOutlet() {
  return sendCommand('SET_STATE', {
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'OFF' },
  });
}

function toggleOutlet() {
  return sendCommand('TOGGLE');
}

module.exports = {
  startMqtt,
  mqttEvents,
  isConnected,
  getLatestData,
  sendCommand,
  turnOnOutlet,
  turnOffOutlet,
  toggleOutlet,
};


