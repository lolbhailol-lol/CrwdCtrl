const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

dotenv.config();

const MONGODB_URL = process.env.MONGODB_URI;

/** Shared options — keep in sync; do not call mongoose.connect() again on disconnect. */
const MONGODB_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
  minPoolSize: 1,
  /**
   * 0 = do not close idle sockets (driver default).
   * 120s idle close was causing periodic "MongoDB disconnected" on quiet traffic.
   */
  maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_MS) || 0,
  retryWrites: true,
};

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function attachConnectionListeners() {
  const conn = mongoose.connection;
  if (conn._crwdctrlListenersAttached) return;
  conn._crwdctrlListenersAttached = true;

  conn.on('disconnected', () => {
    // Mongoose / MongoDB driver auto-reconnects — no manual connect() (avoids double reconnect races)
    logger.warn('MongoDB disconnected — auto-reconnect in progress');
  });

  conn.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  conn.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

async function syncProductionIndexes() {
  if (process.env.NODE_ENV !== 'production') return;

  const modelNames = [
    'Registration',
    'PaymentOrder',
    'FestOrganizer',
    'EventShow',
    'CategoryRegistration',
    'TrekBooking',
  ];

  for (const name of modelNames) {
    try {
      const model = mongoose.model(name);
      await model.syncIndexes();
      logger.debug(`Indexes synced for ${name}`);
    } catch (err) {
      logger.warn(`Index sync skipped for ${name}`, { error: err.message });
    }
  }
}

const connectDB = async () => {
  if (!MONGODB_URL?.trim()) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    logger.info('Connecting to MongoDB...');
    attachConnectionListeners();

    await mongoose.connect(MONGODB_URL, MONGODB_OPTIONS);

    logger.info('MongoDB connection successful');

    await syncProductionIndexes();
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    throw err;
  }
};

module.exports = connectDB;
module.exports.isDbReady = isDbReady;
