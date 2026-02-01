const errorHandler = (err, req, res, next) => {
  const clientType = req.headers['x-client-type'] || 'unknown';

  console.error(`[Error] ${clientType}:`, {
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
  });

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ message, status });
};

module.exports = errorHandler;
