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
    if (path === '/health' || path === '/ready' || path === '/' || path === '/keep-alive' || path === '/status') return true;
    // Public detail GETs — viral shared run/trek links must not 429 as "not found"
    if (req.method === 'GET') {
      if (/^\/sports\/[^/]+$/.test(path)) return true;
      if (/^\/treks\/[^/]+$/.test(path)) return true;
      // Stall form meta — many phones load this at once on shared WiFi
      if (/^\/fests\/[^/]+\/stall$/.test(path)) return true;
      // Ticket QR fetch — the whole gate queue loads this at once from one venue IP,
      // and a 429 here means an attendee cannot show their QR at all. Already auth-scoped per user.
      if (/^\/qr\/[^/]+\/[^/]+\/qr$/.test(path)) return true;
    }
    // Stall lead POSTs have their own high ceiling limiter
    if (req.method === 'POST' && /^\/fests\/[^/]+\/stall-leads$/.test(path)) return true;
    return false;
  },
});

/** Stricter limit for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 80,
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

/**
 * Scanner / QR check-in.
 * A gate rush is hundreds of scans from one venue IP (all volunteers share the WiFi NAT),
 * so a low ceiling locks out check-in mid-event. Brute force is not the threat this guards:
 * hashes are 128-bit and the route already requires scanner/organizer auth.
 */
const scannerCheckinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : Number(process.env.SCANNER_CHECKIN_RATE_LIMIT_MAX) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many check-in attempts, please slow down.' },
});

/** Public stall interest form — high ceiling (college WiFi = many users, one IP) */
const stallLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : Number(process.env.STALL_LEAD_RATE_LIMIT_MAX) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions right now. Please wait a few seconds and try again.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  adminAuthLimiter,
  paymentLimiter,
  competitionRegisterLimiter,
  registrationLimiter,
  scannerCheckinLimiter,
  stallLeadLimiter,
};
