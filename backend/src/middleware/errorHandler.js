const { logger } = require('../utils/logger');
const { captureException } = require('../config/sentry');

function notFoundHandler(req, res) {
  const accept = String(req.get('accept') || '');
  const wantsHtml = req.method === 'GET' && accept.includes('text/html');
  const path = String(req.path || '');
  if (wantsHtml && !path.startsWith('/api')) {
    const dest = `https://www.crwdctrl.in${req.originalUrl || path || '/'}`;
    return res.redirect(302, dest);
  }
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
}

function errorHandler(err, req, res, _next) {
  const isVersionConflict = err?.name === 'VersionError'
    || /No matching document found for id/i.test(String(err?.message || ''));
  const mongoTransient = err?.name === 'MongoNetworkError'
    || err?.name === 'MongoServerSelectionError'
    || err?.name === 'MongoPoolClearedError'
    || /ENOTFOUND|ECONNRESET|ECONNREFUSED|PoolCleared|timed out|topology was destroyed/i.test(
      String(err?.message || ''),
    );
  const status = isVersionConflict
    ? 409
    : mongoTransient
      ? 503
      : (err.status || err.statusCode || 500);
  const code = err.code
    || (isVersionConflict ? 'VERSION_CONFLICT' : undefined)
    || (mongoTransient ? 'DB_UNAVAILABLE' : undefined);

  logger.error('API error', {
    message: err.message,
    status,
    code,
    method: req.method,
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });

  if (status >= 500) {
    captureException(err, {
      extra: { method: req.method, path: req.path, code },
    });
  }

  const hide500 = status >= 500 && process.env.NODE_ENV === 'production' && !mongoTransient;
  res.status(status).json({
    success: false,
    message: hide500
      ? 'Internal server error'
      : isVersionConflict
        ? 'Please try again.'
        : mongoTransient
          ? 'Database briefly unavailable — please try again in a few seconds.'
          : err.message || 'Internal server error',
    status,
    ...(code ? { code } : {}),
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || undefined,
    }),
  });
}

module.exports = { notFoundHandler, errorHandler };
