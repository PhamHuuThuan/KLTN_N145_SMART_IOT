#!/usr/bin/env node

import logger from './src/utils/logger.js';

// Suppress KafkaJS partitioner warning
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

// Set log level
process.env.LOG_LEVEL = 'info';

logger.info('Starting Smart IoT Kitchen Alerts Service...\n');

// Import and start the service
import('./src/index.js').catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});
