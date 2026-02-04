const dotenv = require("dotenv");
dotenv.config(); // Load env vars FIRST

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const axios = require("axios"); // ✅ FIX: Use axios for Railway keep-alive (already installed)
const connectDB = require("./config/db");

const userRoutes = require("./routers/userroute");
const studentRoutes = require("./routers/studentroute");
const festOrganizerRoutes = require("./routers/festOrganizerRoute");
const publicFestRoutes = require("./routers/publicFestRoute");
const competitionRoutes = require("./routers/competitionRoute");
const adminRoutes = require("./routers/adminRoute");
const registrationRoutes = require("./routers/registrationRoute");

console.log('🚀 Starting Crwdctrl Backend Server...');
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
// ✅ CRITICAL: CORS HEADERS BEFORE ANYTHING ELSE
// This ensures CORS headers are sent even if something else fails
// ----------------------
const PRODUCTION_ORIGINS = [
  'https://www.crwdctrl.in',
  'https://crwdctrl.in',
  'https://crwdctrl.vercel.app',
  'https://crwdctrl.firebaseapp.com',
  'https://crwdctrl.web.app',
  'https://prolific-learning-production-13aa.up.railway.app'
];

// ✅ FIRST MIDDLEWARE: Handle CORS headers for ALL requests
app.use((req, res, next) => {
  const origin = req.get('origin');
  
  // Always set CORS headers for known origins or allow all for debugging
  if (origin) {
    const isAllowed = PRODUCTION_ORIGINS.includes(origin) || 
                      origin.includes('localhost') || 
                      origin.includes('127.0.0.1') ||
                      origin.includes('vercel.app') ||
                      origin.includes('firebaseapp.com') ||
                      origin.includes('web.app');
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // Allow all origins in production for now (debugging)
      res.setHeader('Access-Control-Allow-Origin', origin);
      console.log('⚠️ CORS: Allowing unknown origin for debugging:', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Origin, Accept, Expires, X-Client-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, X-Total-Count, X-Auth-Token, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight OPTIONS requests IMMEDIATELY
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight OPTIONS handled for:', req.path, 'from:', origin);
    return res.status(200).end();
  }
  
  next();
});

// ----------------------
// ✅ ENHANCED CORS CONFIG FOR MOBILE
// ----------------------
const corsOrigins = [
  // ✅ Railway Production
  "https://prolific-learning-production-13aa.up.railway.app",
  
  // Local Development
  "http://localhost:5173",
  "http://localhost:5174", 
  "http://localhost:5175",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  
  // Vercel Deployments
  "https://fest-buzzz-z-mvp.vercel.app",
  "https://crwdctrl-mvp.vercel.app",
  "https://crwdctrl.vercel.app",
  "https://crwdctrl-mvp-git-main-your-username.vercel.app",
  "https://crwdctrl-mvp-git-main.vercel.app",
  
  // Custom Domain
  "https://www.crwdctrl.in",
  "https://crwdctrl.in",
  
  // Cloud Run (legacy)
  "https://crwdctrl-730576782394.asia-south2.run.app",
  
  // Firebase Hosting
  "https://crwdctrl.firebaseapp.com",
  "https://crwdctrl.web.app",
  
  // Mobile App Frameworks
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost"
];

console.log("✅ CORS Allowed Origins:", corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // ✅ FIX 1: ALLOW REQUESTS WITH NO ORIGIN (mobile apps, Postman)
      if (!origin) {
        console.log('✅ Request with no origin allowed (mobile app or native)');
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
      
      // TEMPORARY: Allow all origins for debugging (remove in production)
      console.log('🔧 TEMPORARY: Allowing all origins for mobile debugging');
      return callback(null, true);
    },
    credentials: true, // ✅ FIX 2: REQUIRED FOR MOBILE CREDENTIAL REQUESTS
    optionsSuccessStatus: 200, // ✅ FIX 3: SOME MOBILE CLIENTS EXPECT 200 FOR PREFLIGHT
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
      "Origin",
      "Accept",
      "Expires"
    ],
    exposedHeaders: [
      "Content-Length", 
      "Content-Range",
      "X-Total-Count"
    ],
    maxAge: 86400, // ✅ FIX 4: CACHE PREFLIGHT FOR 24 HOURS (but see below for Vary header)
  })
);

// ✅ FIX 5: ADD CRITICAL CORS HEADERS FOR MOBILE DEVICES
app.use((req, res, next) => {
  // ✅ PROPER VARY HEADER TO BUST CORS PREFLIGHT CACHE ON DIFFERENT ORIGINS
  res.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
  
  // ✅ ENSURE CORS CREDENTIALS HEADER IS SENT
  res.set('Access-Control-Allow-Credentials', 'true');
  
  // ✅ ENSURE ALL REQUIRED HEADERS ARE EXPOSED TO FRONTEND
  res.set('Access-Control-Expose-Headers', [
    'Content-Length',
    'Content-Range',
    'X-Total-Count',
    'X-Auth-Token',
    'Authorization'
  ].join(', '));
  
  // ✅ FIX 6: CACHE CONTROL FOR CORS RESPONSES
  // Prevent mobile proxy from caching CORS responses
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, public');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  next();
});

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

// ✅ RAILWAY KEEP-ALIVE MECHANISM (IMPROVED)
// Multiple strategies to prevent Railway cold starts
// Railway Hobby plan sleeps services after 5-10 minutes of inactivity
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  console.log('🚂 Railway environment detected - initializing keep-alive mechanism');
  
  // ✅ Strategy 1: Aggressive interval (2 minutes instead of 4)
  const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000; // 2 minutes (120 seconds)
  
  // ✅ Strategy 2: Multiple URL options
  const getRailwayUrl = () => {
    // Priority order for URLs:
    if (process.env.RAILWAY_KEEP_ALIVE_URL) {
      const url = process.env.RAILWAY_KEEP_ALIVE_URL.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    }
    
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      const domain = process.env.RAILWAY_PUBLIC_DOMAIN.trim();
      const cleanDomain = domain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}`;
    }
    
    if (process.env.RAILWAY_STATIC_URL) {
      return process.env.RAILWAY_STATIC_URL.trim();
    }
    
    // ✅ Hardcoded fallback for your Railway URL
    return 'https://prolific-learning-production-13aa.up.railway.app';
  };
  
  const RAILWAY_URL = getRailwayUrl();
  console.log(`🚂 Railway URL for keep-alive: ${RAILWAY_URL}`);
  
  // ✅ Strategy 3: Internal activity generator (doesn't need external network)
  let keepAliveCounter = 0;
  const internalKeepAlive = () => {
    keepAliveCounter++;
    // Do some CPU/memory work to keep the process active
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    // Update a global variable to create activity
    global.lastKeepAlive = {
      counter: keepAliveCounter,
      timestamp,
      uptime,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    };
    
    console.log(`💓 [${timestamp}] Internal keep-alive #${keepAliveCounter} - Uptime: ${Math.round(uptime)}s, Memory: ${global.lastKeepAlive.heapUsed}`);
  };
  
  // ✅ Strategy 4: External ping (backup)
  const performExternalKeepAlive = async () => {
    try {
      console.log(`🔄 [${new Date().toISOString()}] External keep-alive ping...`);
      
      const response = await axios.get(`${RAILWAY_URL}/api/health`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Railway-KeepAlive/1.0' },
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 200) {
        console.log(`✅ External keep-alive successful - Status: ${response.data?.status || 'OK'}`);
      }
    } catch (error) {
      // Don't log errors for external ping - internal is the primary strategy
      console.log(`⚠️ External ping failed (internal keep-alive is still working)`);
    }
  };
  
  // ✅ Start keep-alive mechanisms
  
  // Internal keep-alive: Every 1 minute (most reliable)
  setInterval(internalKeepAlive, 60 * 1000);
  
  // External keep-alive: Every 2 minutes (backup)
  setInterval(performExternalKeepAlive, KEEP_ALIVE_INTERVAL);
  
  // First pings after startup
  setTimeout(internalKeepAlive, 5000);  // 5 seconds
  setTimeout(performExternalKeepAlive, 30000); // 30 seconds
  
  console.log(`✅ Keep-alive mechanisms active:`);
  console.log(`   - Internal: Every 1 minute`);
  console.log(`   - External: Every 2 minutes to ${RAILWAY_URL}`);
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

// ✅ KEEP-ALIVE ENDPOINT (for external cron services like cron-job.org, UptimeRobot)
// Set up a free cron job at cron-job.org to hit this every 2-3 minutes
app.get("/api/keep-alive", (req, res) => {
  const uptime = process.uptime();
  const lastKeepAlive = global.lastKeepAlive || { counter: 0, timestamp: 'never' };
  
  res.status(200).json({
    success: true,
    message: "Keep-alive ping received",
    uptime: Math.round(uptime),
    keepAliveCounter: lastKeepAlive.counter,
    lastInternalPing: lastKeepAlive.timestamp,
    timestamp: new Date().toISOString()
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
  // ✅ CRITICAL: Ensure CORS headers are sent even on 404
  const origin = req.get('origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
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
  
  // ✅ CRITICAL: Ensure CORS headers are sent even on errors
  const origin = req.get('origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
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
const gracefulShutdown = async (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);
  server.close(async () => {
    console.log('✅ HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error closing MongoDB:', err);
      process.exit(1);
    }
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