const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const {
  trackEvent,
  getDashboardStats,
  getFestAnalytics,
  getRealtimeStats,
} = require('../controllers/analyticsController');

// Public endpoint — optionally uses auth token if present
router.post('/track', (req, res, next) => {
  // Try to extract user info but don't require it
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    try {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret);
      req.user = { userId: decoded.userId };
    } catch (_) { /* Not authenticated — fine for tracking */ }
  }
  next();
}, trackEvent);

// Admin-only endpoints
router.get('/dashboard', adminAuth, getDashboardStats);
router.get('/fests/:festId', adminAuth, getFestAnalytics);
router.get('/realtime', adminAuth, getRealtimeStats);

module.exports = router;
