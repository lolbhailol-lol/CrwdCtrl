const {
  isConfigured,
  getAnalyticsSummary,
  getRealtimeActiveUsers,
} = require('../services/googleAnalyticsService');

// Friendly hint shown in the admin panel when GA4 isn't wired up yet.
const SETUP_STEPS = [
  'Create a GA4 property at analytics.google.com (or use an existing one).',
  'Copy its numeric Property ID from Admin → Property Settings (e.g. 123456789).',
  'Add GA4_PROPERTY_ID=<that id> to the backend .env file.',
  'In Google Cloud Console, enable the "Google Analytics Data API" for the same project as your service account.',
  'In GA4 Admin → Property Access Management, grant the service account email (GOOGLE_SERVICE_ACCOUNT_EMAIL) at least "Viewer" access.',
  'Restart the backend — metrics will appear here automatically.',
];

// Translate GA Data API errors into a readable, actionable message.
const describeError = (error) => {
  const msg = error?.errors?.[0]?.message || error?.message || 'Unknown error';
  if (/permission|caller does not have|403/i.test(msg)) {
    return 'The service account does not have access to this GA4 property. Grant it "Viewer" access in GA4 Admin → Property Access Management.';
  }
  if (/has not been used|disabled|Data API/i.test(msg)) {
    return 'The Google Analytics Data API is not enabled for this project. Enable it in Google Cloud Console.';
  }
  if (/property|404|invalid/i.test(msg)) {
    return 'Invalid GA4_PROPERTY_ID. Use the numeric Property ID from GA4 Admin → Property Settings.';
  }
  return msg;
};

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
    console.error('Google Analytics summary error:', error?.message || error);
    res.status(502).json({
      configured: true,
      error: describeError(error),
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
    console.error('Google Analytics realtime error:', error?.message || error);
    res.status(200).json({ configured: true, activeUsers: 0, error: describeError(error) });
  }
};

module.exports = { getGoogleAnalytics, getGoogleAnalyticsRealtime };
