#!/usr/bin/env node

// Suppress KafkaJS partitioner warning
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

// Set log level
process.env.LOG_LEVEL = 'info';

console.log('🚀 Starting Smart IoT Kitchen Alerts Service...\n');

// Import and start the service
import('./src/index.js').catch((error) => {
  console.error('❌ Failed to start service:', error);
  process.exit(1);
});
