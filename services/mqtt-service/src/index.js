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
  console.log('🚀 Starting MQTT Service...');
  console.log(`🔧 Configuration:`, JSON.stringify(config, null, 2));
  
  try {
    console.log('📊 Connecting to MongoDB...');
    await connectMongo();
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  const { server } = createServer();
  const PORT = config.service.port;

  server.listen(PORT, () => {
    console.log(`🚀 MQTT Service running on port ${PORT}`);
    console.log(`📱 Web interface: http://localhost:${PORT}`);
    console.log(`🔧 Device ID: ${config.service.deviceId}`);
    console.log(`🌐 Local IP: ${getLocalIP()}`);
    
    console.log('🔌 Initializing MQTT client...');
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
