/* Simple structured logger without external deps. Prints JSON lines with ts, level, msg, and meta. */

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel = LEVELS[envLevel] !== undefined ? LEVELS[envLevel] : LEVELS.info;

function formatLine(level, msg, meta) {
  try {
    const line = {
      ts: new Date().toISOString(),
      level,
      msg
    };
    if (meta && Object.keys(meta).length) line.meta = meta;
    return JSON.stringify(line);
  } catch (_) {
    return `${new Date().toISOString()} ${level.toUpperCase()} ${msg}`;
  }
}

function logAt(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const [msg, meta] = args.length > 1 ? [args[0], args[1]] : [String(args[0] || ''), undefined];
  const line = formatLine(level, msg, meta);
  if (level === 'error') return console.error(line);
  if (level === 'warn') return console.warn(line);
  return console.log(line);
}

export const logger = {
  error: (msg, meta) => logAt('error', msg, meta),
  warn: (msg, meta) => logAt('warn', msg, meta),
  info: (msg, meta) => logAt('info', msg, meta),
  debug: (msg, meta) => logAt('debug', msg, meta)
};

// Adapter for http-proxy-middleware if needed
export const proxyLogger = {
  debug: (...args) => logger.debug(args.join(' ')),
  info: (...args) => logger.info(args.join(' ')),
  warn: (...args) => logger.warn(args.join(' ')),
  error: (...args) => logger.error(args.join(' '))
};


