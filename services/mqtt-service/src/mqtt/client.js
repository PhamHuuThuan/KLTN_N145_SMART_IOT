const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const axios = require('axios');
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
    mqttClient.subscribe([topics.telemetry, topics.ack]);
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

  mqttClient.on('message', (topic, message) => {
    try {
      console.log(`📨 MQTT: ${topic}`);
      
      const data = JSON.parse(message.toString());

      if (topic === topics.telemetry) {
        console.log(`🌡️ Telemetry: temp=${data.temp}°C, humid=${data.humid}%, smoke=${data.smoke}, gas=${data.gas_ppm}ppm`);
        
        latestData = {
          temperature: data.temp || null,
          humidity: data.humid || null,
          smoke: data.smoke || 0,  // Keep as number for consistency
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

        console.log('💾 Data updated');

        // emit to server/socket layer
        mqttEvents.emit('sensorData', latestData);

                 // forward to device service
         console.log('🔄 Forwarding to devices-service...');
                   axios.post(`${config.deviceService.url}/api/logs`, {
           type: 'telemetry',
           deviceId: config.service.deviceId,
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
         })
          .then(response => {
            console.log('✅ Log saved successfully');
          })
          .catch(error => {
            console.error(`❌ Failed to save log: ${error.message}`);
          });
      } else if (topic === topics.ack) {
        console.log('✅ ACK received');
        mqttEvents.emit('ack', data);
        
                 // forward to device service
         console.log('🔄 Forwarding ACK to devices-service...');
         axios.post(`${config.deviceService.url}/api/logs`, {
           type: 'event',
           deviceId: config.service.deviceId,
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
         })
          .then(response => {
            console.log('✅ ACK log saved');
          })
          .catch(error => {
            console.error(`❌ Failed to save ACK log: ${error.message}`);
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

function sendCommand(action, payload = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error('❌ Cannot send command: MQTT client not connected');
    return false;
  }

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

  console.log(`📤 Sending command: ${command.action} to ${command.deviceId}`);
  console.log(`📡 Publishing to topic: ${topics.cmd}`);

  mqttClient.publish(topics.cmd, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish command: ${err.message}`);
    } else {
      console.log('✅ Command published successfully');
    }
    
         // forward to device service
     console.log('🔄 Forwarding command to devices-service...');
     axios.post(`${config.deviceService.url}/api/logs`, {
       type: 'command',
       deviceId: config.service.deviceId,
       topic: topics.cmd,
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
         source: 'mqtt-service',
         version: '1.0',
         command: command,
         error: err ? String(err) : null
       }
     })
      .then(response => {
        console.log('✅ Command log saved');
      })
      .catch(error => {
        console.error(`❌ Failed to save command log: ${error.message}`);
      });
  });

  return true;
}

function turnOnOutlet() {
  console.log('🔌 Turning ON outlet o1');
  return sendCommand('SET_STATE', {
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'ON' },
  });
}

function turnOffOutlet() {
  console.log('🔌 Turning OFF outlet o1');
  return sendCommand('SET_STATE', {
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'OFF' },
  });
}

function toggleOutlet() {
  console.log('🔌 Toggling outlet o1');
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


