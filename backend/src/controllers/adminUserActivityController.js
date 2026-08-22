const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const User = require('../model/usermodel');
const {
    parseReportRange,
    normalizeEmail,
} = require('../services/userActivityService');
const { backfillUserActivitySinceDecember } = require('../services/userActivityBackfillService');
const { runUserActivityEnrichment } = require('../services/userActivityEnrichmentService');
const { fetchGaActivityForRange } = require('../services/userActivityGaService');
const {
    listAllUsersWithSummaries,
    getFullUserHistory,
} = require('../services/userFullHistoryService');

function formatDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveRange(req) {
    return parseReportRange(req.query);
}

function mergeDailyWithGa(internalDaily, gaDaily) {
    const byDate = {};
    const mergeDay = (date, patch) => {
        if (!date) return;
        byDate[date] = { date, ...(byDate[date] || {}), ...patch };
    };

    (internalDaily || []).forEach((row) => mergeDay(row.date, row));
    (gaDaily || []).forEach((row) => mergeDay(row.date, {
        pageViews: row.pageViews,
        uniqueActiveUsers: row.activeUsers,
        uniqueSessions: row.sessions,
        engagementFormatted: row.avgSessionDuration,
        engagementRate: row.engagementRate,
        bounceRate: row.bounceRate,
        gaNewUsers: row.newUsers,
        gaEvents: row.events,
        trafficSource: 'google_analytics',
    }));

    return Object.values(byDate)
        .map((d) => ({
            date: d.date,
            logins: d.logins || 0,
            uniqueLogins: d.uniqueLogins || 0,
            pageViews: d.pageViews || 0,
            uniqueActiveUsers: d.uniqueActiveUsers || 0,
            uniqueSessions: d.uniqueSessions || 0,
            engagementSeconds: d.engagementSeconds || 0,
            engagementFormatted: d.engagementFormatted || formatDuration(d.engagementSeconds || 0),
            engagementRate: d.engagementRate || null,
            bounceRate: d.bounceRate || null,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

// POST /admin/user-activity/backfill — import Analytics + user logins since Dec 1
const runBackfill = async (req, res) => {
    try {
        const force = req.body?.force === true || req.query.force === 'true';
        const enrich = req.body?.enrich !== false && req.query.enrich !== 'false';
        const result = await backfillUserActivitySinceDecember({ force });
        const enrichment = enrich ? await runUserActivityEnrichment() : null;
        res.json({ success: true, ...result, enrichment });
    } catch (error) {
        console.error('Admin user-activity backfill error:', error);
        res.status(500).json({ success: false, message: 'Backfill failed' });
    }
};

// GET /admin/user-activity/overview?range=since-dec
const getOverview = async (req, res) => {
    try {
        const { match, range } = resolveRange(req);
        const loggedInOnly = req.query.loggedInOnly === 'true';
        const isAllTime = Boolean(range.allTime);

        const activityMatch = loggedInOnly
            ? { ...match, email: { $nin: [null, ''] } }
            : match;

        const loginMatch = match;

        const [
            totalLogins,
            uniqueLoginEmails,
            totalPageViews,
            engagementAgg,
            uniqueActiveEmails,
            uniqueSessions,
            topPages,
            topActiveUsers,
            deviceBreakdown,
            methodBreakdown,
            ga,
            totalRegisteredUsers,
            usersWithLastLogin,
            lifetimeLoginAgg,
            internalLoggedInPageViews,
        ] = await Promise.all([
            UserLoginLog.countDocuments(loginMatch),
            UserLoginLog.distinct('email', { ...loginMatch, email: { $nin: [''] } }),
            UserActivityLog.countDocuments({ ...activityMatch, eventType: 'page_view', durationSeconds: 0 }),
            UserActivityLog.aggregate([
                { $match: { ...activityMatch, durationSeconds: { $gt: 0 } } },
                {
                    $group: {
                        _id: null,
                        totalSeconds: { $sum: '$durationSeconds' },
                        events: { $sum: 1 },
                    },
                },
            ]),
            UserActivityLog.distinct('email', { ...activityMatch, email: { $nin: [''] } }),
            UserActivityLog.distinct('sessionId', { ...activityMatch, sessionId: { $nin: [null, ''] } }),
            UserActivityLog.aggregate([
                { $match: { ...activityMatch, eventType: 'page_view', page: { $nin: ['', null] } } },
                {
                    $group: {
                        _id: '$page',
                        views: {
                            $sum: { $cond: [{ $eq: ['$durationSeconds', 0] }, 1, 0] },
                        },
                        totalSeconds: { $sum: '$durationSeconds' },
                    },
                },
                { $sort: { views: -1 } },
                { $limit: 10 },
            ]),
            UserActivityLog.aggregate([
                { $match: { ...activityMatch, email: { $nin: [''] } } },
                {
                    $group: {
                        _id: '$email',
                        pageViews: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$eventType', 'page_view'] }, { $eq: ['$durationSeconds', 0] }] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        engagementSeconds: { $sum: '$durationSeconds' },
                        lastActiveAt: { $max: '$createdAt' },
                    },
                },
                { $sort: { engagementSeconds: -1 } },
                { $limit: 10 },
            ]),
            UserActivityLog.aggregate([
                { $match: activityMatch },
                { $group: { _id: '$device', count: { $sum: 1 } } },
            ]),
            UserLoginLog.aggregate([
                { $match: loginMatch },
                { $group: { _id: '$method', count: { $sum: 1 } } },
            ]),
            fetchGaActivityForRange(range),
            User.countDocuments({}),
            User.countDocuments({ lastLoginAt: { $ne: null } }),
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalLogins: { $sum: { $ifNull: ['$loginCount', 0] } },
                        usersWithLogins: {
                            $sum: { $cond: [{ $gt: [{ $ifNull: ['$loginCount', 0] }, 0] }, 1, 0] },
                        },
                    },
                },
            ]),
            UserActivityLog.countDocuments({
                ...activityMatch,
                eventType: 'page_view',
                durationSeconds: 0,
                $or: [{ userId: { $ne: null } }, { email: { $nin: ['', null] } }],
            }),
        ]);

        const lifetime = lifetimeLoginAgg[0] || { totalLogins: 0, usersWithLogins: 0 };
        const usersWhoLoggedIn = isAllTime
            ? Math.max(uniqueLoginEmails.length, lifetime.usersWithLogins || 0, usersWithLastLogin || 0)
            : Math.max(uniqueLoginEmails.length, usersWithLastLogin || 0);
        const displayTotalLogins = isAllTime
            ? Math.max(totalLogins, lifetime.totalLogins || 0)
            : totalLogins;
        const neverLoggedIn = Math.max(0, totalRegisteredUsers - usersWhoLoggedIn);
        const loginRate = totalRegisteredUsers > 0
            ? Math.round((usersWhoLoggedIn / totalRegisteredUsers) * 1000) / 10
            : 0;
        const loggedInPageViews = internalLoggedInPageViews;

        const engagement = engagementAgg[0] || { totalSeconds: 0, events: 0 };
        const avgEngagementPerEvent = engagement.events > 0
            ? Math.round(engagement.totalSeconds / engagement.events)
            : 0;
        const avgPagesPerSession = ga?.configured && ga?.totals
            ? (ga.totals.sessions > 0
                ? Math.round((ga.totals.pageViews / ga.totals.sessions) * 10) / 10
                : 0)
            : (uniqueSessions.length > 0
                ? Math.round((totalPageViews / uniqueSessions.length) * 10) / 10
                : 0);

        const useGaTraffic = ga?.configured && ga?.totals && !ga.error;
        const displayPageViews = useGaTraffic ? ga.totals.pageViews : totalPageViews;
        const displaySessions = useGaTraffic ? ga.totals.sessions : uniqueSessions.length;
        const displayActiveUsers = useGaTraffic ? ga.totals.activeUsers : uniqueActiveEmails.length;
        const displayEngagement = useGaTraffic ? ga.totals.avgSessionDuration : formatDuration(engagement.totalSeconds);
        const displayTopPages = useGaTraffic
            ? (ga.topPages || []).map((p) => ({
                page: p.page,
                views: p.value,
                engagementFormatted: '—',
            }))
            : topPages.map((p) => ({
                page: p._id,
                views: p.views,
                engagementSeconds: p.totalSeconds,
                engagementFormatted: formatDuration(p.totalSeconds),
            }));
        const displayDevices = useGaTraffic ? (ga.devices || {}) : Object.fromEntries(deviceBreakdown.map((d) => [d._id || 'unknown', d.count]));

        res.json({
            success: true,
            range,
            trafficSource: useGaTraffic ? 'google_analytics' : 'internal',
            ga: ga?.configured ? {
                configured: true,
                error: ga.error || null,
                range: ga.range || null,
            } : { configured: false },
            stats: {
                totalLogins: displayTotalLogins,
                uniqueUsersLoggedIn: usersWhoLoggedIn,
                totalRegisteredUsers,
                neverLoggedIn,
                loginRate,
                totalPageViews: displayPageViews,
                uniqueActiveUsers: displayActiveUsers,
                uniqueSessions: displaySessions,
                totalEngagementSeconds: engagement.totalSeconds,
                totalEngagementFormatted: displayEngagement,
                avgEngagementPerPage: useGaTraffic ? ga.totals.avgSessionDuration : formatDuration(avgEngagementPerEvent),
                avgPagesPerSession,
                bounceRate: useGaTraffic ? ga.totals.bounceRate : null,
                newUsers: useGaTraffic ? ga.totals.newUsers : null,
                internalPageViews: totalPageViews,
                loggedInPageViews,
                internalSessions: uniqueSessions.length,
                internalEngagementFormatted: formatDuration(engagement.totalSeconds),
                loggedInActiveUsers: uniqueActiveEmails.length,
            },
            platform: {
                totalRegisteredUsers,
                usersWhoLoggedIn,
                neverLoggedIn,
                loginRate,
                totalSignIns: displayTotalLogins,
                internalPageViews: totalPageViews,
                loggedInPageViews,
                loggedInActiveUsers: uniqueActiveEmails.length,
                internalSessions: uniqueSessions.length,
                internalEngagementFormatted: formatDuration(engagement.totalSeconds),
            },
            traffic: useGaTraffic ? {
                source: 'google_analytics',
                pageViews: ga.totals.pageViews,
                sessions: ga.totals.sessions,
                siteVisitors: ga.totals.activeUsers,
                newVisitors: ga.totals.newUsers,
                avgSessionDuration: ga.totals.avgSessionDuration,
                avgPagesPerSession,
                bounceRate: ga.totals.bounceRate,
            } : {
                source: 'internal',
                pageViews: totalPageViews,
                sessions: uniqueSessions.length,
                siteVisitors: uniqueActiveEmails.length,
                newVisitors: null,
                avgSessionDuration: formatDuration(engagement.totalSeconds),
                avgPagesPerSession,
                bounceRate: null,
            },
            topPages: displayTopPages,
            topActiveUsers: topActiveUsers.map((u) => ({
                email: u._id,
                pageViews: u.pageViews,
                engagementSeconds: u.engagementSeconds,
                engagementFormatted: formatDuration(u.engagementSeconds),
                lastActiveAt: u.lastActiveAt,
            })),
            devices: displayDevices,
            loginMethods: Object.fromEntries(methodBreakdown.map((m) => [m._id || 'unknown', m.count])),
        });
    } catch (error) {
        console.error('Admin user-activity overview error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user activity overview' });
    }
};

// GET /admin/user-activity/daily?range=since-dec
const getDailyBreakdown = async (req, res) => {
    try {
        const { match, range } = resolveRange(req);

        const [loginDaily, activityDaily, engagementDaily, ga] = await Promise.all([
            UserLoginLog.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        logins: { $sum: 1 },
                        uniqueEmails: { $addToSet: '$email' },
                    },
                },
                {
                    $project: {
                        date: '$_id',
                        logins: 1,
                        uniqueLogins: {
                            $size: {
                                $filter: {
                                    input: '$uniqueEmails',
                                    as: 'e',
                                    cond: { $and: [{ $ne: ['$$e', ''] }, { $ne: ['$$e', null] }] },
                                },
                            },
                        },
                    },
                },
                { $sort: { date: -1 } },
            ]),
            UserActivityLog.aggregate([
                { $match: { ...match, eventType: 'page_view', durationSeconds: 0 } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        pageViews: { $sum: 1 },
                        uniqueEmails: { $addToSet: '$email' },
                        uniqueSessions: { $addToSet: '$sessionId' },
                    },
                },
                {
                    $project: {
                        date: '$_id',
                        pageViews: 1,
                        uniqueActiveUsers: {
                            $size: {
                                $filter: {
                                    input: '$uniqueEmails',
                                    as: 'e',
                                    cond: { $and: [{ $ne: ['$$e', ''] }, { $ne: ['$$e', null] }] },
                                },
                            },
                        },
                        uniqueSessions: {
                            $size: {
                                $filter: {
                                    input: '$uniqueSessions',
                                    as: 's',
                                    cond: { $and: [{ $ne: ['$$s', ''] }, { $ne: ['$$s', null] }] },
                                },
                            },
                        },
                    },
                },
                { $sort: { date: -1 } },
            ]),
            UserActivityLog.aggregate([
                { $match: { ...match, durationSeconds: { $gt: 0 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        engagementSeconds: { $sum: '$durationSeconds' },
                    },
                },
                { $sort: { date: -1 } },
            ]),
            fetchGaActivityForRange(range),
        ]);

        const byDate = {};
        const mergeDay = (date, patch) => {
            if (!date) return;
            byDate[date] = { date, ...(byDate[date] || {}), ...patch };
        };

        loginDaily.forEach((row) => mergeDay(row.date, {
            logins: row.logins,
            uniqueLogins: row.uniqueLogins,
        }));
        activityDaily.forEach((row) => mergeDay(row.date, {
            pageViews: row.pageViews,
            uniqueActiveUsers: row.uniqueActiveUsers,
            uniqueSessions: row.uniqueSessions,
        }));
        engagementDaily.forEach((row) => mergeDay(row.date, {
            engagementSeconds: row.engagementSeconds,
            engagementFormatted: formatDuration(row.engagementSeconds),
        }));

        const internalDaily = Object.values(byDate)
            .map((d) => ({
                date: d.date,
                logins: d.logins || 0,
                uniqueLogins: d.uniqueLogins || 0,
                pageViews: d.pageViews || 0,
                uniqueActiveUsers: d.uniqueActiveUsers || 0,
                uniqueSessions: d.uniqueSessions || 0,
                engagementSeconds: d.engagementSeconds || 0,
                engagementFormatted: formatDuration(d.engagementSeconds || 0),
            }))
            .sort((a, b) => b.date.localeCompare(a.date));

        const daily = mergeDailyWithGa(internalDaily, ga?.daily || []);

        res.json({
            success: true,
            range,
            trafficSource: ga?.configured && ga?.totals && !ga.error ? 'google_analytics' : 'internal',
            ga: ga?.configured ? { configured: true, error: ga.error || null, range: ga.range || null } : { configured: false },
            daily,
        });
    } catch (error) {
        console.error('Admin user-activity daily error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch daily breakdown' });
    }
};

// GET /admin/user-activity/logins?range=since-dec&page=1&search=
const listLogins = async (req, res) => {
    try {
        const { match, range } = resolveRange(req);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const skip = (page - 1) * limit;
        const search = normalizeEmail(req.query.search || req.query.email || '');

        const query = { ...match };
        if (search) {
            query.email = new RegExp(escapeRegex(search), 'i');
        }

        const [rows, total] = await Promise.all([
            UserLoginLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserLoginLog.countDocuments(query),
        ]);

        res.json({
            success: true,
            range,
            logins: rows.map((r) => ({
                id: String(r._id),
                userId: r.userId ? String(r.userId) : null,
                email: r.email || '',
                name: r.name || '',
                method: r.method || 'password',
                ip: r.ip || '',
                device: r.device || 'unknown',
                userAgent: r.userAgent || '',
                sessionId: r.sessionId || null,
                source: r.source || 'live',
                lifetimeLoginCount: r.lifetimeLoginCount ?? null,
                loggedInAt: r.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('Admin user-activity logins error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch login history' });
    }
};

// GET /admin/user-activity/feed?range=since-dec&page=1&search=
const listActivityFeed = async (req, res) => {
    try {
        const { match, range } = resolveRange(req);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const skip = (page - 1) * limit;
        const search = normalizeEmail(req.query.search || req.query.email || '');
        const eventType = String(req.query.eventType || '').trim();
        const loggedInOnly = req.query.loggedInOnly === 'true';

        const query = { ...match };
        if (loggedInOnly) query.email = { $nin: [null, ''] };
        if (search) query.email = new RegExp(escapeRegex(search), 'i');
        if (eventType) query.eventType = eventType;

        const [rows, total] = await Promise.all([
            UserActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserActivityLog.countDocuments(query),
        ]);

        res.json({
            success: true,
            range,
            activity: rows.map((r) => ({
                id: String(r._id),
                userId: r.userId ? String(r.userId) : null,
                email: r.email || '(guest)',
                eventType: r.eventType,
                page: r.page || '',
                previousPage: r.previousPage || '',
                durationSeconds: r.durationSeconds || 0,
                durationFormatted: formatDuration(r.durationSeconds),
                device: r.device || 'unknown',
                sessionId: r.sessionId || null,
                source: r.source || 'live',
                metadata: r.metadata || {},
                occurredAt: r.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('Admin user-activity feed error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity feed' });
    }
};

// GET /admin/user-activity/user?email=&range=since-dec
const getUserDetail = async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email || '');
        if (!email) {
            return res.status(400).json({ success: false, message: 'email query param is required' });
        }

        const { match, range } = resolveRange(req);
        const userMatch = { ...match, email: new RegExp(`^${escapeRegex(email)}$`, 'i') };

        const user = await User.findOne({ email }).select('name email role createdAt lastLoginAt loginCount').lean();

        const [
            logins,
            loginCount,
            pageViews,
            engagementAgg,
            sessions,
            pages,
            recentActivity,
        ] = await Promise.all([
            UserLoginLog.find(userMatch).sort({ createdAt: -1 }).limit(20).lean(),
            UserLoginLog.countDocuments(userMatch),
            UserActivityLog.countDocuments({ ...userMatch, eventType: 'page_view', durationSeconds: 0 }),
            UserActivityLog.aggregate([
                { $match: { ...userMatch, durationSeconds: { $gt: 0 } } },
                { $group: { _id: null, totalSeconds: { $sum: '$durationSeconds' } } },
            ]),
            UserActivityLog.aggregate([
                { $match: userMatch },
                {
                    $group: {
                        _id: '$sessionId',
                        pageViews: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ['$eventType', 'page_view'] }, { $eq: ['$durationSeconds', 0] }] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        engagementSeconds: { $sum: '$durationSeconds' },
                        firstAt: { $min: '$createdAt' },
                        lastAt: { $max: '$createdAt' },
                    },
                },
                { $sort: { lastAt: -1 } },
                { $limit: 15 },
            ]),
            UserActivityLog.aggregate([
                { $match: { ...userMatch, eventType: 'page_view', page: { $nin: ['', null] } } },
                {
                    $group: {
                        _id: '$page',
                        views: {
                            $sum: { $cond: [{ $eq: ['$durationSeconds', 0] }, 1, 0] },
                        },
                        totalSeconds: { $sum: '$durationSeconds' },
                        lastVisitedAt: { $max: '$createdAt' },
                    },
                },
                { $sort: { views: -1 } },
                { $limit: 20 },
            ]),
            UserActivityLog.find(userMatch).sort({ createdAt: -1 }).limit(50).lean(),
        ]);

        const totalEngagement = engagementAgg[0]?.totalSeconds || 0;

        res.json({
            success: true,
            range,
            user: user ? {
                id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role,
                joinedAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
                lifetimeLoginCount: user.loginCount || 0,
            } : null,
            summary: {
                logins: loginCount,
                pageViews,
                totalEngagementSeconds: totalEngagement,
                totalEngagementFormatted: formatDuration(totalEngagement),
                sessions: sessions.filter((s) => s._id).length,
            },
            recentLogins: logins.map((l) => ({
                id: String(l._id),
                method: l.method,
                ip: l.ip,
                device: l.device,
                loggedInAt: l.createdAt,
            })),
            sessions: sessions.map((s) => ({
                sessionId: s._id || 'unknown',
                pageViews: s.pageViews,
                engagementSeconds: s.engagementSeconds,
                engagementFormatted: formatDuration(s.engagementSeconds),
                startedAt: s.firstAt,
                lastActiveAt: s.lastAt,
            })),
            topPages: pages.map((p) => ({
                page: p._id,
                views: p.views,
                engagementSeconds: p.totalSeconds,
                engagementFormatted: formatDuration(p.totalSeconds),
                lastVisitedAt: p.lastVisitedAt,
            })),
            timeline: recentActivity.map((a) => ({
                id: String(a._id),
                eventType: a.eventType,
                page: a.page,
                durationSeconds: a.durationSeconds,
                durationFormatted: formatDuration(a.durationSeconds),
                occurredAt: a.createdAt,
            })),
        });
    } catch (error) {
        console.error('Admin user-activity user detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user activity detail' });
    }
};

// GET /admin/user-activity/all-users?page=1&search=
const listAllUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const search = String(req.query.search || '').trim();
        const sort = String(req.query.sort || 'createdAt').trim();

        const result = await listAllUsersWithSummaries({ page, limit, search, sort });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Admin user-activity all-users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

// GET /admin/user-activity/full-history?email= or ?userId=
const getFullHistory = async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email || '');
        const userId = String(req.query.userId || '').trim();
        if (!email && !userId) {
            return res.status(400).json({ success: false, message: 'email or userId is required' });
        }

        const result = await getFullUserHistory({ email, userId });
        if (!result.user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Admin user-activity full-history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch full user history' });
    }
};

module.exports = {
    getOverview,
    getDailyBreakdown,
    listLogins,
    listActivityFeed,
    getUserDetail,
    listAllUsers,
    getFullHistory,
    runBackfill,
};
