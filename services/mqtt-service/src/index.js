const os = require('os');
const { createServer } = require('./server');
const { startMqtt } = require('./mqtt/client');
const { connectMongo } = require('./db/mongo');
const config = require('./config');

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

async function bootstrap() {
  await connectMongo();

  const { server } = createServer();
  const PORT = config.service.port;

  server.listen(PORT, () => {
    console.log(`🚀 MQTT Service running on port ${PORT}`);
    console.log(`📱 Web interface: http://localhost:${PORT}`);
    console.log(`🔧 Device ID: ${config.service.deviceId}`);
    console.log(`🌐 Local IP: ${getLocalIP()}`);
    startMqtt();
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

bootstrap();
