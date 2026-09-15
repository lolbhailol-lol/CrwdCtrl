require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const Analytics = require('../src/model/analytics_model');
const TrekCommunity = require('../src/model/trek_community_model');
const Trek = require('../src/model/trek_model');

const OUT_JSON = path.resolve(__dirname, '../../reports/UTI-15-Day-Report-data.json');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function titleCaseDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function buildCommunityPathRegex(community) {
  const id = String(community._id);
  const slug = community.slug || '';
  const slugPart = slug ? slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const variants = [id];
  if (slugPart) variants.push(slugPart);
  return new RegExp(`^/treks/community/(${variants.join('|')})(?:/)?(?:\\?.*)?$`, 'i');
}

function buildTrekPathRegex(trek) {
  const id = String(trek._id);
  const slug = trek.slug || '';
  const slugPart = slug ? slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const variants = [id];
  if (slugPart) variants.push(slugPart);
  return {
    detail: new RegExp(`^/trek/(${variants.join('|')})(?:/)?(?:\\?.*)?$`, 'i'),
    book: new RegExp(`^/trek/(${variants.join('|')})/book(?:/)?(?:\\?.*)?$`, 'i'),
  };
}

async function getGa4CommunityMetrics({ startDate, endDate, pagePaths }) {
  const propertyId = (process.env.GA4_PROPERTY_ID || '').trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!propertyId || !clientEmail || !privateKey) {
    return { configured: false, reason: 'GA4 credentials not configured' };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];

  const pageFilter = {
    filter: {
      fieldName: 'pagePath',
      inListFilter: { values: pagePaths },
    },
  };

  const run = (requestBody) => analyticsdata.properties.runReport({ property, requestBody });

  try {
    const [totalsRes, dailyRes, deviceRes, sourceRes] = await Promise.all([
      run({
        dateRanges,
        dimensionFilter: pageFilter,
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'bounceRate' },
          { name: 'eventCount' },
          { name: 'averageSessionDuration' },
        ],
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'date' }],
        dimensionFilter: pageFilter,
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'eventCount' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        dimensionFilter: pageFilter,
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        dimensionFilter: pageFilter,
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    ]);

    const totalValues = totalsRes?.data?.rows?.[0]?.metricValues || [];
    const daily = (dailyRes?.data?.rows || []).map((row) => {
      const d = row.dimensionValues?.[0]?.value || '';
      const mv = row.metricValues || [];
      const v = (i) => Number(mv[i]?.value || 0);
      return {
        date: d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '',
        pageViews: v(0),
        activeUsers: v(1),
        sessions: v(2),
        engagementRate: Number((v(3) * 100).toFixed(1)),
        events: v(4),
      };
    });

    const devices = (deviceRes?.data?.rows || []).map((row) => ({
      device: row.dimensionValues?.[0]?.value || 'unknown',
      value: Number(row.metricValues?.[0]?.value || 0),
    }));

    const sources = (sourceRes?.data?.rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || 'Unknown',
      value: Number(row.metricValues?.[0]?.value || 0),
    }));

    return {
      configured: true,
      totals: {
        pageViews: Number(totalValues[0]?.value || 0),
        activeUsers: Number(totalValues[1]?.value || 0),
        sessions: Number(totalValues[2]?.value || 0),
        engagementRate: Number((Number(totalValues[3]?.value || 0) * 100).toFixed(1)),
        bounceRate: Number((Number(totalValues[4]?.value || 0) * 100).toFixed(1)),
        eventCount: Number(totalValues[5]?.value || 0),
        avgSessionDuration: formatDuration(Number(totalValues[6]?.value || 0)),
      },
      daily,
      devices,
      sources,
    };
  } catch (error) {
    return {
      configured: true,
      error: error?.message || 'GA4 query failed',
    };
  }
}

async function main() {
  const now = new Date();
  const start = startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const end = endOfDay(now);
  const startDate = dateKey(start);
  const endDate = dateKey(end);

  await mongoose.connect(process.env.MONGODB_URI);

  const community = await TrekCommunity.findOne({
    $or: [{ slug: 'united-travellers-of-india' }, { name: /united travellers of india/i }],
  })
    .select('name slug')
    .lean();

  if (!community) {
    throw new Error('UTI community not found (expected slug: united-travellers-of-india)');
  }

  const communityRegex = buildCommunityPathRegex(community);
  const windowMatch = {
    eventType: 'page_view',
    createdAt: { $gte: start, $lte: end },
    'metadata.page': { $regex: communityRegex },
  };

  const [communityViews, communitySessionIds, dayRows, allSessionDepthRows, deviceRows, referrerRows] = await Promise.all([
    Analytics.countDocuments(windowMatch),
    Analytics.distinct('sessionId', { ...windowMatch, sessionId: { $nin: [null, ''] } }),
    Analytics.aggregate([
      { $match: windowMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          views: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Analytics.aggregate([
      {
        $match: {
          eventType: 'page_view',
          createdAt: { $gte: start, $lte: end },
          sessionId: { $in: await Analytics.distinct('sessionId', { ...windowMatch, sessionId: { $nin: [null, ''] } }) },
        },
      },
      {
        $group: {
          _id: '$sessionId',
          totalViews: { $sum: 1 },
          uniquePaths: { $addToSet: '$metadata.page' },
        },
      },
    ]),
    Analytics.aggregate([
      { $match: windowMatch },
      {
        $group: {
          _id: { $ifNull: ['$metadata.device', 'unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Analytics.aggregate([
      { $match: windowMatch },
      {
        $group: {
          _id: { $ifNull: ['$metadata.referrer', 'direct'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const uniqueSessions = communitySessionIds.length;
  const engagedSessions = allSessionDepthRows.filter((r) => Number(r.totalViews || 0) > 1).length;
  const singlePageSessions = Math.max(0, uniqueSessions - engagedSessions);
  const engagementRate = uniqueSessions ? Number(((engagedSessions / uniqueSessions) * 100).toFixed(1)) : 0;
  const avgViewsPerSession = uniqueSessions ? Number((communityViews / uniqueSessions).toFixed(2)) : 0;
  const avgPagesPerSession = uniqueSessions
    ? Number(
      (
        allSessionDepthRows.reduce((acc, r) => acc + (Array.isArray(r.uniquePaths) ? r.uniquePaths.length : 0), 0)
        / uniqueSessions
      ).toFixed(2),
    )
    : 0;

  const byDayMap = new Map(dayRows.map((r) => [r._id, r]));
  const dayByDay = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    const row = byDayMap.get(key);
    const sessions = Array.isArray(row?.sessions) ? row.sessions.filter(Boolean).length : 0;
    dayByDay.push({
      date: key,
      label: titleCaseDate(key),
      views: Number(row?.views || 0),
      sessions,
    });
  }

  const treks = await Trek.find({ communityId: community._id, status: 'published' })
    .select('trekName slug')
    .lean();

  const bookNowClickRows = await Analytics.aggregate([
    {
      $match: {
        eventType: 'book_now_click',
        createdAt: { $gte: start, $lte: end },
        'metadata.entityType': 'trek',
      },
    },
    {
      $group: {
        _id: '$metadata.entityId',
        count: { $sum: 1 },
      },
    },
  ]);
  const clickByEntity = new Map(
    bookNowClickRows.map((r) => [String(r._id || ''), Number(r.count || 0)]),
  );

  const trekRows = [];
  for (const trek of treks) {
    const { detail, book } = buildTrekPathRegex(trek);
    const [detailViews, detailSessionIds, bookViews] = await Promise.all([
      Analytics.countDocuments({
        eventType: 'page_view',
        createdAt: { $gte: start, $lte: end },
        'metadata.page': { $regex: detail },
      }),
      Analytics.distinct('sessionId', {
        eventType: 'page_view',
        createdAt: { $gte: start, $lte: end },
        'metadata.page': { $regex: detail },
        sessionId: { $nin: [null, ''] },
      }),
      Analytics.countDocuments({
        eventType: 'page_view',
        createdAt: { $gte: start, $lte: end },
        'metadata.page': { $regex: book },
      }),
    ]);
    trekRows.push({
      name: trek.trekName,
      detailViews,
      sessions: detailSessionIds.length,
      bookViews,
      bookNowClicks:
        Number(clickByEntity.get(String(trek._id)) || 0) +
        Number(clickByEntity.get(String(trek.slug || '')) || 0),
    });
  }
  trekRows.sort((a, b) => b.detailViews - a.detailViews);
  const totalBookNowClicks = trekRows.reduce((acc, row) => acc + Number(row.bookNowClicks || 0), 0);

  function normalizeReferrer(ref) {
    const raw = String(ref || '').toLowerCase();
    if (!raw || raw === 'direct') return 'Direct';
    if (raw.includes('instagram')) return 'Instagram';
    if (raw.includes('facebook') || raw.includes('fb.')) return 'Facebook';
    if (raw.includes('google')) return 'Google';
    if (raw.includes('crwdctrl.in')) return 'Internal navigation';
    return 'Other';
  }

  const sourceMap = new Map();
  for (const row of referrerRows) {
    const key = normalizeReferrer(row._id);
    sourceMap.set(key, (sourceMap.get(key) || 0) + Number(row.count || 0));
  }
  const trafficSources = [...sourceMap.entries()]
    .map(([source, hits]) => ({ source, hits }))
    .sort((a, b) => b.hits - a.hits);

  const ga4 = await getGa4CommunityMetrics({
    startDate,
    endDate,
    pagePaths: [
      `/treks/community/${community.slug}`,
      `/treks/community/${String(community._id)}`,
    ],
  });

  const first7Days = dayByDay.slice(0, 7);
  const last7Days = dayByDay.slice(-7);
  const first7Views = first7Days.reduce((acc, d) => acc + Number(d.views || 0), 0);
  const last7Views = last7Days.reduce((acc, d) => acc + Number(d.views || 0), 0);
  const growthChangePercent = first7Views
    ? Number((((last7Views - first7Views) / first7Views) * 100).toFixed(0))
    : 0;
  const bestDay = dayByDay.reduce(
    (best, d) => (Number(d.views || 0) > Number(best.views || 0) ? d : best),
    dayByDay[0] || { label: '—', views: 0 },
  );

  const allCommunities = await TrekCommunity.find({ status: 'published' }).select('name slug').lean();
  const communityRankRows = [];
  for (const item of allCommunities) {
    const regex = buildCommunityPathRegex(item);
    const views = await Analytics.countDocuments({
      eventType: 'page_view',
      createdAt: { $gte: start, $lte: end },
      'metadata.page': { $regex: regex },
    });
    communityRankRows.push({
      id: String(item._id),
      name: item.name,
      views,
    });
  }
  communityRankRows.sort((a, b) => b.views - a.views);
  const communityRank = communityRankRows.findIndex((row) => row.id === String(community._id)) + 1;
  const totalCommunitiesRanked = communityRankRows.length;

  const output = {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate, days: 15 },
    community: {
      id: String(community._id),
      name: community.name,
      slug: community.slug || null,
      pagePath: `/treks/community/${community.slug || String(community._id)}`,
      pathAliases: [
        `/treks/community/${community.slug || String(community._id)}`,
        `/treks/community/${String(community._id)}`,
      ],
    },
    internal: {
      communityPageViews: communityViews,
      uniqueSessions,
      engagementRate,
      avgPagesPerSession,
      avgViewsPerSession,
      engagedSessions,
      singlePageSessions,
      events: communityViews,
      bookNowClicks: totalBookNowClicks,
      dayByDay,
      deviceSplit: deviceRows.map((r) => ({ device: String(r._id || 'unknown'), views: Number(r.count || 0) })),
      trafficSources,
    },
    treks: trekRows,
    ga4,
    growth: {
      first7Days: {
        startLabel: first7Days[0]?.label || '',
        endLabel: first7Days[first7Days.length - 1]?.label || '',
        views: first7Views,
      },
      last7Days: {
        startLabel: last7Days[0]?.label || '',
        endLabel: last7Days[last7Days.length - 1]?.label || '',
        views: last7Views,
      },
      changePercent: growthChangePercent,
    },
    highlights: {
      bestDay: bestDay.label,
      bestDayViews: Number(bestDay.views || 0),
      publishedTreks: trekRows.length,
      communityRank,
      totalCommunitiesRanked,
      topSocialSource: trafficSources.find((s) => ['Instagram', 'Facebook'].includes(s.source))?.source || 'Instagram',
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');
  await mongoose.disconnect();
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
