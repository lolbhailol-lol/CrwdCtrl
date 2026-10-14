const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const INTERN_ROLE = 'intern_admin';

// College Games admin: interns run games but never move money or stop a live game.
const COLLEGE_PLATFORM_INTERN_BLOCKED = [
  /^\/hosted-games\/[^/]+\/(turnout-decision|emergency-stop|clear-emergency-stop|prizes|payout)\/?$/,
  /^\/refunds\/[^/]+\/process\/?$/,
  /^\/disputes\/[^/]+\/resolve\/?$/,
];

// Campus Hunt admin: interns operate events but cannot delete data or see team credentials.
const CAMPUS_HUNT_INTERN_BLOCKED = [
  /\/reveal-access/,
  /\/team-password/,
  /\/teams\/set-password/,
  /\/prune-excess/,
  /\/users\/lookup/,
];

// CTRL Mystery admin: interns run cases and events but cannot delete data or see team credentials.
const MYSTERY_INTERN_BLOCKED = [
  /\/credentials/,
  /\/password/,
  /\/reset-password/,
];

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return jwt.verify(header.slice(7), getJwtSecret());
}

function internBlockedFromCollegePlatform(req) {
  return COLLEGE_PLATFORM_INTERN_BLOCKED.some((pattern) => pattern.test(String(req.path || '')));
}

function internBlockedFromCampusHunt(req) {
  const path = String(req.path || '');
  return req.method === 'DELETE' || CAMPUS_HUNT_INTERN_BLOCKED.some((pattern) => pattern.test(path));
}

function internBlockedFromMystery(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  return req.method === 'DELETE' || MYSTERY_INTERN_BLOCKED.some((pattern) => pattern.test(path));
}

function internAwareAdminAuth(isBlocked, blockedMessage) {
  return (req, res, next) => {
    let decoded;
    try {
      decoded = readToken(req);
    } catch (error) {
      return res.status(401).json({ error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Unauthorized: Invalid admin token' });
    }
    if (!decoded) return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    if (decoded.type === 'refresh' || ![ 'admin', INTERN_ROLE ].includes(decoded.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    if (decoded.role === INTERN_ROLE && isBlocked(req)) {
      return res.status(403).json({ error: blockedMessage });
    }
    req.user = decoded;
    return next();
  };
}

const collegePlatformAdminAuth = internAwareAdminAuth(
  internBlockedFromCollegePlatform,
  'Forbidden: Payments, refunds, payouts and emergency stops stay with the CrwdCtrl admin',
);

const mysteryAdminAuth = internAwareAdminAuth(
  internBlockedFromMystery,
  'Forbidden: Deleting data and team credentials stay with the CrwdCtrl admin',
);

module.exports = {
  INTERN_ROLE,
  collegePlatformAdminAuth,
  mysteryAdminAuth,
  internBlockedFromMystery,
  internBlockedFromCampusHunt,
  internBlockedFromCollegePlatform,
};
