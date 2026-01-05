const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URL = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URL, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
      bufferCommands: false, // Disable mongoose buffering
    });

    console.log("✅ MongoDB connection successful");

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err; // Let the calling function handle the error
  }
};

module.exports = connectDB;
