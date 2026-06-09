require('dotenv').config();

const { initSentry } = require('./config/sentry');
initSentry();

const { assertProductionEnv } = require('./config/requiredEnv');
assertProductionEnv();

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { logger } = require('./utils/logger');
const { captureException } = require('./config/sentry');
const { initReminderCron } = require('./services/reminderService');

async function startServer() {
  try {
    await connectDB();

    const app = require('./app');
    const PORT = process.env.PORT || 8080;
    const HOST = process.env.HOST || '0.0.0.0';

    initReminderCron();
    logger.info('Event reminder cron initialized');

    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT}`, {
        env: process.env.NODE_ENV || 'development',
      });
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
      captureException(err);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
      if (reason instanceof Error) captureException(reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    captureException(err);
    process.exit(1);
  }
}

startServer();
