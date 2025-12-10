// Lightweight logger with level control and namespace support

const DEFAULT_LEVEL = 'info';

// Levels priority
const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

// Global config can be overridden at runtime
const config = {
  level: (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL) || DEFAULT_LEVEL,
  enabled: true,
};

const shouldLog = (level) => {
  const current = LEVELS[config.level] ?? LEVELS[DEFAULT_LEVEL];
  const incoming = LEVELS[level] ?? LEVELS.info;
  return config.enabled && incoming <= current;
};

const formatNs = (ns) => (ns ? `[${ns}]` : '');

export const setLogLevel = (level) => {
  if (LEVELS[level] !== undefined) {
    config.level = level;
  }
};

export const enableLogging = (enabled) => {
  config.enabled = !!enabled;
};

export const createLogger = (namespace) => ({
  debug: (...args) => shouldLog('debug') && console.log(formatNs(namespace), ...args),
  verbose: (...args) => shouldLog('verbose') && console.log(formatNs(namespace), ...args),
  info: (...args) => shouldLog('info') && console.log(formatNs(namespace), ...args),
  warn: (...args) => shouldLog('warn') && console.warn(formatNs(namespace), ...args),
  error: (...args) => shouldLog('error') && console.error(formatNs(namespace), ...args),
});

export default {
  setLogLevel,
  enableLogging,
  createLogger,
};


