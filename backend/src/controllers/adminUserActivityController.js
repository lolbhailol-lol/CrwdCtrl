const mongoose = require('mongoose');
const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const User = require('../model/usermodel');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const Registration = require('../model/registration_model');
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
const { toSlug } = require('../utils/slug');

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

function isObjectId(value) {
    return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

function idVariants(id) {
    const raw = String(id || '').trim();
    if (!raw) return [];
    const variants = [raw];
    if (isObjectId(raw)) {
        variants.push(new mongoose.Types.ObjectId(raw));
    }
    return variants;
}

function metadataIdMatch(field, id) {
    const variants = idVariants(id);
    if (!variants.length) return null;
    return { [field]: { $in: variants } };
}

function buildPathTokens(entity = {}, nameKeys = []) {
    const tokens = new Set();
    const id = String(entity._id || entity.id || '').trim();
    if (id) tokens.add(id);
    const slug = toSlug(entity.slug || '');
    if (slug) tokens.add(slug);
    nameKeys.forEach((key) => {
        const named = toSlug(entity[key] || '');
        if (named) tokens.add(named);
    });
    (entity.previousSlugs || []).forEach((s) => {
        const prev = toSlug(s);
        if (prev) tokens.add(prev);
    });
    return [...tokens].filter(Boolean);
}

function buildScopedActivityMatch({ match, festId, competitionId, pageFilter, fest, competitions }) {
    const clauses = [];
    const festMeta = festId ? metadataIdMatch('metadata.festId', festId) : null;
    const competitionMeta = competitionId
        ? metadataIdMatch('metadata.competitionId', competitionId)
        : null;

    if (competitionMeta) {
        clauses.push(competitionMeta);
        clauses.push({
            eventType: { $in: ['competition_view', 'book_now_click', 'similar_competition_click', 'registration'] },
            ...competitionMeta,
        });
    } else if (festMeta) {
        clauses.push(festMeta);
        clauses.push({
            eventType: { $in: ['fest_view', 'explore_fest_click', 'registration', 'book_now_click'] },
            ...festMeta,
        });
        const competitionIds = (competitions || []).map((c) => String(c._id));
        if (competitionIds.length) {
            clauses.push({
                $or: competitionIds.map((id) => metadataIdMatch('metadata.competitionId', id)).filter(Boolean),
            });
        }
    }

    const pageTokens = [];
    if (competitionId) {
        const competition = (competitions || []).find((c) => String(c._id) === String(competitionId));
        pageTokens.push(...buildPathTokens(competition || { _id: competitionId }, ['name', 'title']));
    } else if (festId) {
        pageTokens.push(...buildPathTokens(fest || { _id: festId }, ['festName', 'title']));
        (competitions || []).forEach((c) => {
            pageTokens.push(...buildPathTokens(c, ['name', 'title']));
        });
    }

    const uniqueTokens = [...new Set(pageTokens)];
    if (uniqueTokens.length) {
        const pathPatterns = uniqueTokens.map((token) => escapeRegex(token));
        const joined = pathPatterns.join('|');
        if (competitionId) {
            clauses.push({
                page: {
                    $regex: `/(competitions-view-details|competition-registration|fest/[^/]+/register)/(${joined})(?:/|$|\\?)`,
                    $options: 'i',
                },
            });
            clauses.push({
                page: {
                    $regex: `/fest/[^/]+/register.*[?&]competition=(${joined})(?:&|$)`,
                    $options: 'i',
                },
            });
        } else if (festId) {
            clauses.push({
                page: {
                    $regex: `/(view-details|fest)/(${joined})(?:/|$|\\?)`,
                    $options: 'i',
                },
            });
            clauses.push({
                page: {
                    $regex: `/(competitions-view-details|competition-registration|fest/[^/]+/register)/(${joined})(?:/|$|\\?)`,
                    $options: 'i',
                },
            });
        }
    }

    if (pageFilter) {
        clauses.push({ page: new RegExp(escapeRegex(pageFilter), 'i') });
    }

    if (!clauses.length) {
        return { ...match, _id: null }; // force empty when no scope
    }

    return {
        ...match,
        $or: clauses,
    };
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

/**
 * GET /admin/user-activity/scoped
 * Fest → competition → page visitor activity + registration/check-in roster.
 * Query: festId (required unless page=), competitionId?, page?, range, loggedInOnly?
 */
const getScopedActivity = async (req, res) => {
    try {
        const { match, range } = resolveRange(req);
        const festId = String(req.query.festId || '').trim();
        const competitionId = String(req.query.competitionId || '').trim();
        const pageFilter = String(req.query.page || '').trim();
        const loggedInOnly = req.query.loggedInOnly === 'true';
        const visitorPage = Math.max(parseInt(req.query.visitorPage, 10) || 1, 1);
        const visitorLimit = Math.min(parseInt(req.query.visitorLimit, 10) || 50, 200);
        const visitorSkip = (visitorPage - 1) * visitorLimit;

        if (!festId && !competitionId && !pageFilter) {
            return res.status(400).json({
                success: false,
                message: 'Provide festId, competitionId, or page',
            });
        }

        let fest = null;
        let competitions = [];
        let resolvedFestId = festId;
        let resolvedCompetitionId = competitionId;

        if (competitionId && isObjectId(competitionId)) {
            const competition = await Competition.findById(competitionId)
                .select('name slug fest previousSlugs')
                .lean();
            if (competition) {
                resolvedCompetitionId = String(competition._id);
                if (!resolvedFestId) resolvedFestId = String(competition.fest);
                competitions = [competition];
            }
        }

        if (resolvedFestId && isObjectId(resolvedFestId)) {
            fest = await FestOrganizer.findById(resolvedFestId)
                .select('festName slug collegeName previousSlugs')
                .lean();
            if (!fest) {
                return res.status(404).json({ success: false, message: 'Fest not found' });
            }
            if (!competitions.length || !resolvedCompetitionId) {
                competitions = await Competition.find({ fest: resolvedFestId })
                    .select('name slug fest previousSlugs')
                    .sort({ name: 1 })
                    .lean();
            } else if (competitions.length === 1) {
                // keep the single competition already loaded
            }
        }

        const activityMatch = buildScopedActivityMatch({
            match,
            festId: resolvedFestId,
            competitionId: resolvedCompetitionId,
            pageFilter,
            fest,
            competitions: resolvedCompetitionId
                ? competitions.filter((c) => String(c._id) === String(resolvedCompetitionId))
                : competitions,
        });

        if (loggedInOnly) {
            activityMatch.email = { $nin: [null, ''] };
        }

        const visitorIdentity = {
            $cond: [
                { $and: [{ $ne: ['$email', null] }, { $ne: ['$email', ''] }] },
                '$email',
                {
                    $cond: [
                        { $and: [{ $ne: ['$sessionId', null] }, { $ne: ['$sessionId', ''] }] },
                        { $concat: ['session:', '$sessionId'] },
                        { $concat: ['anon:', { $toString: '$_id' }] },
                    ],
                },
            ],
        };

        const [
            totalEvents,
            pageViewCount,
            festViewCount,
            competitionViewCount,
            uniqueVisitorAgg,
            topPages,
            competitionBreakdown,
            visitorsAgg,
            visitorsTotalAgg,
        ] = await Promise.all([
            UserActivityLog.countDocuments(activityMatch),
            UserActivityLog.countDocuments({
                ...activityMatch,
                eventType: 'page_view',
                durationSeconds: 0,
            }),
            UserActivityLog.countDocuments({ ...activityMatch, eventType: 'fest_view' }),
            UserActivityLog.countDocuments({ ...activityMatch, eventType: 'competition_view' }),
            UserActivityLog.aggregate([
                { $match: activityMatch },
                { $group: { _id: visitorIdentity } },
                { $count: 'count' },
            ]),
            UserActivityLog.aggregate([
                { $match: { ...activityMatch, page: { $nin: ['', null] } } },
                {
                    $group: {
                        _id: '$page',
                        views: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$eventType', 'page_view'] },
                                            { $eq: ['$durationSeconds', 0] },
                                        ],
                                    },
                                    1,
                                    1,
                                ],
                            },
                        },
                        uniqueVisitors: { $addToSet: visitorIdentity },
                        lastVisitedAt: { $max: '$createdAt' },
                    },
                },
                {
                    $project: {
                        page: '$_id',
                        views: 1,
                        uniqueVisitors: { $size: '$uniqueVisitors' },
                        lastVisitedAt: 1,
                        _id: 0,
                    },
                },
                { $sort: { views: -1 } },
                { $limit: 40 },
            ]),
            resolvedFestId && !resolvedCompetitionId
                ? UserActivityLog.aggregate([
                    {
                        $match: {
                            ...activityMatch,
                            'metadata.competitionId': { $nin: [null, ''] },
                        },
                    },
                    {
                        $group: {
                            _id: '$metadata.competitionId',
                            views: { $sum: 1 },
                            uniqueVisitors: { $addToSet: visitorIdentity },
                            lastVisitedAt: { $max: '$createdAt' },
                        },
                    },
                    {
                        $project: {
                            competitionId: { $toString: '$_id' },
                            views: 1,
                            uniqueVisitors: { $size: '$uniqueVisitors' },
                            lastVisitedAt: 1,
                            _id: 0,
                        },
                    },
                    { $sort: { views: -1 } },
                    { $limit: 100 },
                ])
                : Promise.resolve([]),
            UserActivityLog.aggregate([
                { $match: activityMatch },
                {
                    $group: {
                        _id: visitorIdentity,
                        email: { $max: '$email' },
                        userId: { $max: '$userId' },
                        visits: { $sum: 1 },
                        pageViews: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$eventType', 'page_view'] },
                                            { $eq: ['$durationSeconds', 0] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        festViews: {
                            $sum: { $cond: [{ $eq: ['$eventType', 'fest_view'] }, 1, 0] },
                        },
                        competitionViews: {
                            $sum: { $cond: [{ $eq: ['$eventType', 'competition_view'] }, 1, 0] },
                        },
                        lastVisitedAt: { $max: '$createdAt' },
                        firstVisitedAt: { $min: '$createdAt' },
                        lastPage: { $last: '$page' },
                        devices: { $addToSet: '$device' },
                    },
                },
                { $sort: { lastVisitedAt: -1 } },
                { $skip: visitorSkip },
                { $limit: visitorLimit },
            ]),
            UserActivityLog.aggregate([
                { $match: activityMatch },
                { $group: { _id: visitorIdentity } },
                { $count: 'count' },
            ]),
        ]);

        const competitionNameById = Object.fromEntries(
            (competitions || []).map((c) => [String(c._id), c.name || 'Competition']),
        );

        // Registration / check-in roster for "who came"
        let registrations = [];
        let registrationStats = {
            total: 0,
            approved: 0,
            checkedIn: 0,
            pendingCheckIn: 0,
        };

        if (resolvedFestId && isObjectId(resolvedFestId)) {
            const regFilter = { fest: resolvedFestId };
            if (resolvedCompetitionId && isObjectId(resolvedCompetitionId)) {
                regFilter.competitionId = resolvedCompetitionId;
            }

            const [regRows, regCounts] = await Promise.all([
                Registration.find(regFilter)
                    .populate('user', 'name email phoneNumber phone')
                    .select('status paymentStatus checkedIn checkedInAt competitionId createdAt user responses')
                    .sort({ checkedInAt: -1, createdAt: -1 })
                    .limit(300)
                    .lean(),
                Registration.aggregate([
                    { $match: regFilter },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            approved: {
                                $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                            },
                            checkedIn: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $eq: ['$status', 'approved'] },
                                                { $eq: ['$checkedIn', true] },
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ]),
            ]);

            const counts = regCounts[0] || { total: 0, approved: 0, checkedIn: 0 };
            registrationStats = {
                total: counts.total || 0,
                approved: counts.approved || 0,
                checkedIn: counts.checkedIn || 0,
                pendingCheckIn: Math.max(0, (counts.approved || 0) - (counts.checkedIn || 0)),
            };

            registrations = regRows.map((r) => ({
                id: String(r._id),
                status: r.status,
                paymentStatus: r.paymentStatus,
                checkedIn: Boolean(r.checkedIn),
                checkedInAt: r.checkedInAt || null,
                registeredAt: r.createdAt,
                competitionId: r.competitionId ? String(r.competitionId) : null,
                competitionName: r.competitionId
                    ? (competitionNameById[String(r.competitionId)] || null)
                    : null,
                user: r.user
                    ? {
                        id: String(r.user._id),
                        name: r.user.name || '',
                        email: r.user.email || '',
                        phone: r.user.phoneNumber || r.user.phone || '',
                    }
                    : null,
            }));
        }

        const visitorTotal = visitorsTotalAgg[0]?.count || uniqueVisitorAgg[0]?.count || 0;

        // Enrich visitor emails with names from User collection
        const visitorEmails = visitorsAgg
            .map((v) => normalizeEmail(v.email))
            .filter(Boolean);
        const usersByEmail = {};
        if (visitorEmails.length) {
            const users = await User.find({ email: { $in: visitorEmails } })
                .select('name email')
                .lean();
            users.forEach((u) => {
                usersByEmail[normalizeEmail(u.email)] = u.name || '';
            });
        }

        res.json({
            success: true,
            range,
            scope: {
                festId: resolvedFestId || null,
                festName: fest?.festName || null,
                collegeName: fest?.collegeName || null,
                competitionId: resolvedCompetitionId || null,
                competitionName: resolvedCompetitionId
                    ? (competitionNameById[resolvedCompetitionId] || null)
                    : null,
                page: pageFilter || null,
            },
            competitions: competitions.map((c) => ({
                id: String(c._id),
                name: c.name,
            })),
            stats: {
                totalEvents,
                pageViews: pageViewCount,
                festViews: festViewCount,
                competitionViews: competitionViewCount,
                uniqueVisitors: uniqueVisitorAgg[0]?.count || 0,
            },
            registrationStats,
            topPages,
            competitionBreakdown: (competitionBreakdown || []).map((row) => ({
                ...row,
                competitionName: competitionNameById[String(row.competitionId)] || null,
            })),
            visitors: visitorsAgg.map((v) => {
                const email = normalizeEmail(v.email);
                return {
                    key: v._id,
                    email: email || null,
                    name: email ? (usersByEmail[email] || '') : '',
                    userId: v.userId ? String(v.userId) : null,
                    isGuest: !email,
                    visits: v.visits,
                    pageViews: v.pageViews,
                    festViews: v.festViews,
                    competitionViews: v.competitionViews,
                    firstVisitedAt: v.firstVisitedAt,
                    lastVisitedAt: v.lastVisitedAt,
                    lastPage: v.lastPage || '',
                    devices: (v.devices || []).filter(Boolean),
                };
            }),
            visitorPagination: {
                page: visitorPage,
                limit: visitorLimit,
                total: visitorTotal,
                totalPages: Math.ceil(visitorTotal / visitorLimit) || 1,
            },
            registrations,
        });
    } catch (error) {
        console.error('Admin user-activity scoped error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch scoped activity' });
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
    getScopedActivity,
    runBackfill,
};
