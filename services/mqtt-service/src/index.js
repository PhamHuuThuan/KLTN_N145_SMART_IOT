const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return '127.0.0.1';
}

// MQTT Configuration
const MQTT_CONFIG = {
  host: process.env.MQTT_HOST || '192.168.110.112', // Use actual IP
  port: process.env.MQTT_PORT || 1883,
  clientId: 'mqtt-service-' + Math.random().toString(16).substr(2, 8)
};

// Device configuration
const DEVICE_ID = process.env.DEVICE_ID || 'KITCHEN-ESP32-LED1';
const TOPICS = {
  telemetry: `iot/${DEVICE_ID}/telemetry`,
  ack: `iot/${DEVICE_ID}/ack`,
  cmd: `iot/${DEVICE_ID}/cmd`,
  led: `iot/${DEVICE_ID}/led`
};

// Express app setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store latest sensor data
let latestData = {
  temperature: null,
  humidity: null,
  smoke: false,
  gasPpm: null,
  outlets: {
    o1: false,  // LED/ổ cắm 1
    o2: false,
    o3: false,
    o4: false,
    o5: false
  },
  timestamp: null
};

// MQTT Client
let mqttClient = null;

// Initialize MQTT connection
function initMqtt() {
  console.log(`🔍 Local IP detected: ${getLocalIP()}`);
  console.log(`🔌 Connecting to MQTT broker at ${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`);
  
  mqttClient = mqtt.connect(`mqtt://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
    clientId: MQTT_CONFIG.clientId,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10 * 1000,
    keepalive: 60,
    protocolVersion: 4, // MQTT 3.1.1
    rejectUnauthorized: false
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    
    // Subscribe to device topics
    mqttClient.subscribe(TOPICS.telemetry, (err) => {
      if (err) console.error('❌ Failed to subscribe to telemetry:', err);
      else console.log(`📡 Subscribed to ${TOPICS.telemetry}`);
    });
    
    mqttClient.subscribe(TOPICS.ack, (err) => {
      if (err) console.error('❌ Failed to subscribe to ack:', err);
      else console.log(`📡 Subscribed to ${TOPICS.ack}`);
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received on ${topic}:`, data);
      
      if (topic === TOPICS.telemetry) {
        // Update latest sensor data
        latestData = {
          temperature: data.temp || null,
          humidity: data.humid || null,
          smoke: data.smoke === 1,
          gasPpm: data.gas_ppm || null,
          outlets: {
            o1: data.o?.o1 || false,  // LED/ổ cắm 1
            o2: data.o?.o2 || false,
            o3: data.o?.o3 || false,
            o4: data.o?.o4 || false,
            o5: data.o?.o5 || false
          },
          timestamp: new Date().toISOString()
        };
        
        // Emit to web clients
        io.emit('sensorData', latestData);
        
        // Log sensor data
        console.log(`🌡️  Temperature: ${latestData.temperature}°C`);
        console.log(`💧 Humidity: ${latestData.humidity}%`);
        console.log(`🚬 Smoke: ${latestData.smoke ? 'DETECTED!' : 'None'}`);
        console.log(`☁️  Gas PPM: ${latestData.gasPpm}`);
        console.log(`🔌 Outlets: o1=${latestData.outlets.o1 ? 'ON' : 'OFF'}, o2=${latestData.outlets.o2 ? 'ON' : 'OFF'}, o3=${latestData.outlets.o3 ? 'ON' : 'OFF'}, o4=${latestData.outlets.o4 ? 'ON' : 'OFF'}, o5=${latestData.outlets.o5 ? 'ON' : 'OFF'}`);
        console.log('---');
      } else if (topic === TOPICS.ack) {
        console.log(`✅ Device acknowledgment: ${data.status}`);
        io.emit('ack', data);
      }
    } catch (error) {
      console.error('❌ Error parsing MQTT message:', error);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ MQTT error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Syscall:', error.syscall);
  });

  mqttClient.on('close', () => {
    console.log('🔌 MQTT connection closed');
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });

  mqttClient.on('offline', () => {
    console.log('📴 MQTT client offline');
  });
}

// Send command to device
function sendCommand(action, payload = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error('❌ MQTT client not connected');
    return false;
  }

  // Chuẩn hóa: nếu người gọi nhét target/params vào payload,
  // ta "bốc" lên root cho đúng format firmware.
  const target = payload.target;                          // có thì dùng
  const params = payload.params ?? payload;               // ưu tiên payload.params, nếu không có thì lấy payload (đề phòng gọi kiểu {state:"ON"})

  const command = {
    action,
    ...(target ? { target } : {}),
    params: params || {},
    timestamp: new Date().toISOString(),
  };

  console.log('Will publish command:', command);          // DEBUG
  mqttClient.publish(TOPICS.cmd, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) console.error('❌ Failed to send command:', err);
    else     console.log('📤 Sent command:', command);
  });

  return true;
}

// Outlet control functions (o1 = LED)
function turnOnOutlet() {
  return sendCommand('SET_STATE', { 
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'ON' }
  });
}

function turnOffOutlet() {
  return sendCommand('SET_STATE', { 
    target: { kind: 'outlet', key: 'o1' },
    params: { state: 'OFF' }
  });
}

function toggleOutlet() {
  return sendCommand('TOGGLE');
}

// Express routes
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    mqtt: mqttClient ? mqttClient.connected : false,
    device: DEVICE_ID,
    latestData,
    mqttConfig: MQTT_CONFIG
  });
});

app.post('/api/outlet/on', (req, res) => {
  const success = turnOnOutlet();
  res.json({ success, action: 'turnOn', outlet: 'o1' });
});

app.post('/api/outlet/off', (req, res) => {
  const success = turnOffOutlet();
  res.json({ success, action: 'turnOff', outlet: 'o1' });
});

app.post('/api/outlet/toggle', (req, res) => {
  const success = toggleOutlet();
  res.json({ success, action: 'toggle', outlet: 'o1' });
});

// WebSocket events
io.on('connection', (socket) => {
  console.log('🌐 Web client connected');
  
  // Send current data to new client
  socket.emit('sensorData', latestData);
  
  socket.on('disconnect', () => {
    console.log('🌐 Web client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 MQTT Service running on port ${PORT}`);
  console.log(`📱 Web interface: http://localhost:${PORT}`);
  console.log(`🔧 Device ID: ${DEVICE_ID}`);
  console.log(`🌐 Local IP: ${getLocalIP()}`);
  
  // Initialize MQTT connection
  initMqtt();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (mqttClient) {
    mqttClient.end();
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
