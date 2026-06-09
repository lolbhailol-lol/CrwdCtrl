const { logger } = require('../utils/logger');
const { captureException } = require('../config/sentry');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  logger.error('API error', {
    message: err.message,
    status,
    method: req.method,
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });

  if (status >= 500) {
    captureException(err, {
      extra: { method: req.method, path: req.path },
    });
  }

  res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
    status,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || undefined,
    }),
  });
}

module.exports = { notFoundHandler, errorHandler };
