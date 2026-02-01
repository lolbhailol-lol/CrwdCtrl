const cors = require('cors');

const ALLOWED_ORIGINS = [
  // Production domains
  'https://www.crwdctrl.in',
  'https://crwdctrl.in',
  
  // Railway deployment
  'https://crwdctrl-730576782394.asia-south2.run.app',
  'https://prolific-learning-production-13aa.up.railway.app',
  
  // Firebase hosting
  'https://crwdctrl.firebaseapp.com',
  'https://crwdctrl.web.app',
  
  // Mobile & Web frameworks
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  
  // Development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  
  // Environment variable (production)
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Client-Type',
    'Accept',
  ],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);
