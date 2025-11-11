const os = require('os');
const { createServer } = require('./server');
const { startMqtt } = require('./mqtt/client');
const { connectKafka, disconnectKafka } = require('./config/kafka');
const { startOutletConsumer } = require('./consumers/outletConsumer');
const deviceService = require('./services/deviceService');
const { logger } = require('./utils/logger');
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

  // Load and log all devices from database
  try {
    console.log('📋 Loading devices from database...');
    const devices = await deviceService.getAllDevices();
    if (devices && devices.length > 0) {
      console.log(`✅ Found ${devices.length} device(s) in database:`);
      devices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.deviceId || device._id || 'Unknown'} - Status: ${device.status || 'unknown'}`);
      });
      console.log(`📡 MQTT Service will subscribe to topics: iot/+/telemetry, iot/+/ack`);
      console.log(`   (This wildcard pattern will receive messages from ALL devices)`);
    } else {
      console.log('⚠️  No devices found in database');
      console.log('   Devices will still be accepted if DEVICE_VALIDATION_ENABLED=false');
    }
  } catch (error) {
    console.error('⚠️  Error loading devices from database:', error.message);
    console.log('   Service will continue but device validation may be limited');
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
