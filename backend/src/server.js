require('dotenv').config();

const { assertProductionEnv } = require('./config/requiredEnv');
assertProductionEnv();

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');

connectDB().catch((err) => {
  console.error('Failed to connect to MongoDB:', err.message);
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
