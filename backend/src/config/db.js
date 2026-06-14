const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

dotenv.config();

const MONGODB_URL = process.env.MONGODB_URI;

let isReconnecting = false;

function isDbReady() {
  return mongoose.connection.readyState === 1;
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

    await mongoose.connect(MONGODB_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 120000,
      connectTimeoutMS: 30000,
    });

    logger.info('MongoDB connection successful');

    await syncProductionIndexes();

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      if (!isReconnecting) {
        isReconnecting = true;
        logger.info('Auto-reconnecting to MongoDB in 3s...');
        setTimeout(async () => {
          try {
            await mongoose.connect(MONGODB_URL, {
              serverSelectionTimeoutMS: 30000,
              socketTimeoutMS: 45000,
              heartbeatFrequencyMS: 10000,
              maxPoolSize: 10,
              minPoolSize: 2,
            });
            logger.info('MongoDB reconnected');
          } catch (err) {
            logger.error('MongoDB reconnect failed', { error: err.message });
          } finally {
            isReconnecting = false;
          }
        }, 3000);
      }
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    throw err;
  }
};

module.exports = connectDB;
module.exports.isDbReady = isDbReady;
