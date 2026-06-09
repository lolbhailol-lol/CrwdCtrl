const isDev = process.env.NODE_ENV !== 'production';

const corsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://fest-buzzz-z-mvp.vercel.app',
  'https://www.crwdctrl.in',
  'https://crwdctrl.in',
  'https://crwdctrl-mvp.vercel.app',
  'https://crwdctrl.vercel.app',
  'https://crwdctrl-730576782394.asia-south2.run.app',
  'https://crwdctrl-production-9c58.up.railway.app',
  'https://crwdctrl-mvp-git-main.vercel.app',
  'https://crwdctrl.firebaseapp.com',
  'https://crwdctrl.web.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost:8080',
  'ionic://localhost',
  'http://localhost',
];

const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...corsOrigins, ...extraOrigins]);

function corsOptionsDelegate(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(origin)) return callback(null, true);
  if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }
  console.warn('CORS blocked origin:', origin);
  return callback(new Error('Not allowed by CORS'));
}

const corsOptions = {
  origin: corsOptionsDelegate,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
    'Origin',
    'Accept',
    'Expires',
  ],
  exposedHeaders: ['Content-Length', 'Content-Range', 'X-Total-Count'],
  maxAge: 86400,
};

module.exports = { corsOptions, corsOrigins: [...allowedOrigins] };
