const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * General API rate limit.
 * SPA home loads fire many parallel GETs; 300/15m was too low and caused site-wide 429s.
 * Health/ready are skipped so platform probes never burn the budget.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : Number(process.env.API_RATE_LIMIT_MAX) || 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => {
    const path = String(req.path || '');
    return path === '/health' || path === '/ready' || path === '/';
  },
});

/** Stricter limit for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

/** Admin login — stricter than user auth */
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin login attempts, please try again later.' },
});

/** Payment endpoints */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests, please try again later.' },
});

/** Legacy competition screenshot registration — strict limit */
const competitionRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

/** Registration uploads — moderate limit */
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration requests, please try again later.' },
});

/** Scanner / QR check-in — prevent brute-force scans */
const scannerCheckinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 300 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many check-in attempts, please slow down.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  adminAuthLimiter,
  paymentLimiter,
  competitionRegisterLimiter,
  registrationLimiter,
  scannerCheckinLimiter,
};
