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

function collegePlatformAdminAuth(req, res, next) {
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
  if (decoded.role === INTERN_ROLE && internBlockedFromCollegePlatform(req)) {
    return res.status(403).json({ error: 'Forbidden: Payments, refunds, payouts and emergency stops stay with the CrwdCtrl admin' });
  }
  req.user = decoded;
  return next();
}

module.exports = {
  INTERN_ROLE,
  collegePlatformAdminAuth,
  internBlockedFromCampusHunt,
  internBlockedFromCollegePlatform,
};
