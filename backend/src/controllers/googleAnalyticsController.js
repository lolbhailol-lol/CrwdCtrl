const {
  isConfigured,
  getAnalyticsSummary,
  getRealtimeActiveUsers,
} = require('../services/googleAnalyticsService');
const { describeGaError } = require('../utils/gaErrorMessage');

// Friendly hint shown in the admin panel when GA4 isn't wired up yet.
const SETUP_STEPS = [
  'Create a GA4 property at analytics.google.com (or use an existing one).',
  'Copy its numeric Property ID from Admin → Property Settings (e.g. 123456789).',
  'Add GA4_PROPERTY_ID=<that id> to the backend .env file.',
  'In Google Cloud Console, enable the "Google Analytics Data API" for the same project as your service account.',
  'In GA4 Admin → Property Access Management, grant the service account email (GOOGLE_SERVICE_ACCOUNT_EMAIL) at least "Viewer" access.',
  'Restart the backend — metrics will appear here automatically.',
];

// GET /api/analytics/google?days=28
const getGoogleAnalytics = async (req, res) => {
  if (!isConfigured()) {
    return res.json({ configured: false, setupSteps: SETUP_STEPS });
  }

  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 28, 1), 365);
    const { startDate, endDate } = req.query;
    const summary = await getAnalyticsSummary({ days, startDate, endDate });
    res.json(summary);
  } catch (error) {
    console.error('Google Analytics summary error:', describeGaError(error));
    res.status(502).json({
      configured: true,
      error: describeGaError(error),
      setupSteps: SETUP_STEPS,
    });
  }
};

// GET /api/analytics/google/realtime
const getGoogleAnalyticsRealtime = async (req, res) => {
  if (!isConfigured()) {
    return res.json({ configured: false, activeUsers: 0 });
  }

  try {
    const activeUsers = await getRealtimeActiveUsers();
    res.json({ configured: true, activeUsers });
  } catch (error) {
    console.error('Google Analytics realtime error:', describeGaError(error));
    res.status(502).json({ configured: true, activeUsers: 0, error: describeGaError(error) });
  }
};

module.exports = { getGoogleAnalytics, getGoogleAnalyticsRealtime };
