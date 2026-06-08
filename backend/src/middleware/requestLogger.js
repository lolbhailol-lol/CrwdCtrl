const isDev = process.env.NODE_ENV !== 'production';

function requestLogger(req, res, next) {
  if (!isDev) return next();
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
}

module.exports = { requestLogger };
