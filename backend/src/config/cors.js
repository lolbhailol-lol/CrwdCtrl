const isDev = process.env.NODE_ENV !== 'production';

/** Normalize Origin header for Set lookup (trim, no trailing slash). */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== 'string') return '';
  return origin.trim().replace(/\/$/, '');
}

/** Capacitor / Ionic WebView origins used by the Android & iOS apps. */
const CAPACITOR_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost',
  'http://localhost',
];

const corsOrigins = [
  ...CAPACITOR_ORIGINS,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:8080',
  'https://fest-buzzz-z-mvp.vercel.app',
  'https://www.crwdctrl.in',
  'https://crwdctrl.in',
  'https://crwdctrl-mvp.vercel.app',
  'https://crwdctrl.vercel.app',
  'https://frontend-five-tau-70.vercel.app',
  'https://crwdctrl-730576782394.asia-south2.run.app',
  'https://crwdctrl-production-9c58.up.railway.app',
  'https://crwdctrl-mvp-git-main.vercel.app',
  'https://crwdctrl.firebaseapp.com',
  'https://crwdctrl.web.app',
];

const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => normalizeOrigin(s))
  .filter(Boolean);

const allowedOrigins = new Set(
  [...corsOrigins, ...extraOrigins].map(normalizeOrigin),
);

function isCapacitorOrigin(origin) {
  const o = normalizeOrigin(origin);
  if (!o) return false;
  if (CAPACITOR_ORIGINS.includes(o)) return true;
  return (
    o.startsWith('capacitor://') ||
    o.startsWith('ionic://') ||
    o === 'https://localhost' ||
    o === 'http://localhost'
  );
}

/** Vercel preview / alias deploys for this project (hash URLs change every push). */
function isCrwdCtrlVercelPreview(origin) {
  const o = normalizeOrigin(origin);
  if (!o.startsWith('https://')) return false;
  // https://*-crwdctrls-projects.vercel.app (any project slug under the team)
  if (/^https:\/\/[a-z0-9-]+-crwdctrls-projects\.vercel\.app$/i.test(o)) return true;
  // https://crwd-ctrl-<hash>-crwdctrls-projects.vercel.app
  if (/^https:\/\/crwd-ctrl-[a-z0-9]+-crwdctrls-projects\.vercel\.app$/i.test(o)) return true;
  // https://crwdctrl-<branch>-<team>.vercel.app / https://crwd-ctrl-*.vercel.app
  if (/^https:\/\/crwdctrl(-[a-z0-9]+)+\.vercel\.app$/i.test(o)) return true;
  if (/^https:\/\/crwd-ctrl(-[a-z0-9]+)+\.vercel\.app$/i.test(o)) return true;
  // https://frontend-*.vercel.app (legacy alias)
  if (/^https:\/\/frontend(-[a-z0-9]+)*\.vercel\.app$/i.test(o)) return true;
  return false;
}

function corsOptionsDelegate(origin, callback) {
  // Same-origin / curl / server-to-server — no Origin header
  if (!origin) return callback(null, true);

  const normalized = normalizeOrigin(origin);

  if (allowedOrigins.has(normalized)) return callback(null, true);

  // Always allow Capacitor mobile app origins (production Android/iOS)
  if (isCapacitorOrigin(normalized)) return callback(null, true);

  // Allow this project's Vercel preview URLs without editing env every deploy
  if (isCrwdCtrlVercelPreview(normalized)) return callback(null, true);

  if (isDev && (normalized.includes('localhost') || normalized.includes('127.0.0.1'))) {
    return callback(null, true);
  }

  console.warn('CORS blocked origin:', origin);
  // false → cors package omits ACAO header; browser blocks client-side read (no 500)
  return callback(null, false);
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
    // Campus Hunt Zip Grid — laptop-only device signals
    'X-Campus-Hunt-Client',
    'X-Campus-Hunt-Device',
  ],
  exposedHeaders: ['Content-Length', 'Content-Range', 'X-Total-Count'],
  maxAge: 86400,
};

module.exports = { corsOptions, corsOrigins: [...allowedOrigins], CAPACITOR_ORIGINS };
