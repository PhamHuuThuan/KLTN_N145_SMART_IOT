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
  },
  mqtt: {
    host: process.env.MQTT_HOST || 'localhost',
    port: Number(process.env.MQTT_PORT || 1883),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },
};

module.exports = config;


