const os = require('os');
const { createServer } = require('./server');
const { startMqtt } = require('./mqtt/client');
const { connectKafka, disconnectKafka } = require('./config/kafka');
const { startOutletConsumer } = require('./consumers/outletConsumer');
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
    console.log('🔌 Connecting to Kafka...');
    await connectKafka();
    console.log('✅ Kafka connected successfully');
  } catch (error) {
    console.error('❌ Kafka connection failed:', error.message);
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
    
    console.log('🔌 Starting outlet consumer...');
    startOutletConsumer();
  });

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await disconnectKafka();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

bootstrap();
