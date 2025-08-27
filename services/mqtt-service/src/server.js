const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const { mqttEvents, getLatestData, turnOnOutlet, turnOffOutlet, toggleOutlet, isConnected } = require('./mqtt/client');
const config = require('./config');

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/status', (req, res) => {
    res.json({
      mqtt: isConnected(),
      device: config.service.deviceId,
      latestData: getLatestData(),
      mqttConfig: config.mqtt,
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


