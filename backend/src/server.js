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
const registrationRoutes = require("./routers/registrationRoute");

console.log('🚀 Starting FestBuzzZ Backend Server...');
console.log('📍 Node Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port Configuration:', process.env.PORT || 8080);

// ✅ RAILWAY ENVIRONMENT DETECTION
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log('🚂 Railway deployment detected');
  console.log('🚂 Railway Environment:', process.env.RAILWAY_ENVIRONMENT);
  console.log('🚂 Railway Public Domain:', process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set');
  console.log('🚂 Railway Static URL:', process.env.RAILWAY_STATIC_URL || 'Not set');
}

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

console.log("✅ CORS Allowed Origins:", corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      console.log('🔍 CORS request from origin:', origin);
      
      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        console.log('✅ Origin allowed from corsOrigins list');
        return callback(null, true);
      }
      
      // For debugging: Allow any localhost or 127.0.0.1 origin
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log('🔧 Debug: Allowing localhost origin:', origin);
        return callback(null, true);
      }
      
      // For debugging: Allow any Vercel domain
      if (origin.includes('vercel.app')) {
        console.log('🔧 Debug: Allowing Vercel origin:', origin);
        return callback(null, true);
      }
      
      // For debugging: Allow Firebase hosting domains
      if (origin.includes('firebaseapp.com') || origin.includes('web.app')) {
        console.log('🔧 Debug: Allowing Firebase origin:', origin);
        return callback(null, true);
      }
      
      console.warn("⚠️ CORS request from unauthorized origin:", origin);
      console.warn("   Allowed origins:", corsOrigins);
      
      // TEMPORARY: Allow all origins for debugging
      console.log('🔧 TEMPORARY: Allowing all origins for debugging');
      return callback(null, true);
    },
    credentials: true, // Required for cookie/credential requests (mobile + cross-origin)
    optionsSuccessStatus: 200, // Some mobile clients expect 200 for preflight
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

// Parse Cookie header (no new lib) so auth can read tokens from cookies for mobile/credential requests.
// Split only on first '=' so values containing '=' (e.g. JWT base64 padding) are preserved.
app.use((req, res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) {
    raw.split(';').forEach(pair => {
      const trimmed = pair.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (k && v) req.cookies[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  }
  next();
});

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

// Request logging middleware
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${
      req.get("origin") || "none"
    }`
  );

  // Additional logging for upload routes
  if (req.path.includes('/upload') || req.path.includes('/users')) {
    console.log('🎯 USERS/UPLOAD route hit:', {
      method: req.method,
      path: req.path,
      fullUrl: req.originalUrl,
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
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    platform: "Railway"
  });
});

// ✅ RAILWAY KEEP-ALIVE MECHANISM
// Self-ping every 10 minutes to prevent Railway cold starts
if (process.env.NODE_ENV === 'production' && process.env.RAILWAY_ENVIRONMENT) {
  console.log('🚂 Railway environment detected - enabling keep-alive mechanism');
  
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN || 
                     process.env.RAILWAY_STATIC_URL || 
                     'https://prolific-learning-production-13aa.up.railway.app';
  
  setInterval(async () => {
    try {
      console.log('🔄 Railway keep-alive ping...');
      const response = await fetch(`${RAILWAY_URL}/api/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log('✅ Railway keep-alive successful');
      } else {
        console.warn('⚠️ Railway keep-alive returned:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Railway keep-alive failed:', error.message);
    }
  }, KEEP_ALIVE_INTERVAL);
  
  console.log(`✅ Railway keep-alive scheduled every ${KEEP_ALIVE_INTERVAL / 60000} minutes`);
}

// ✅ RAILWAY COLD START DETECTION
app.get("/api/cold-start-check", (req, res) => {
  const uptime = process.uptime();
  const isColdStart = uptime < 30; // Less than 30 seconds uptime indicates cold start
  
  res.status(200).json({
    isColdStart,
    uptime,
    timestamp: new Date().toISOString(),
    message: isColdStart ? "Cold start detected" : "Warm instance"
  });
});

// API Status with Railway Plan Detection
app.get("/api/status", (req, res) => {
  // Try to detect Railway plan based on available resources and environment
  const railwayInfo = {
    isRailway: !!process.env.RAILWAY_ENVIRONMENT,
    environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
    publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || 'not-set',
    staticUrl: process.env.RAILWAY_STATIC_URL || 'not-set',
    // Memory limit can help identify plan (512MB = Hobby, 8GB+ = Pro)
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    // If service sleeps, it's likely Hobby plan
    likelySleepingService: process.uptime() < 60 // Less than 1 minute uptime suggests recent wake-up
  };

  res.status(200).json({
    success: true,
    message: "CrwdCtrl API is operational",
    version: "1.0.0",
    railway: railwayInfo,
    planHint: railwayInfo.likelySleepingService ? 
      "Likely Hobby Plan (service was sleeping)" : 
      "Unknown plan (service was running)"
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
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Ready to accept connections`);
  console.log(`✅ PAYMENT RECEIPT UPLOAD: /api/users/upload/image is LIVE`);
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