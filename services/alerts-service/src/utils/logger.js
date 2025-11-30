import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname,service,version',
      messageFormat: '[{service}] {msg}',
      customPrettifiers: {
        time: (timestamp) => `🕐 ${timestamp}`,
        level: (level) => {
          const levels = {
            10: '🔍 DEBUG',
            20: 'ℹ️  INFO',
            30: '⚠️  WARN',
            40: '❌ ERROR',
            50: '💀 FATAL'
          };
          return levels[level] || level;
        }
      }
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

logger.notification = (message, data = {}) => {
  logger.info({ type: 'notification', ...data }, message);
};

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
