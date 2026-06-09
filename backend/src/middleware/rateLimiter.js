const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

/** General API rate limit */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

/** Stricter limit for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

/** Admin login — stricter than user auth */
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
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

module.exports = {
  apiLimiter,
  authLimiter,
  adminAuthLimiter,
  paymentLimiter,
  competitionRegisterLimiter,
  registrationLimiter,
};
