const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const { mqttEvents, getLatestData, turnOnOutlet, turnOffOutlet, toggleOutlet, isConnected } = require('./mqtt/client');
// Log model removed - data is now forwarded to device service
const config = require('./config');

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/status', (req, res) => {
    console.log('📊 API Status request received');
    const status = {
      mqtt: isConnected(),
      device: config.service.deviceId,
      latestData: getLatestData(),
      mqttConfig: config.mqtt,
    };
    console.log('📊 Status response:', JSON.stringify(status, null, 2));
    res.json(status);
  });

  app.post('/api/outlet/on', (req, res) => {
    console.log('🔌 API: Turn ON outlet request received');
    const success = turnOnOutlet();
    const response = { success, action: 'turnOn', outlet: 'o1' };
    console.log('🔌 API: Turn ON response:', JSON.stringify(response, null, 2));
    res.json(response);
  });

  app.post('/api/outlet/off', (req, res) => {
    console.log('🔌 API: Turn OFF outlet request received');
    const success = turnOffOutlet();
    const response = { success, action: 'turnOff', outlet: 'o1' };
    console.log('🔌 API: Turn OFF response:', JSON.stringify(response, null, 2));
    res.json(response);
  });

  app.post('/api/outlet/toggle', (req, res) => {
    console.log('🔌 API: Toggle outlet request received');
    const success = toggleOutlet();
    const response = { success, action: 'toggle', outlet: 'o1' };
    console.log('🔌 API: Toggle response:', JSON.stringify(response, null, 2));
    res.json(response);
  });

  app.get('/api/bridge/status', (req, res) => {
    console.log('🌉 API Bridge Status request received');
    if (global.mqttBridge) {
      const bridgeStatus = global.mqttBridge.getStatus();
      console.log('🌉 Bridge Status response:', JSON.stringify(bridgeStatus, null, 2));
      res.json(bridgeStatus);
    } else {
      res.status(500).json({ error: 'MQTT Bridge not initialized' });
    }
  });

  app.get('/api/logs', async (req, res) => {
    try {
      console.log('📊 API Logs request received - forwarding to device service');
      const { limit = 50, type, deviceId } = req.query;
      
      // Forward request to device service
      const response = await axios.get(`${config.deviceService.url}/api/logs`, {
        params: { limit, type, deviceId }
      });
      
      console.log(`📊 Forwarded logs from device service: ${response.data.logs.length} logs`);
      res.json(response.data);
    } catch (error) {
      console.error('❌ Error forwarding logs request:', error.message);
      res.status(500).json({ error: 'Failed to fetch logs from device service' });
    }
  });

  app.get('/api/logs/count', async (req, res) => {
    try {
      console.log('📊 API Logs Count request received - forwarding to device service');
      
      // Forward request to device service
      const response = await axios.get(`${config.deviceService.url}/api/logs/count`);
      
      console.log(`📊 Forwarded count from device service: ${response.data.count} logs`);
      res.json(response.data);
    } catch (error) {
      console.error('❌ Error forwarding count request:', error.message);
      res.status(500).json({ error: 'Failed to count logs from device service' });
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 WebSocket client connected:', socket.id);
    socket.emit('sensorData', getLatestData());
    
    socket.on('disconnect', () => {
      console.log('🔌 WebSocket client disconnected:', socket.id);
    });
  });

  mqttEvents.on('sensorData', (data) => {
    console.log('📡 Emitting sensor data to WebSocket clients');
    io.emit('sensorData', data);
  });
  
  mqttEvents.on('ack', (data) => {
    console.log('📡 Emitting ACK data to WebSocket clients');
    io.emit('ack', data);
  });

  return { app, server };
}

module.exports = { createServer };


