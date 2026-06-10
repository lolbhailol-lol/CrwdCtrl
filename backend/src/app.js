const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { corsOptions } = require('./config/cors');
const { securityHeaders } = require('./middleware/security');
const { requestLogger } = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { isDbReady } = require('./config/db');
const { getFirebaseAdminStatus } = require('./config/firebaseAdmin');
const apiRoutes = require('./routes');
const { handleCashfreeWebhook } = require('./controllers/paymentWebhookController');

require('./models');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

app.use(cors(corsOptions));

// Security: Cashfree webhook must receive raw body for HMAC signature verification
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  handleCashfreeWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

app.use(securityHeaders);
app.use(requestLogger);
app.use('/api', apiLimiter);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'CrwdCtrl API is running',
    service: 'CrwdCtrl API',
    version: '1.0.0',
  });
});

app.get('/api/health', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const firebase = getFirebaseAdminStatus();
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? 'OK' : 'DEGRADED',
    message: dbConnected ? 'CrwdCtrl API is running' : 'Database unavailable',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbConnected ? 'connected' : 'disconnected',
    pushNotifications: firebase.configured ? 'ready' : 'disabled',
    firebase: {
      configured: firebase.configured,
      projectId: firebase.projectId,
      error: firebase.error,
    },
  });
});

app.get('/api/ready', (_req, res) => {
  const dbReady = isDbReady();
  const firebase = getFirebaseAdminStatus();
  const checks = {
    database: dbReady,
    env: !!process.env.JWT_SECRET?.trim(),
    firebaseAdmin: firebase.configured,
  };
  const ready = Object.values(checks).every(Boolean);

  res.status(ready ? 200 : 503).json({
    success: ready,
    ready,
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/keep-alive', (_req, res) => {
  res.status(200).json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/status', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'CrwdCtrl API is operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/cors-test', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'CORS working',
      origin: req.get('origin') || 'none',
      timestamp: new Date().toISOString(),
    });
  });
}

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
