const { logger } = require('../utils/logger');

const isDev = process.env.NODE_ENV !== 'production';

function requestPath(req) {
  // originalUrl keeps the full mounted path; req.path is router-relative
  const raw = String(req.originalUrl || req.url || req.path || '');
  const q = raw.indexOf('?');
  return q === -1 ? raw : raw.slice(0, q);
}

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = requestPath(req);
    const meta = {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: duration,
    };

    // Put method/path/status in the message so hosts that only show `message` stay useful
    if (res.statusCode >= 500) {
      logger.error(`Request failed ${req.method} ${path} ${res.statusCode}`, meta);
    } else if (isDev) {
      logger.debug('Request', meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`Client error ${req.method} ${path} ${res.statusCode}`, meta);
    }
  });

  next();
}

module.exports = { requestLogger };
