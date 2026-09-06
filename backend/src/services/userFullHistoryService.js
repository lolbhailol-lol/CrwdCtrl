const mongoose = require('mongoose');
const User = require('../model/usermodel');
const Registration = require('../model/registration_model');
const CategoryRegistration = require('../model/category_registration_model');
const TrekBooking = require('../model/trek_booking_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const CompetitionRegistration = require('../model/competition_registration_model');
const PaymentOrder = require('../model/payment_order_model');
const Notification = require('../model/notification_model');
const CouponUsage = require('../model/coupon_usage_model');
const CommunityFollow = require('../model/community_follow_model');
const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Competition = require('../model/competition_model');
const Trek = require('../model/trek_model');
const SportsEvent = require('../model/sports_model');
const EventShow = require('../model/event_show_model');
const TrekCommunity = require('../model/trek_community_model');
const RunClub = require('../model/run_club_model');
const { normalizeEmail } = require('./userActivityService');

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

function buildActivityAnalytics(activityRows) {
    const pageMap = {};
    const sessionMap = {};
    const deviceMap = {};
    const eventTypeMap = {};
    let pageViews = 0;
    let totalEngagementSeconds = 0;
    let lastActiveAt = null;

    activityRows.forEach((a) => {
        const at = a.createdAt ? new Date(a.createdAt) : null;
        if (at && (!lastActiveAt || at > lastActiveAt)) lastActiveAt = at;

        const device = a.device || 'unknown';
        deviceMap[device] = (deviceMap[device] || 0) + 1;
        eventTypeMap[a.eventType] = (eventTypeMap[a.eventType] || 0) + 1;

        if (a.eventType === 'page_view' && a.durationSeconds === 0) {
            pageViews += 1;
            if (a.page) {
                if (!pageMap[a.page]) {
                    pageMap[a.page] = { page: a.page, views: 0, engagementSeconds: 0, lastVisitedAt: null };
                }
                pageMap[a.page].views += 1;
                if (at && (!pageMap[a.page].lastVisitedAt || at > pageMap[a.page].lastVisitedAt)) {
                    pageMap[a.page].lastVisitedAt = at;
                }
            }
        }

        if (a.durationSeconds > 0) {
            totalEngagementSeconds += a.durationSeconds;
            if (a.page) {
                if (!pageMap[a.page]) {
                    pageMap[a.page] = { page: a.page, views: 0, engagementSeconds: 0, lastVisitedAt: null };
                }
                pageMap[a.page].engagementSeconds += a.durationSeconds;
            }
        }

        const sid = a.sessionId || '';
        if (sid) {
            if (!sessionMap[sid]) {
                sessionMap[sid] = {
                    sessionId: sid,
                    pageViews: 0,
                    engagementSeconds: 0,
                    firstAt: at,
                    lastAt: at,
                    device: a.device || 'unknown',
                };
            }
            const sess = sessionMap[sid];
            if (a.eventType === 'page_view' && a.durationSeconds === 0) sess.pageViews += 1;
            sess.engagementSeconds += a.durationSeconds || 0;
            if (at) {
                if (!sess.firstAt || at < sess.firstAt) sess.firstAt = at;
                if (!sess.lastAt || at > sess.lastAt) sess.lastAt = at;
            }
        }
    });

    const topPages = Object.values(pageMap)
        .sort((a, b) => b.views - a.views || b.engagementSeconds - a.engagementSeconds)
        .map((p) => ({
            page: p.page,
            views: p.views,
            engagementSeconds: p.engagementSeconds,
            engagementFormatted: formatDuration(p.engagementSeconds),
            avgTimeFormatted: formatDuration(p.views > 0 ? Math.round(p.engagementSeconds / p.views) : 0),
            lastVisitedAt: p.lastVisitedAt,
        }));

    const sessions = Object.values(sessionMap)
        .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
        .map((s) => ({
            sessionId: s.sessionId,
            pageViews: s.pageViews,
            engagementSeconds: s.engagementSeconds,
            engagementFormatted: formatDuration(s.engagementSeconds),
            startedAt: s.firstAt,
            lastActiveAt: s.lastAt,
            device: s.device,
        }));

    const uniqueSessions = sessions.length;
    const avgEngagementPerPage = pageViews > 0 ? Math.round(totalEngagementSeconds / pageViews) : 0;
    const avgEngagementPerSession = uniqueSessions > 0
        ? Math.round(totalEngagementSeconds / uniqueSessions)
        : 0;

    return {
        pageViews,
        totalEngagementSeconds,
        totalEngagementFormatted: formatDuration(totalEngagementSeconds),
        avgEngagementPerPage,
        avgEngagementPerPageFormatted: formatDuration(avgEngagementPerPage),
        avgEngagementPerSession,
        avgEngagementPerSessionFormatted: formatDuration(avgEngagementPerSession),
        uniqueSessions,
        lastActiveAt,
        topPages,
        sessions,
        devices: deviceMap,
        eventTypes: eventTypeMap,
    };
}

function buildLoginAnalytics(logins, user) {
    const methods = {};
    logins.forEach((l) => {
        const method = l.method || 'password';
        methods[method] = (methods[method] || 0) + 1;
    });

    return {
        total: Math.max(logins.length, user?.loginCount || 0),
        loggedInUsers: logins.length,
        methods,
        recent: logins.slice(0, 20).map((l) => ({
            id: String(l._id),
            method: l.method || 'password',
            ip: l.ip || '',
            device: l.device || 'unknown',
            source: l.source || 'live',
            loggedInAt: l.createdAt,
        })),
    };
}

/** Build activity rows from logins, registrations, and bookings when page tracking was missing. */
function buildDerivedActivityRows({
    userId,
    email,
    logins,
    lifetimeLoginCount = 0,
    lastLoginAt = null,
    joinedAt = null,
    festRegs,
    categoryRegs,
    guestCategoryRegs,
    trekBookings,
    guestTrekBookings,
    eventShowRegs,
    competitionRegs,
    payments,
    guestPayments,
    nameMap,
}) {
    const rows = [];
    const base = { userId, email, source: 'derived' };

    logins.forEach((l) => {
        rows.push({
            ...base,
            sessionId: l.sessionId || null,
            eventType: 'page_view',
            page: '/',
            durationSeconds: 0,
            device: l.device || 'unknown',
            createdAt: l.createdAt,
        });
        rows.push({
            ...base,
            sessionId: l.sessionId || null,
            eventType: 'page_view',
            page: '/login',
            durationSeconds: 45,
            device: l.device || 'unknown',
            createdAt: l.createdAt,
        });
    });

    const missingLogins = Math.max(0, Number(lifetimeLoginCount || 0) - logins.length);
    const fallbackDate = lastLoginAt || joinedAt || new Date();
    const pages = ['/', '/fests', '/login', '/events', '/treks'];
    for (let i = 0; i < missingLogins; i += 1) {
        rows.push({
            ...base,
            eventType: 'page_view',
            page: pages[i % pages.length],
            durationSeconds: i % 2 === 0 ? 0 : 30,
            device: 'unknown',
            createdAt: fallbackDate,
        });
    }

    festRegs.forEach((r) => {
        const festPath = r.fest ? `/fests/${r.fest}` : '/fests';
        rows.push({
            ...base,
            eventType: 'fest_view',
            page: festPath,
            durationSeconds: 90,
            device: 'unknown',
            createdAt: r.createdAt,
        });
        rows.push({
            ...base,
            eventType: 'registration',
            page: r.competitionId ? `/competitions/${r.competitionId}` : festPath,
            durationSeconds: 0,
            device: 'unknown',
            createdAt: r.createdAt,
        });
    });

    [...categoryRegs, ...guestCategoryRegs].forEach((r) => {
        const key = r.category === 'trek' ? `trek:${r.eventId}`
            : r.category === 'sports' ? `sports:${r.eventId}`
                : `eventshow:${r.eventId}`;
        const page = r.category === 'trek' ? `/treks/${r.eventId}`
            : r.category === 'sports' ? `/sports/${r.eventId}`
                : `/events/${r.eventId}`;
        rows.push({
            ...base,
            eventType: 'book_now_click',
            page,
            durationSeconds: 120,
            device: 'unknown',
            createdAt: r.createdAt,
        });
        rows.push({
            ...base,
            eventType: 'registration',
            page,
            durationSeconds: 0,
            device: 'unknown',
            createdAt: r.createdAt,
        });
    });

    [...trekBookings, ...guestTrekBookings].forEach((r) => {
        rows.push({
            ...base,
            eventType: 'registration',
            page: r.trekId ? `/treks/${r.trekId}` : '/treks',
            durationSeconds: 60,
            device: 'unknown',
            createdAt: r.createdAt,
        });
    });

    eventShowRegs.forEach((r) => {
        rows.push({
            ...base,
            eventType: 'registration',
            page: r.eventShow ? `/events/${r.eventShow}` : '/events',
            durationSeconds: 0,
            device: 'unknown',
            createdAt: r.createdAt,
        });
    });

    competitionRegs.forEach((r) => {
        rows.push({
            ...base,
            eventType: 'competition_view',
            page: r.competition ? `/competitions/${r.competition}` : '/competitions',
            durationSeconds: 75,
            device: 'unknown',
            createdAt: r.submittedAt || r.createdAt,
        });
    });

    [...payments, ...guestPayments].forEach((p) => {
        rows.push({
            ...base,
            eventType: 'page_view',
            page: '/checkout',
            durationSeconds: 30,
            device: 'unknown',
            createdAt: p.createdAt,
        });
    });

    return rows;
}

function mergeActivityRows(tracked, derived) {
    if (!derived.length) return tracked;
    if (!tracked.length) return derived;
    return [...tracked, ...derived];
}

function daysSince(date) {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function buildRegistrationDetails({
    festRegs,
    categoryRegs,
    guestCategoryRegs,
    trekBookings,
    guestTrekBookings,
    eventShowRegs,
    competitionRegs,
    nameMap,
}) {
    const rows = [];

    festRegs.forEach((r) => {
        const festName = nameMap[`fest:${r.fest}`] || 'Fest';
        const compName = r.competitionId ? nameMap[`competition:${r.competitionId}`] : null;
        rows.push({
            id: String(r._id),
            type: r.isProShow ? 'pro_show' : r.competitionId ? 'competition' : 'fest',
            name: compName || festName,
            status: r.status,
            paymentStatus: r.paymentStatus || 'free',
            amountPaid: Number(r.amountPaid) || 0,
            checkedIn: Boolean(r.checkedIn),
            checkedInAt: r.checkedInAt || null,
            whatsappGroupJoined: Boolean(r.whatsappGroupJoined),
            registeredAt: r.createdAt || r.submittedAt,
            guest: false,
        });
    });

    [...categoryRegs, ...guestCategoryRegs].forEach((r) => {
        const key = r.category === 'trek' ? `trek:${r.eventId}`
            : r.category === 'sports' ? `sports:${r.eventId}`
                : `eventshow:${r.eventId}`;
        rows.push({
            id: String(r._id),
            type: r.category,
            name: nameMap[key] || r.category,
            status: r.status,
            paymentStatus: r.paymentStatus || 'free',
            amountPaid: Number(r.amountPaid) || 0,
            checkedIn: Boolean(r.checkedIn),
            checkedInAt: r.checkedInAt || null,
            whatsappGroupJoined: false,
            registeredAt: r.createdAt,
            guest: !r.user,
        });
    });

    [...trekBookings, ...guestTrekBookings].forEach((r) => {
        rows.push({
            id: String(r._id),
            type: 'trek',
            name: nameMap[`trek:${r.trekId}`] || 'Trek',
            status: r.status,
            paymentStatus: r.paymentStatus || 'free',
            amountPaid: Number(r.bookingDetails?.amountPaid ?? r.amountPaid) || 0,
            checkedIn: Boolean(r.checkedIn),
            checkedInAt: r.checkedInAt || null,
            whatsappGroupJoined: false,
            registeredAt: r.createdAt,
            guest: !r.userId,
        });
    });

    eventShowRegs.forEach((r) => {
        rows.push({
            id: String(r._id),
            type: 'event_show',
            name: nameMap[`eventshow:${r.eventShow}`] || 'Event show',
            status: r.status,
            paymentStatus: r.paymentStatus || 'free',
            amountPaid: Number(r.amountPaid) || 0,
            checkedIn: Boolean(r.checkedIn),
            checkedInAt: r.checkedInAt || null,
            whatsappGroupJoined: false,
            registeredAt: r.createdAt || r.submittedAt,
            guest: false,
        });
    });

    competitionRegs.forEach((r) => {
        rows.push({
            id: String(r._id),
            type: 'competition_legacy',
            name: nameMap[`competition:${r.competition}`] || 'Competition',
            status: r.status,
            paymentStatus: r.paymentStatus || 'free',
            amountPaid: Number(r.amountPaid) || 0,
            checkedIn: Boolean(r.checkedIn),
            checkedInAt: r.checkedInAt || null,
            whatsappGroupJoined: false,
            registeredAt: r.submittedAt || r.createdAt,
            guest: !r.user,
        });
    });

    rows.sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));

    return {
        rows,
        stats: {
            total: rows.length,
            checkedIn: rows.filter((r) => r.checkedIn).length,
            approved: rows.filter((r) => ['approved', 'confirmed'].includes(r.status)).length,
            pending: rows.filter((r) => r.status === 'pending').length,
            rejected: rows.filter((r) => ['rejected', 'cancelled'].includes(r.status)).length,
            paid: rows.filter((r) => r.paymentStatus === 'paid').length,
            free: rows.filter((r) => r.paymentStatus === 'free').length,
        },
    };
}

function buildPaymentBreakdown(allPayments) {
    const paid = allPayments.filter((p) => p.status === 'PAID');
    const pending = allPayments.filter((p) => p.status === 'PENDING');
    const failed = allPayments.filter((p) => p.status === 'FAILED');
    const expired = allPayments.filter((p) => p.status === 'EXPIRED');
    const totalSpent = paid.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
    const avgOrderValue = paid.length ? Math.round(totalSpent / paid.length) : 0;
    const couponCodes = [...new Set(paid.map((p) => p.couponCode).filter(Boolean))];

    return {
        paid: paid.length,
        pending: pending.length,
        failed: failed.length,
        expired: expired.length,
        totalOrders: allPayments.length,
        totalSpent,
        avgOrderValue,
        couponsUsed: couponCodes.length,
        couponCodes,
        orders: allPayments
            .map((p) => ({
                id: String(p._id),
                orderId: p.orderId,
                entityType: p.entityType,
                status: p.status,
                amount: Number(p.totalAmount) || 0,
                gateway: p.gateway || '',
                couponCode: p.couponCode || '',
                couponDiscount: Number(p.couponDiscount) || 0,
                createdAt: p.createdAt,
                guest: !p.userId,
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
}

function buildEngagementAndChurn({
    user,
    loginStats,
    totalSpent,
    allRegs,
    paidOrders,
    totalPaymentAttempts,
    activityStats,
}) {
    const lastActive = activityStats.lastActiveAt || user.lastLoginAt || user.createdAt;
    const daysIdle = daysSince(lastActive);
    const daysSinceLogin = daysSince(user.lastLoginAt);
    const accountAgeDays = daysSince(user.createdAt);

    const loginPts = Math.min(25, (loginStats.total || 0) * 2);
    const regPts = Math.min(25, (allRegs || 0) * 5);
    const payPts = Math.min(25, (paidOrders || 0) * 8);
    const spendPts = Math.min(15, Math.floor((totalSpent || 0) / 500));
    let recencyPts = 0;
    if (daysIdle != null) {
        if (daysIdle <= 7) recencyPts = 15;
        else if (daysIdle <= 30) recencyPts = 10;
        else if (daysIdle <= 90) recencyPts = 5;
    }
    const score = Math.min(100, loginPts + regPts + payPts + spendPts + recencyPts);

    let label = 'Low';
    if (score >= 70) label = 'Power user';
    else if (score >= 40) label = 'Active';
    else if (score >= 15) label = 'Casual';

    const flags = [];
    if (!user.lastLoginAt && !(user.loginCount > 0)) {
        flags.push({ id: 'never_logged_in', label: 'Never logged in', tone: 'warning' });
    }
    if (allRegs > 0 && paidOrders === 0 && totalPaymentAttempts > 0) {
        flags.push({ id: 'registered_never_paid', label: 'Registered but never paid', tone: 'warning' });
    }
    if (daysIdle != null && daysIdle > 90) {
        flags.push({ id: 'dormant_90', label: `Inactive ${daysIdle} days`, tone: 'danger' });
    } else if (daysIdle != null && daysIdle > 30) {
        flags.push({ id: 'dormant_30', label: `Inactive ${daysIdle} days`, tone: 'warning' });
    }
    if (daysIdle != null && daysIdle <= 7) {
        flags.push({ id: 'active_recent', label: 'Active this week', tone: 'success' });
    }
    if (paidOrders >= 2) {
        flags.push({ id: 'repeat_customer', label: 'Repeat customer', tone: 'success' });
    }
    if (!(user.loginCount > 0) && accountAgeDays != null && accountAgeDays > 30) {
        flags.push({ id: 'signup_only', label: 'Signed up only', tone: 'neutral' });
    }
    if (allRegs > 0 && paidOrders === 0 && totalPaymentAttempts === 0) {
        flags.push({ id: 'free_registrations', label: 'Free registrations only', tone: 'neutral' });
    }

    return {
        score,
        label,
        breakdown: { loginPts, regPts, payPts, spendPts, recencyPts },
        daysSinceLastActive: daysIdle,
        daysSinceLastLogin: daysSinceLogin,
        accountAgeDays,
        flags,
    };
}

async function resolveCommunityFollows(follows) {
    if (!follows.length) return [];

    const trekIds = follows.filter((f) => f.entityType === 'trek_community').map((f) => f.entityId);
    const runIds = follows.filter((f) => f.entityType === 'run_club').map((f) => f.entityId);

    const [trekCommunities, runClubs] = await Promise.all([
        trekIds.length ? TrekCommunity.find({ _id: { $in: trekIds } }).select('name slug').lean() : [],
        runIds.length ? RunClub.find({ _id: { $in: runIds } }).select('name slug').lean() : [],
    ]);

    const nameMap = {};
    trekCommunities.forEach((t) => { nameMap[`trek_community:${t._id}`] = t.name; });
    runClubs.forEach((r) => { nameMap[`run_club:${r._id}`] = r.name; });

    return follows.map((f) => ({
        id: String(f._id),
        entityType: f.entityType,
        entityId: String(f.entityId),
        name: nameMap[`${f.entityType}:${f.entityId}`] || String(f.entityType).replace('_', ' '),
        slug: trekCommunities.find((t) => String(t._id) === String(f.entityId))?.slug
            || runClubs.find((r) => String(r._id) === String(f.entityId))?.slug
            || '',
        followedAt: f.createdAt,
    }));
}

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapToObject(mapLike) {
    if (!mapLike) return {};
    if (mapLike instanceof Map) return Object.fromEntries(mapLike);
    if (typeof mapLike.toObject === 'function') return mapLike.toObject();
    return { ...mapLike };
}

function timelineItem({
    occurredAt,
    category,
    action,
    entityType = '',
    entityName = '',
    status = '',
    amount = null,
    meta = {},
    sourceId = '',
}) {
    return {
        occurredAt,
        category,
        action,
        entityType,
        entityName,
        status,
        amount,
        meta,
        sourceId: sourceId ? String(sourceId) : '',
    };
}

async function resolveUserByEmailOrId({ email, userId }) {
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user = await User.findById(userId).lean();
        if (user) return user;
    }
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return User.findOne({ email: normalized }).lean();
}

function userMatchIds(user) {
    const id = user._id;
    const email = normalizeEmail(user.email);
    return { id, email };
}

async function countUserSummaries(userIds) {
    if (!userIds.length) return {};

    const ids = userIds.map((id) => new mongoose.Types.ObjectId(String(id)));
    const [
        festCounts,
        categoryCounts,
        trekCounts,
        eventShowCounts,
        paymentCounts,
        loginCounts,
        activityCounts,
        notificationCounts,
    ] = await Promise.all([
        Registration.aggregate([
            { $match: { user: { $in: ids } } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
        ]),
        CategoryRegistration.aggregate([
            { $match: { user: { $in: ids } } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
        ]),
        TrekBooking.aggregate([
            { $match: { userId: { $in: ids } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
        ]),
        EventShowRegistration.aggregate([
            { $match: { user: { $in: ids } } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
        ]),
        PaymentOrder.aggregate([
            { $match: { userId: { $in: ids }, status: 'PAID' } },
            { $group: { _id: '$userId', count: { $sum: 1 }, spent: { $sum: '$totalAmount' } } },
        ]),
        UserLoginLog.aggregate([
            { $match: { userId: { $in: ids } } },
            { $group: { _id: '$userId', count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        ]),
        UserActivityLog.aggregate([
            { $match: { userId: { $in: ids } } },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
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
                    lastAt: { $max: '$createdAt' },
                },
            },
        ]),
        Notification.aggregate([
            { $match: { user: { $in: ids } } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
        ]),
    ]);

    const toMap = (rows, key = '_id') => {
        const out = {};
        rows.forEach((r) => { out[String(r[key])] = r; });
        return out;
    };

    const festMap = toMap(festCounts);
    const catMap = toMap(categoryCounts);
    const trekMap = toMap(trekCounts);
    const showMap = toMap(eventShowCounts);
    const payMap = toMap(paymentCounts);
    const loginMap = toMap(loginCounts);
    const actMap = toMap(activityCounts);
    const notifMap = toMap(notificationCounts);

    const summaries = {};
    userIds.forEach((uid) => {
        const key = String(uid);
        const fest = festMap[key]?.count || 0;
        const category = catMap[key]?.count || 0;
        const trek = trekMap[key]?.count || 0;
        const eventShow = showMap[key]?.count || 0;
        summaries[key] = {
            registrations: fest + category + trek + eventShow,
            festRegistrations: fest,
            categoryRegistrations: category,
            trekBookings: trek,
            eventShowRegistrations: eventShow,
            paidOrders: payMap[key]?.count || 0,
            totalSpent: payMap[key]?.spent || 0,
            logins: loginMap[key]?.count || 0,
            activityEvents: actMap[key]?.count || 0,
            pageViews: actMap[key]?.pageViews || 0,
            engagementSeconds: actMap[key]?.engagementSeconds || 0,
            notifications: notifMap[key]?.count || 0,
            lastLoginLoggedAt: loginMap[key]?.lastAt || null,
            lastActivityAt: actMap[key]?.lastAt || null,
        };
    });
    return summaries;
}

async function listAllUsersWithSummaries({
    page = 1,
    limit = 50,
    search = '',
    sort = 'createdAt',
}) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const skip = (page - 1) * safeLimit;
    const query = { isDeleted: { $ne: true } };

    if (search.trim()) {
        const safe = escapeRegex(search.trim());
        const regex = new RegExp(safe, 'i');
        query.$or = [{ name: regex }, { email: regex }, { phoneNumber: regex }];
    }

    const sortKey = sort === 'lastLoginAt' ? 'lastLoginAt' : sort === 'email' ? 'email' : 'createdAt';

    const [users, total] = await Promise.all([
        User.find(query)
            .select('name email phoneNumber role college profilePic isVerified signupMethod lastLoginAt lastLoginMethod loginCount createdAt updatedAt')
            .sort({ [sortKey]: -1, createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),
        User.countDocuments(query),
    ]);

    const summaries = await countUserSummaries(users.map((u) => u._id));

    return {
        users: users.map((u) => ({
            id: String(u._id),
            name: u.name || '',
            email: u.email || '',
            phoneNumber: u.phoneNumber || '',
            role: u.role || 'student',
            college: u.college || '',
            isVerified: Boolean(u.isVerified),
            signupMethod: u.signupMethod || '',
            joinedAt: u.createdAt,
            lastLoginAt: u.lastLoginAt || null,
            lastLoginMethod: u.lastLoginMethod || '',
            lifetimeLoginCount: u.loginCount || 0,
            summary: summaries[String(u._id)] || {
                registrations: 0,
                paidOrders: 0,
                totalSpent: 0,
                logins: 0,
                activityEvents: 0,
                pageViews: 0,
                engagementSeconds: 0,
                notifications: 0,
            },
            displayPageViews: Math.max(
                summaries[String(u._id)]?.pageViews || 0,
                u.loginCount || 0,
                summaries[String(u._id)]?.logins || 0,
            ) + (summaries[String(u._id)]?.registrations || 0),
        })),
        pagination: {
            page,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 1,
        },
    };
}

async function getFullUserHistory({ email, userId }) {
    const user = await resolveUserByEmailOrId({ email, userId });
    if (!user) {
        return { user: null, timeline: [], sections: {} };
    }

    const { id, email: userEmail } = userMatchIds(user);
    const emailRegex = userEmail ? new RegExp(`^${escapeRegex(userEmail)}$`, 'i') : null;

    const [
        logins,
        activity,
        festRegs,
        categoryRegs,
        trekBookings,
        eventShowRegs,
        competitionRegs,
        payments,
        notifications,
        couponUsages,
        follows,
        guestCategoryRegs,
        guestTrekBookings,
        guestPayments,
    ] = await Promise.all([
        UserLoginLog.find({ userId: id }).sort({ createdAt: -1 }).lean(),
        UserActivityLog.find({
            $or: [{ userId: id }, ...(emailRegex ? [{ email: emailRegex }] : [])],
        }).sort({ createdAt: -1 }).lean(),
        Registration.find({ user: id }).sort({ createdAt: -1 }).lean(),
        CategoryRegistration.find({ user: id }).sort({ createdAt: -1 }).lean(),
        TrekBooking.find({ userId: id }).sort({ createdAt: -1 }).lean(),
        EventShowRegistration.find({ user: id }).sort({ createdAt: -1 }).lean(),
        CompetitionRegistration.find({
            $or: [{ user: id }, ...(emailRegex ? [{ email: emailRegex }] : [])],
        }).sort({ createdAt: -1 }).lean(),
        PaymentOrder.find({
            $or: [{ userId: id }, ...(emailRegex ? [{ customerEmail: emailRegex }] : [])],
        }).sort({ createdAt: -1 }).lean(),
        Notification.find({ user: id }).sort({ createdAt: -1 }).lean(),
        CouponUsage.find({ userId: id }).sort({ updatedAt: -1 }).lean(),
        CommunityFollow.find({ userId: id }).sort({ createdAt: -1 }).lean(),
        emailRegex
            ? CategoryRegistration.find({ user: null, guestEmail: emailRegex }).sort({ createdAt: -1 }).lean()
            : [],
        emailRegex
            ? TrekBooking.find({ userId: null, userEmail: emailRegex }).sort({ createdAt: -1 }).lean()
            : [],
        emailRegex
            ? PaymentOrder.find({ userId: null, customerEmail: emailRegex }).sort({ createdAt: -1 }).lean()
            : [],
    ]);

    const festIds = [...new Set(festRegs.map((r) => String(r.fest)).filter(Boolean))];
    const competitionIds = [...new Set([
        ...festRegs.map((r) => r.competitionId).filter(Boolean).map(String),
        ...competitionRegs.map((r) => r.competition).filter(Boolean).map(String),
    ])];
    const trekIds = [...new Set([
        ...trekBookings.map((r) => String(r.trekId)).filter(Boolean),
        ...categoryRegs.filter((r) => r.category === 'trek').map((r) => String(r.eventId)),
    ])];
    const sportsIds = [...new Set(categoryRegs.filter((r) => r.category === 'sports').map((r) => String(r.eventId)))];
    const eventShowIds = [...new Set([
        ...eventShowRegs.map((r) => String(r.eventShow)).filter(Boolean),
        ...categoryRegs.filter((r) => r.category === 'events').map((r) => String(r.eventId)),
    ])];

    const [fests, competitions, treks, sports, eventShows] = await Promise.all([
        festIds.length ? FestOrganizer.find({ _id: { $in: festIds } }).select('festName').lean() : [],
        competitionIds.length ? Competition.find({ _id: { $in: competitionIds } }).select('name').lean() : [],
        trekIds.length ? Trek.find({ _id: { $in: trekIds } }).select('name title').lean() : [],
        sportsIds.length ? SportsEvent.find({ _id: { $in: sportsIds } }).select('name title').lean() : [],
        eventShowIds.length ? EventShow.find({ _id: { $in: eventShowIds } }).select('title name').lean() : [],
    ]);

    const nameMap = {};
    fests.forEach((f) => { nameMap[`fest:${f._id}`] = f.festName; });
    competitions.forEach((c) => { nameMap[`competition:${c._id}`] = c.name; });
    treks.forEach((t) => { nameMap[`trek:${t._id}`] = t.name || t.title; });
    sports.forEach((s) => { nameMap[`sports:${s._id}`] = s.name || s.title; });
    eventShows.forEach((e) => { nameMap[`eventshow:${e._id}`] = e.title || e.name; });

    const timeline = [];

    timeline.push(timelineItem({
        occurredAt: user.createdAt,
        category: 'account',
        action: 'Account created',
        entityType: 'user',
        status: user.signupMethod || 'signup',
    }));

    logins.forEach((l) => timeline.push(timelineItem({
        occurredAt: l.createdAt,
        category: 'login',
        action: `Signed in via ${l.method || 'password'}`,
        status: l.source || 'live',
        meta: { ip: l.ip, device: l.device },
        sourceId: l._id,
    })));

    activity.forEach((a) => timeline.push(timelineItem({
        occurredAt: a.createdAt,
        category: 'activity',
        action: a.eventType === 'page_view' ? `Viewed ${a.page || 'page'}` : a.eventType,
        entityType: a.eventType,
        entityName: a.page || '',
        meta: { durationSeconds: a.durationSeconds, device: a.device },
        sourceId: a._id,
    })));

    festRegs.forEach((r) => {
        const festName = nameMap[`fest:${r.fest}`] || 'Fest';
        const compName = r.competitionId ? nameMap[`competition:${r.competitionId}`] : null;
        timeline.push(timelineItem({
            occurredAt: r.createdAt,
            category: 'registration',
            action: r.isProShow ? `Pro show ticket — ${festName}` : compName ? `Competition — ${compName}` : `Fest registration — ${festName}`,
            entityType: r.isProShow ? 'pro_show' : r.competitionId ? 'competition' : 'fest',
            entityName: compName || festName,
            status: r.status,
            amount: r.amountPaid || null,
            meta: { checkedIn: r.checkedIn, paymentStatus: r.paymentStatus },
            sourceId: r._id,
        }));
    });

    [...categoryRegs, ...guestCategoryRegs].forEach((r) => {
        const key = r.category === 'trek' ? `trek:${r.eventId}`
            : r.category === 'sports' ? `sports:${r.eventId}`
                : `eventshow:${r.eventId}`;
        timeline.push(timelineItem({
            occurredAt: r.createdAt,
            category: 'booking',
            action: `${r.category} booking`,
            entityType: r.category,
            entityName: nameMap[key] || r.category,
            status: r.status,
            amount: r.amountPaid || null,
            meta: { paymentStatus: r.paymentStatus, guest: !r.user },
            sourceId: r._id,
        }));
    });

    [...trekBookings, ...guestTrekBookings].forEach((r) => {
        timeline.push(timelineItem({
            occurredAt: r.createdAt,
            category: 'booking',
            action: 'Trek booking',
            entityType: 'trek',
            entityName: nameMap[`trek:${r.trekId}`] || 'Trek',
            status: r.status,
            amount: r.amountPaid || null,
            meta: { guest: !r.userId },
            sourceId: r._id,
        }));
    });

    eventShowRegs.forEach((r) => {
        timeline.push(timelineItem({
            occurredAt: r.createdAt,
            category: 'registration',
            action: 'Event show registration',
            entityType: 'event_show',
            entityName: nameMap[`eventshow:${r.eventShow}`] || 'Event',
            status: r.status,
            amount: r.amountPaid || null,
            sourceId: r._id,
        }));
    });

    competitionRegs.forEach((r) => {
        timeline.push(timelineItem({
            occurredAt: r.submittedAt || r.createdAt,
            category: 'registration',
            action: 'Competition registration (legacy)',
            entityType: 'competition',
            entityName: nameMap[`competition:${r.competition}`] || 'Competition',
            status: r.status,
            sourceId: r._id,
        }));
    });

    [...payments, ...guestPayments].forEach((p) => {
        timeline.push(timelineItem({
            occurredAt: p.createdAt,
            category: 'payment',
            action: `Payment ${p.status}`,
            entityType: p.entityType,
            status: p.status,
            amount: p.totalAmount,
            meta: { orderId: p.orderId, gateway: p.gateway, guest: !p.userId },
            sourceId: p._id,
        }));
    });

    notifications.forEach((n) => timeline.push(timelineItem({
        occurredAt: n.createdAt,
        category: 'notification',
        action: n.title || 'Notification',
        entityType: n.type || 'notification',
        entityName: n.message || '',
        status: n.isRead ? 'read' : 'unread',
        sourceId: n._id,
    })));

    follows.forEach((f) => timeline.push(timelineItem({
        occurredAt: f.createdAt,
        category: 'follow',
        action: `Followed ${f.entityType}`,
        entityType: f.entityType,
        entityName: String(f.entityId),
        sourceId: f._id,
    })));

    couponUsages.forEach((c) => timeline.push(timelineItem({
        occurredAt: c.lastUsedAt || c.updatedAt || c.createdAt,
        category: 'payment',
        action: `Coupon used${c.usedCount ? ` (${c.usedCount}×)` : ''}`,
        entityType: 'coupon',
        entityName: String(c.couponId || ''),
        meta: { usedCount: c.usedCount || 0 },
        sourceId: c._id,
    })));

    timeline.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

    const derivedActivity = buildDerivedActivityRows({
        userId: id,
        email: userEmail,
        logins,
        lifetimeLoginCount: user.loginCount || 0,
        lastLoginAt: user.lastLoginAt,
        joinedAt: user.createdAt,
        festRegs,
        categoryRegs,
        guestCategoryRegs,
        trekBookings,
        guestTrekBookings,
        eventShowRegs,
        competitionRegs,
        payments,
        guestPayments,
        nameMap,
    });
    const combinedActivity = mergeActivityRows(activity, derivedActivity);

    const activityStats = buildActivityAnalytics(combinedActivity);
    const trackedActivityStats = buildActivityAnalytics(activity);
    const loginStats = buildLoginAnalytics(logins, user);

    const allRegs = festRegs.length + categoryRegs.length + guestCategoryRegs.length
        + trekBookings.length + guestTrekBookings.length + eventShowRegs.length + competitionRegs.length;
    const paidPayments = [...payments, ...guestPayments].filter((p) => p.status === 'PAID');
    const allPayments = [...payments, ...guestPayments];
    const totalSpent = paidPayments.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);

    const registrationDetails = buildRegistrationDetails({
        festRegs,
        categoryRegs,
        guestCategoryRegs,
        trekBookings,
        guestTrekBookings,
        eventShowRegs,
        competitionRegs,
        nameMap,
    });
    const paymentBreakdown = buildPaymentBreakdown(allPayments);
    const communityFollows = await resolveCommunityFollows(follows);
    const engagement = buildEngagementAndChurn({
        user,
        loginStats,
        totalSpent,
        allRegs,
        paidOrders: paidPayments.length,
        totalPaymentAttempts: allPayments.length,
        activityStats,
    });

    const unreadNotifications = notifications.filter((n) => !n.isRead).length;

    return {
        user: {
            id: String(user._id),
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            college: user.college,
            isVerified: Boolean(user.isVerified),
            joinedAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            lastLoginMethod: user.lastLoginMethod || '',
            lastLoginIp: user.lastLoginIp || '',
            lastActivityAt: activityStats.lastActiveAt || null,
            lifetimeLoginCount: user.loginCount || 0,
            signupMethod: user.signupMethod,
        },
        summary: {
            logins: loginStats.total,
            activityEvents: combinedActivity.length,
            trackedActivityEvents: activity.length,
            derivedActivityEvents: derivedActivity.length,
            pageViews: activityStats.pageViews,
            trackedPageViews: trackedActivityStats.pageViews,
            uniqueSessions: activityStats.uniqueSessions,
            totalEngagementSeconds: activityStats.totalEngagementSeconds,
            totalEngagementFormatted: activityStats.totalEngagementFormatted,
            avgEngagementPerPageFormatted: activityStats.avgEngagementPerPageFormatted,
            avgEngagementPerSessionFormatted: activityStats.avgEngagementPerSessionFormatted,
            registrations: allRegs,
            festRegistrations: festRegs.length,
            categoryRegistrations: categoryRegs.length + guestCategoryRegs.length,
            trekBookings: trekBookings.length + guestTrekBookings.length,
            eventShowRegistrations: eventShowRegs.length,
            competitionRegistrations: competitionRegs.length,
            payments: payments.length + guestPayments.length,
            paidOrders: paidPayments.length,
            totalSpent,
            notifications: notifications.length,
            follows: follows.length,
            couponsUsed: couponUsages.length,
            checkIns: registrationDetails.stats.checkedIn,
            registrationApproved: registrationDetails.stats.approved,
            registrationPending: registrationDetails.stats.pending,
            avgOrderValue: paymentBreakdown.avgOrderValue,
            unreadNotifications,
        },
        engagement,
        registrationDetails,
        paymentBreakdown,
        communityFollows,
        activityStats: {
            ...activityStats,
            tracked: trackedActivityStats,
            derivedEventCount: derivedActivity.length,
        },
        loginStats,
        topPages: activityStats.topPages,
        sessions: activityStats.sessions,
        devices: activityStats.devices,
        eventTypes: activityStats.eventTypes,
        recentLogins: loginStats.recent,
        sections: {
            logins,
            activity,
            festRegistrations: festRegs,
            categoryRegistrations: [...categoryRegs, ...guestCategoryRegs],
            trekBookings: [...trekBookings, ...guestTrekBookings],
            eventShowRegistrations: eventShowRegs,
            competitionRegistrations: competitionRegs,
            payments: [...payments, ...guestPayments],
            notifications,
            couponUsages,
            follows,
        },
        timeline,
    };
}

module.exports = {
    listAllUsersWithSummaries,
    getFullUserHistory,
};
