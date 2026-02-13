const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URL = process.env.MONGODB_URI;

let isReconnecting = false;

const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000, // Check connection health every 10s
      maxPoolSize: 10,
      minPoolSize: 2, // Keep 2 connections warm
      maxIdleTimeMS: 120000, // Keep idle connections for 2 min
      connectTimeoutMS: 30000,
    });

    console.log("✅ MongoDB connection successful");

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
      if (!isReconnecting) {
        isReconnecting = true;
        console.log('🔄 Auto-reconnecting to MongoDB in 3s...');
        setTimeout(async () => {
          try {
            await mongoose.connect(MONGODB_URL, {
              serverSelectionTimeoutMS: 30000,
              socketTimeoutMS: 45000,
              heartbeatFrequencyMS: 10000,
              maxPoolSize: 10,
              minPoolSize: 2,
            });
            console.log('✅ MongoDB reconnected');
          } catch (err) {
            console.error('❌ MongoDB reconnect failed:', err.message);
          } finally {
            isReconnecting = false;
          }
        }, 3000);
      }
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
};

module.exports = connectDB;
