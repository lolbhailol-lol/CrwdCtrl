const dotenv = require("dotenv");
dotenv.config(); // Load env vars FIRST

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const connectDB = require("./config/db");

const userRoutes = require("./routers/userroute");
const studentRoutes = require("./routers/studentroute");
const festOrganizerRoutes = require("./routers/festOrganizerRoute");
const publicFestRoutes = require("./routers/publicFestRoute");
const competitionRoutes = require("./routers/competitionRoute");
const adminRoutes = require("./routers/adminRoute");
const adminEventRoutes = require("./routers/adminEventRoute");
const publicEventRoutes = require("./routers/publicEventRoute");
const publicTrekRoutes = require("./routers/publicTrekRoute");
const adminSportsRoutes = require("./routers/adminSportsRoute");
const adminTrekRoutes = require("./routers/adminTrekRoute");
const adminTrekCommunityRoutes = require("./routers/adminTrekCommunityRoute");
const publicTrekCommunityRoutes = require("./routers/publicTrekCommunityRoute");
const adminTheatreRoutes = require("./routers/adminTheatreRoute");
const categoryRegistrationRoutes = require("./routers/categoryRegistrationRoute");
const registrationRoutes = require("./routers/registrationRoute");
const paymentRoutes = require("./routers/paymentRoute");
const notificationRoutes = require("./routers/notificationRoute");
const qrRoutes = require("./routers/qrRoute");
const analyticsRoutes = require("./routers/analyticsRoute");

// Register mongoose models
require("./model/fest_organizer_model");
require("./model/student&participant");
require("./model/usermodel");
require("./model/event_model");
require("./model/competition_model");
require("./model/competition_registration_model");
require("./model/registration_model");
require("./model/platform_event_model");
require("./model/sports_model");
require("./model/trek_model");
require("./model/trek_community_model");
require("./model/trek_booking_model");
require("./model/theatre_model");
require("./model/category_registration_model");

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
  "https://crwdctrl.vercel.app",
  // Google Cloud Run domain
  "https://crwdctrl-730576782394.asia-south2.run.app",
  // Additional Vercel domains
  "https://crwdctrl-mvp-git-main-your-username.vercel.app",
  "https://crwdctrl-mvp-git-main.vercel.app",
  // Firebase hosting domains
  "https://crwdctrl.firebaseapp.com",
  "https://crwdctrl.web.app",
  // Mobile app support
  "capacitor://localhost", // Add for mobile apps using Capacitor
  "ionic://localhost",     // Add for Ionic apps
  "http://localhost"       // Add for mobile emulators
];

const isDev = process.env.NODE_ENV !== 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development only: allow any localhost / 127.0.0.1 port
      if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      // Allow any Vercel preview deployment (*.vercel.app)
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      console.warn('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
      "Origin",
      "Accept",
      "Expires" // Add Expires header for cache busting
    ],
    exposedHeaders: [
      "Content-Length", 
      "Content-Range",
      "X-Total-Count"
    ],
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// JSON middleware with increased limits for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ Compression middleware for better performance (especially for Cloud Run)
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses if the request includes a cache-control header to prevent compression
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Performance optimization middleware
app.use((req, res, next) => {
  // Add caching headers for GET requests to improve performance
  if (req.method === 'GET') {
    // Cache static resources for 1 hour
    if (req.path.includes('/uploads/') || req.path.includes('/images/')) {
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
    // Cache API responses for 5 minutes
    else if (req.path.startsWith('/api/fests') && !req.path.includes('/admin/')) {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
    // Treks and communities — no cache so admin changes show immediately
    else if (
      (req.path.startsWith('/api/treks') || req.path.startsWith('/api/trek-communities')) &&
      !req.path.includes('/admin/')
    ) {
      res.set('Cache-Control', 'no-store');
    }
  }
  
  // Add compression hint
  res.set('Vary', 'Accept-Encoding');
  
  // Fix Cross-Origin-Opener-Policy for Firebase OAuth (required for social login)
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Additional OAuth compatibility headers
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  
  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  
  next();
});

// Request logging — development only
if (isDev) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ----------------------
// Routes
// ----------------------
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/fest-organizer", festOrganizerRoutes);
app.use("/api/fests", publicFestRoutes);
app.use("/api/competitions", competitionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/admin/sports', adminSportsRoutes);
app.use('/api/admin/treks', adminTrekRoutes);
app.use('/api/admin/trek-communities', adminTrekCommunityRoutes);
app.use('/api/trek-communities', publicTrekCommunityRoutes);
app.use('/api/admin/theatre', adminTheatreRoutes);
app.use('/api/events', publicEventRoutes);
app.use('/api/treks', publicTrekRoutes);
app.use('/api/category-registrations', categoryRegistrationRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/analytics', analyticsRoutes);


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
    headers: {
      'user-agent': req.get("user-agent"),
      'referer': req.get("referer"),
      'host': req.get("host")
    }
  });
});

// Note: OPTIONS preflight requests are handled by the CORS middleware above
// No need for explicit OPTIONS handler - CORS middleware handles it automatically

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
  console.error('❌ Error Handler triggered:', {
    message: err.message,
    status: err.status || 500,
    method: req.method,
    path: req.path,
    origin: req.get('origin'),
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    body: req.body ? Object.keys(req.body) : 'no body'
  });
  
  console.error('   Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    status: err.status || 500,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details || err
    })
  });
});

// ----------------------
// SERVER LISTENER (Cloud Run Compatible)
// ----------------------
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
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