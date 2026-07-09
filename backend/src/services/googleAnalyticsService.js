const { google } = require('googleapis');
const { buildSlugPathLookup, mergePageViewStats } = require('../utils/analyticsPathNormalizer');
const { ensurePageViewPathsMigrated } = require('./analyticsPathMigration');

/**
 * Google Analytics (GA4) Data API integration.
 *
 * Reuses the same Google service account used for Google Sheets
 * (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY). The only extra
 * configuration required is GA4_PROPERTY_ID — the numeric GA4 property id
 * (e.g. 123456789) found in GA4 Admin → Property Settings.
 *
 * The service account email must be granted at least "Viewer" access to the
 * GA4 property (GA4 Admin → Property Access Management), and the
 * "Google Analytics Data API" must be enabled in the Google Cloud project.
 */

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const getPropertyId = () => (process.env.GA4_PROPERTY_ID || '').trim();

const isConfigured = () =>
  Boolean(
    getPropertyId() &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );

let analyticsDataClient = null;

const getAnalyticsClient = () => {
  if (analyticsDataClient) return analyticsDataClient;

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google service account credentials are not configured.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: serviceAccountEmail, private_key: privateKey },
    scopes: [GA_SCOPE],
  });

  analyticsDataClient = google.analyticsdata({ version: 'v1beta', auth });
  return analyticsDataClient;
};

// Convert a GA4 runReport response into [{ key, value }] using the first
// dimension as the label and the first metric as the numeric value.
const mapRows = (response, { keyName = 'key' } = {}) => {
  const rows = response?.data?.rows || [];
  return rows.map((row) => ({
    [keyName]: row.dimensionValues?.[0]?.value || '(not set)',
    value: Number(row.metricValues?.[0]?.value || 0),
  }));
};

const formatDuration = (seconds) => {
  const s = Math.round(Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
};

// GA4 returns dates as 'YYYYMMDD' — convert to ISO 'YYYY-MM-DD'.
const toIsoDate = (ga) =>
  ga && ga.length === 8 ? `${ga.slice(0, 4)}-${ga.slice(4, 6)}-${ga.slice(6, 8)}` : ga;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pull a dashboard-friendly summary of GA4 metrics for the given window.
 * @param {Object} opts
 * @param {number} opts.days - look-back window in days (default 28)
 * @param {string} [opts.startDate] - explicit start date 'YYYY-MM-DD' (overrides days)
 * @param {string} [opts.endDate] - explicit end date 'YYYY-MM-DD' (defaults to today)
 */
const getAnalyticsSummary = async ({ days = 28, startDate: customStart, endDate: customEnd } = {}) => {
  const propertyId = getPropertyId();
  const property = `properties/${propertyId}`;

  // Explicit dates take priority over the rolling "Ndaysago" window.
  const useCustom = ISO_DATE.test(customStart || '');
  const startDate = useCustom ? customStart : `${Math.max(1, Number(days) || 28)}daysAgo`;
  const endDate = ISO_DATE.test(customEnd || '') ? customEnd : 'today';
  const dateRanges = [{ startDate, endDate }];
  const client = getAnalyticsClient();

  // Rewrite stored internal analytics + normalize GA page paths using slug names.
  ensurePageViewPathsMigrated().catch(() => {});

  const run = (requestBody) =>
    client.properties.runReport({ property, requestBody });

  const [
    totalsRes,
    byDateRes,
    topPagesRes,
    countriesRes,
    devicesRes,
    sourcesRes,
    eventsRes,
  ] = await Promise.all([
    run({
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'eventCount' },
        { name: 'averageSessionDuration' },
        { name: 'engagementRate' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 100,
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    }),
    run({
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 15,
    }),
  ]);

  const totalRow = totalsRes?.data?.rows?.[0]?.metricValues || [];
  const num = (i) => Number(totalRow[i]?.value || 0);

  // Device breakdown as { desktop, mobile, tablet }
  const devices = {};
  mapRows(devicesRes, { keyName: 'device' }).forEach((d) => {
    devices[d.device] = d.value;
  });

  const slugLookup = await buildSlugPathLookup();
  const topPages = mergePageViewStats(mapRows(topPagesRes, { keyName: 'page' }), slugLookup)
    .slice(0, 8);

  return {
    configured: true,
    range: { days: useCustom ? null : (Number(days) || 28), startDate, endDate },
    totals: {
      activeUsers: num(0),
      newUsers: num(1),
      sessions: num(2),
      pageViews: num(3),
      avgSessionDuration: formatDuration(num(4)),
      bounceRate: `${(num(5) * 100).toFixed(1)}%`,
    },
    // Detailed per-day breakdown (most recent first), one row per calendar day.
    daily: (byDateRes?.data?.rows || []).map((row) => {
      const mv = row.metricValues || [];
      const v = (i) => Number(mv[i]?.value || 0);
      return {
        date: toIsoDate(row.dimensionValues?.[0]?.value || ''),
        activeUsers: v(0),
        newUsers: v(1),
        sessions: v(2),
        pageViews: v(3),
        events: v(4),
        avgSessionDuration: formatDuration(v(5)),
        engagementRate: `${(v(6) * 100).toFixed(1)}%`,
        bounceRate: `${(v(7) * 100).toFixed(1)}%`,
      };
    }),
    topPages: topPages,
    topCountries: mapRows(countriesRes, { keyName: 'country' }),
    devices,
    trafficSources: mapRows(sourcesRes, { keyName: 'source' }),
    topEvents: mapRows(eventsRes, { keyName: 'event' }),
  };
};

/**
 * Realtime active users (last 30 minutes).
 */
const getRealtimeActiveUsers = async () => {
  const property = `properties/${getPropertyId()}`;
  const client = getAnalyticsClient();
  const res = await client.properties.runRealtimeReport({
    property,
    requestBody: { metrics: [{ name: 'activeUsers' }] },
  });
  return Number(res?.data?.rows?.[0]?.metricValues?.[0]?.value || 0);
};

module.exports = {
  isConfigured,
  getAnalyticsSummary,
  getRealtimeActiveUsers,
};
