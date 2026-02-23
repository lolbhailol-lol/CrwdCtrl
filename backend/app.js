const express = require('express');
const corsMiddleware = require('./config/corsConfig');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS must be first
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  const type = req.headers['x-client-type'] || 'unknown';
  console.log(`[${req.method}] ${req.path} (${type})`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// ...existing middleware...

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// ✅ FIX: Mount user routes (required for /api/users/social-auth, /api/users/register, etc.)
app.use('/api/users', require('./src/routers/userroute'));

// ...existing routes...

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Not found', status: 404 });
});

// Error handler last
app.use(errorHandler);

module.exports = app;
