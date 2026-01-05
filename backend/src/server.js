const dotenv = require("dotenv");
dotenv.config(); // Load env vars FIRST

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const connectDB = require("./config/db");

const userRoutes = require("./routers/userroute");
const studentRoutes = require("./routers/studentroute");
const festOrganizerRoutes = require("./routers/festOrganizerRoute");
const publicFestRoutes = require("./routers/publicFestRoute");
const competitionRoutes = require("./routers/competitionRoute");
const adminRoutes = require("./routers/adminRoute");
const registrationRoutes = require("./routers/registrationRoute");

console.log('🚀 Starting FestBuzzZ Backend Server...');
console.log('📍 Node Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port Configuration:', process.env.PORT || 8080);

// Register mongoose models
console.log('📋 Registering Mongoose models...');
require("./model/fest_organizer_model");
require("./model/student&participant");
require("./model/usermodel");
require("./model/event_model");
require("./model/competition_model");
require("./model/competition_registration_model");
require("./model/registration_model");
console.log('✅ Mongoose models registered');

const app = express();

// Connect DB with better error handling
connectDB().catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  // Don't exit immediately, let the server start for health checks
});

// ----------------------
// CORS CONFIG
// ----------------------
const corsOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://fest-buzzz-z-mvp.vercel.app",
      "https://www.crwdctrl.in",
      "https://crwdctrl.in",
      "https://crwdctrl-mvp.vercel.app",
<<<<<<< HEAD
      "https://crwdctrl-jz7pke4i6-lols-projects-43916194.vercel.app",  // Add this line
      "https://crwdctrl.vercel.app"  // Add this line too
=======
      "https://crwd-ctrl-gv5mz3j2d-lols-projects-43916194.vercel.app",
      "https://crwd-ctrl.vercel.app",
>>>>>>> 76bde7798ae97b14cc833cbae29598d602887951
    ];

console.log("✅ CORS Allowed Origins:", corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log blocked origin but don't throw error
      console.warn("⚠ CORS request from unauthorized origin:", origin);
      return callback(null, false); // Deny but don't throw
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// JSON middleware with increased limits for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${
      req.get("origin") || "none"
    }`
  );

  // Additional logging for competition routes
  if (req.path.includes('/competitions')) {
    console.log('🎯 Competition route hit:', {
      method: req.method,
      path: req.path,
      origin: req.get("origin"),
      contentType: req.get("content-type"),
      hasFile: !!req.file
    });
  }

  next();
});

// ----------------------
// Routes
// ----------------------
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/fest-organizer", festOrganizerRoutes);
app.use("/api/fests", publicFestRoutes);
app.use("/api/competitions", competitionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/registrations', registrationRoutes);


// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Backend Connected Successfully 🚀",
    service: "FestBuzzZ API",
    status: "running"
  });
});

// Health Check (required for Cloud Run)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "CrwdCtrl API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// API Status
app.get("/api/status", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CrwdCtrl API is operational",
    version: "1.0.0",
  });
});

// CORS Test
app.get("/api/cors-test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CORS working",
    origin: req.get("origin") || "none",
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ----------------------
// SERVER LISTENER (Cloud Run Compatible)
// ----------------------
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Ready to accept connections`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;