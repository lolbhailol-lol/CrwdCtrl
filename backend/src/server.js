require('dotenv').config();

const { initSentry } = require('./config/sentry');
initSentry();

const { assertProductionEnv } = require('./config/requiredEnv');
assertProductionEnv();

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { logger } = require('./utils/logger');
const { captureException } = require('./config/sentry');
const { getFirebaseAdminStatus } = require('./config/firebaseAdmin');

async function startServer() {
  try {
    await connectDB();

    try {
      const { ensurePageViewPathsMigrated } = require('./services/analyticsPathMigration');
      ensurePageViewPathsMigrated().catch(() => {});
    } catch (_) { /* non-critical */ }

    try {
      const { recoverStuckCampaigns } = require('./controllers/adminNotificationController');
      const recovered = await recoverStuckCampaigns(30);
      if (recovered > 0) {
        logger.warn('Recovered stuck notification campaigns', { count: recovered });
      }
    } catch (recoverErr) {
      logger.warn('Stuck campaign recovery skipped', { error: recoverErr.message });
    }

    const firebaseStatus = getFirebaseAdminStatus();
    if (firebaseStatus.configured) {
      logger.info('Firebase Admin ready for push notifications', {
        projectId: firebaseStatus.projectId,
      });
    } else {
      logger.warn('Firebase Admin not configured — push notifications disabled', {
        error: firebaseStatus.error,
      });
    }

    const app = require('./app');
    const PORT = process.env.PORT || 8080;
    const HOST = process.env.HOST || '0.0.0.0';

    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT}`, {
        env: process.env.NODE_ENV || 'development',
      });

      try {
        const { initReminderCron, initPendingPaymentExpiryCron } = require('./services/reminderService');
        initReminderCron();
        initPendingPaymentExpiryCron();
      } catch (cronErr) {
        logger.warn('Reminder cron failed to start', { error: cronErr.message });
      }

      try {
        const { initKeepAlive } = require('./services/keepAliveService');
        initKeepAlive();
      } catch (keepAliveErr) {
        logger.warn('Keep-alive failed to start', { error: keepAliveErr.message });
      }
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

    // Log + report unhandled rejections but keep the server alive — a single
    // missed await in a background task should not take down every request.
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      if (reason instanceof Error) captureException(reason);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    captureException(err);
    process.exit(1);
  }
}

startServer();
