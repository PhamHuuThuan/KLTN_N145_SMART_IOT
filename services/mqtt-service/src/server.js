const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const { mqttEvents, getLatestData, getDeviceData, getAllDevicesData, getDevicesList, turnOnOutlet, turnOffOutlet, toggleOutlet, isConnected } = require('./mqtt/client');
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
    const status = {
      mqtt: isConnected(),
      latestData: getLatestData(),
      allDevices: getAllDevicesData(),
      devicesList: getDevicesList(),
      mqttConfig: config.mqtt,
    };
    res.json(status);
  });

  // Get data for specific device
  app.get('/api/devices/:deviceId/data', (req, res) => {
    const { deviceId } = req.params;
    
    const deviceData = getDeviceData(deviceId);
    if (deviceData) {
      res.json({ success: true, data: deviceData });
    } else {
      res.status(404).json({ success: false, error: 'Device data not found' });
    }
  });

  app.post('/api/outlet/on', async (req, res) => {
    const { deviceId } = req.body;
    const targetDeviceId = deviceId || 'KITCHEN-ESP32-LED1'; // Default device ID
    
    try {
      const success = await turnOnOutlet(targetDeviceId);
      const response = { success, action: 'turnOn', outlet: 'o1', deviceId: targetDeviceId };
      res.json(response);
    } catch (error) {
      console.error('❌ Error turning on outlet:', error.message);
      res.status(500).json({ error: 'Failed to turn on outlet' });
    }
  });

  app.post('/api/outlet/off', async (req, res) => {
    const { deviceId } = req.body;
    const targetDeviceId = deviceId || 'KITCHEN-ESP32-LED1'; // Default device ID
    
    try {
      const success = await turnOffOutlet(targetDeviceId);
      const response = { success, action: 'turnOff', outlet: 'o1', deviceId: targetDeviceId };
      res.json(response);
    } catch (error) {
      console.error('❌ Error turning off outlet:', error.message);
      res.status(500).json({ error: 'Failed to turn off outlet' });
    }
  });

  app.post('/api/outlet/toggle', async (req, res) => {
    const { deviceId } = req.body;
    const targetDeviceId = deviceId || 'KITCHEN-ESP32-LED1'; // Default device ID
    
    try {
      const success = await toggleOutlet(targetDeviceId);
      const response = { success, action: 'toggle', outlet: 'o1', deviceId: targetDeviceId };
      res.json(response);
    } catch (error) {
      console.error('❌ Error toggling outlet:', error.message);
      res.status(500).json({ error: 'Failed to toggle outlet' });
    }
  });

  // Get list of valid devices
  app.get('/api/devices', async (req, res) => {
    try {
      const devices = await deviceService.getAllDevices();
      const response = { success: true, data: devices, count: devices.length };
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
      
      const device = await deviceService.getDevice(deviceId);
      if (device) {
        const response = { success: true, data: device };
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
    socket.emit('sensorData', getLatestData());
  });

  mqttEvents.on('sensorData', (data) => {
    io.emit('sensorData', data);
  });
  
  mqttEvents.on('ack', (data) => {
    io.emit('ack', data);
  });

  return { app, server };
}

module.exports = { createServer };


