const isProd = process.env.NODE_ENV === 'production';

function formatMessage(level, message, meta) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'crwdctrl-api',
    ...(meta && typeof meta === 'object' ? meta : meta !== undefined ? { detail: meta } : {}),
  };

  if (isProd) {
    return JSON.stringify(entry);
  }

  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
}

function log(level, message, meta) {
  const formatted = formatMessage(level, message, meta);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => {
    if (!isProd) log('debug', message, meta);
  },
};

module.exports = { logger };
