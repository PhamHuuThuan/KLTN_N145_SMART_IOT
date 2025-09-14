import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'alerts-service',
    version: process.env.npm_package_version || '1.0.0'
  }
});

// Add custom methods for structured logging
logger.notification = (message, data = {}) => {
  logger.info({ type: 'notification', ...data }, message);
};

// Custom error logging method
const logError = (message, error = {}) => {
  if (error instanceof Error) {
    logger.info({
      type: 'error',
      message: error.message,
      stack: error.stack,
      name: error.name
    }, message);
  } else {
    logger.info({ type: 'error', ...error }, message);
  }
};

// Override the error method
logger.error = logError;

logger.performance = (operation, duration, data = {}) => {
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...data
  }, `Performance: ${operation} took ${duration}ms`);
};

logger.security = (event, data = {}) => {
  logger.warn({
    type: 'security',
    event,
    ...data
  }, `Security event: ${event}`);
};

export default logger;
