const path = require('path');
const fs = require('fs');

// Load .env if present (development)
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  } else {
    require('dotenv').config();
  }
} catch (_) {}

const config = {
  service: {
    port: process.env.PORT || 3000,
    deviceId: process.env.DEVICE_ID || 'KITCHEN-ESP32-LED1',
  },
  mqtt: {
    host: process.env.MQTT_HOST || 'localhost',
    port: Number(process.env.MQTT_PORT || 1883),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },
  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_iot',
    dbName: process.env.MONGODB_DB_NAME || 'smart_iot',
  },
};

module.exports = config;


