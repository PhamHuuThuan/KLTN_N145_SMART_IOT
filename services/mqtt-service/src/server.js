const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const { mqttEvents, getLatestData, turnOnOutlet, turnOffOutlet, toggleOutlet, isConnected } = require('./mqtt/client');
const deviceService = require('./services/deviceService');
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
      latestData: getLatestData(),
      mqttConfig: config.mqtt,
    };
    console.log('📊 Status response:', JSON.stringify(status, null, 2));
    res.json(status);
  });

  app.post('/api/outlet/on', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    
    console.log(`🔌 API: Turn ON outlet request for device ${deviceId}`);
    try {
      const success = await turnOnOutlet(deviceId);
      const response = { success, action: 'turnOn', outlet: 'o1', deviceId };
      console.log('🔌 API: Turn ON response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('❌ Error turning on outlet:', error.message);
      res.status(500).json({ error: 'Failed to turn on outlet' });
    }
  });

  app.post('/api/outlet/off', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    
    console.log(`🔌 API: Turn OFF outlet request for device ${deviceId}`);
    try {
      const success = await turnOffOutlet(deviceId);
      const response = { success, action: 'turnOff', outlet: 'o1', deviceId };
      console.log('🔌 API: Turn OFF response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('❌ Error turning off outlet:', error.message);
      res.status(500).json({ error: 'Failed to turn off outlet' });
    }
  });

  app.post('/api/outlet/toggle', async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    
    console.log(`🔌 API: Toggle outlet request for device ${deviceId}`);
    try {
      const success = await toggleOutlet(deviceId);
      const response = { success, action: 'toggle', outlet: 'o1', deviceId };
      console.log('🔌 API: Toggle response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('❌ Error toggling outlet:', error.message);
      res.status(500).json({ error: 'Failed to toggle outlet' });
    }
  });

  // Get list of valid devices
  app.get('/api/devices', async (req, res) => {
    try {
      console.log('📱 API: Get devices request received');
      const devices = await deviceService.getAllDevices();
      const response = { success: true, data: devices, count: devices.length };
      console.log(`📱 API: Found ${devices.length} devices`);
      res.json(response);
    } catch (error) {
      console.error('❌ Error fetching devices:', error.message);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  // Get specific device info
  app.get('/api/devices/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;
      console.log(`📱 API: Get device ${deviceId} request received`);
      
      const device = await deviceService.getDevice(deviceId);
      if (device) {
        const response = { success: true, data: device };
        console.log(`📱 API: Device ${deviceId} found`);
        res.json(response);
      } else {
        res.status(404).json({ success: false, error: 'Device not found' });
      }
    } catch (error) {
      console.error('❌ Error fetching device:', error.message);
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  });

  // Logs are now handled by devices-service directly
  // No need to forward requests through mqtt-service

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


