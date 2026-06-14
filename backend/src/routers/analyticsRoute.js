const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const {
  trackEvent,
  getDashboardStats,
  getFestAnalytics,
  getRealtimeStats,
  getRevenueSummary,
} = require('../controllers/analyticsController');
const { getJwtSecret } = require('../config/jwtSecret');

// Public endpoint — optionally uses auth token if present
router.post('/track', (req, res, next) => {
  // Try to extract user info but don't require it
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    try {
      const token = authHeader.substring(7);
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      req.user = { userId: decoded.userId };
    } catch (_) { /* Not authenticated — fine for tracking */ }
  }
  next();
}, trackEvent);

// Admin-only endpoints
router.get('/dashboard', adminAuth, getDashboardStats);
router.get('/revenue-summary', adminAuth, getRevenueSummary);
router.get('/fests/:festId', adminAuth, getFestAnalytics);
router.get('/realtime', adminAuth, getRealtimeStats);

// ===== CATEGORY ANALYTICS =====

// GET /api/analytics/category-summary
// Returns registrations count + revenue per category (sports, trek, events)
router.get('/category-summary', adminAuth, async (req, res) => {
    try {
        const CategoryRegistration = require('../model/category_registration_model');
        const SportsEvent = require('../model/sports_model');
        const Trek = require('../model/trek_model');
        const EventShow = require('../model/event_show_model');

        const [
            regSummary,
            sportsTotal,
            treksTotal,
            eventsTotal,
        ] = await Promise.all([
            CategoryRegistration.aggregate([
                {
                    $group: {
                        _id: '$category',
                        totalRegistrations: { $sum: 1 },
                        confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
                        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                        revenue: { $sum: '$amountPaid' },
                    },
                },
            ]),
            SportsEvent.countDocuments({ status: 'published' }),
            Trek.countDocuments({ status: 'published' }),
            EventShow.countDocuments({ status: 'published' }),
        ]);

        // Build category map for easy lookup
        const regMap = {};
        regSummary.forEach(r => { regMap[r._id] = r; });

        res.json({
            categories: {
                sports: {
                    activeEvents: sportsTotal,
                    totalRegistrations: regMap.sports?.totalRegistrations || 0,
                    confirmed: regMap.sports?.confirmed || 0,
                    pending: regMap.sports?.pending || 0,
                    revenue: regMap.sports?.revenue || 0,
                },
                trek: {
                    activeEvents: treksTotal,
                    totalRegistrations: regMap.trek?.totalRegistrations || 0,
                    confirmed: regMap.trek?.confirmed || 0,
                    pending: regMap.trek?.pending || 0,
                    revenue: regMap.trek?.revenue || 0,
                },
                events: {
                    activeEvents: eventsTotal,
                    totalRegistrations: regMap.events?.totalRegistrations || 0,
                    confirmed: regMap.events?.confirmed || 0,
                    pending: regMap.events?.pending || 0,
                    revenue: regMap.events?.revenue || 0,
                },
            },
        });
    } catch (error) {
        console.error('analytics category-summary error:', error);
        res.status(500).json({ message: 'Failed to fetch category analytics' });
    }
});

// GET /api/analytics/category-registrations?category=sports&days=30
// Returns daily registration counts for a category over a time window
router.get('/category-registrations', adminAuth, async (req, res) => {
    try {
        const CategoryRegistration = require('../model/category_registration_model');
        const { category, days = 30 } = req.query;

        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const filter = { createdAt: { $gte: since } };
        if (category) filter.category = category;

        const data = await CategoryRegistration.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        category: '$category',
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.date': 1 } },
        ]);

        res.json({ data });
    } catch (error) {
        console.error('analytics category-registrations error:', error);
        res.status(500).json({ message: 'Failed to fetch registration trend data' });
    }
});

module.exports = router;
