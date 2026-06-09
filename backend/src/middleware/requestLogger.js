const { logger } = require('../utils/logger');

const isDev = process.env.NODE_ENV !== 'production';

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', meta);
    } else if (isDev) {
      logger.debug('Request', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', meta);
    }
  });

  next();
}

module.exports = { requestLogger };
