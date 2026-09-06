const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const User = require('../model/usermodel');

const getClientIp = (req) => req?.ip || req?.socket?.remoteAddress || '';

function detectDevice(userAgent = '') {
    const ua = String(userAgent);
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    if (ua) return 'desktop';
    return 'unknown';
}

function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
}

async function resolveUserIdentity(userId) {
    if (!userId) return { userId: null, email: '', name: '' };
    try {
        const user = await User.findById(userId).select('email name').lean();
        if (!user) return { userId, email: '', name: '' };
        return {
            userId,
            email: normalizeEmail(user.email),
            name: String(user.name || '').trim(),
        };
    } catch {
        return { userId, email: '', name: '' };
    }
}

/**
 * Append a login event (called from recordLogin).
 */
async function recordUserLoginLog({ userId, email, name, method, req, sessionId = null }) {
    if (!userId) return;
    const ua = String(req?.headers?.['user-agent'] || '').slice(0, 300);
    await UserLoginLog.create({
        userId,
        email: normalizeEmail(email),
        name: String(name || '').trim(),
        method: method || 'password',
        ip: getClientIp(req),
        userAgent: ua,
        device: detectDevice(ua),
        sessionId: sessionId || null,
    }).catch((err) => {
        console.error('❌ UserLoginLog create failed:', err.message);
    });
}

/**
 * Persist user-facing activity (page views, clicks, etc.).
 */
async function recordUserActivity({
    userId,
    email,
    sessionId,
    eventType,
    page,
    previousPage,
    durationSeconds,
    metadata,
    req,
}) {
    if (!eventType) return;

    let resolvedEmail = normalizeEmail(email);
    let resolvedUserId = userId || null;

    if (resolvedUserId && !resolvedEmail) {
        const identity = await resolveUserIdentity(resolvedUserId);
        resolvedEmail = identity.email;
    }

    const ua = String(req?.headers?.['user-agent'] || metadata?.userAgent || '').slice(0, 300);
    const device = metadata?.device || detectDevice(ua);

    await UserActivityLog.create({
        userId: resolvedUserId,
        email: resolvedEmail,
        sessionId: sessionId || null,
        eventType,
        page: String(page || metadata?.page || '').slice(0, 500),
        previousPage: String(previousPage || metadata?.previousPage || '').slice(0, 500),
        durationSeconds: Math.max(0, Math.min(Number(durationSeconds) || 0, 86400)),
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        ip: getClientIp(req),
        userAgent: ua,
        device,
    }).catch((err) => {
        console.error('❌ UserActivityLog create failed:', err.message);
    });
}

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseDays(raw, fallback = 30) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, 365);
}

/** Most recent December 1 (Dec 1 of current year if we're in Dec, else prior year). */
function getDecemberStartDate(reference = new Date()) {
    const ref = reference instanceof Date ? reference : new Date(reference);
    const year = ref.getMonth() >= 11 ? ref.getFullYear() : ref.getFullYear() - 1;
    return startOfDay(new Date(year, 11, 1));
}

function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function rangeToGaDates(range) {
    if (range?.allTime) {
        return {
            startDate: '2020-01-01',
            endDate: new Date().toISOString().slice(0, 10),
        };
    }
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
    };
}

/**
 * Resolve admin report window from query params.
 * Supports range=since-dec, startDate+endDate, or days=N (default since-dec).
 */
function parseReportRange(query = {}) {
    const customStart = String(query.startDate || '').trim();
    const customEnd = String(query.endDate || '').trim();
    const end = ISO_DATE.test(customEnd)
        ? (() => { const d = new Date(`${customEnd}T23:59:59`); return Number.isNaN(d.getTime()) ? endOfToday() : d; })()
        : endOfToday();

    let start;
    let label;
    const rangeKey = String(query.range || query.days || 'since-dec').trim();

    if (ISO_DATE.test(customStart) && ISO_DATE.test(customEnd)) {
        start = startOfDay(new Date(`${customStart}T00:00:00`));
        label = `${customStart} → ${customEnd}`;
    } else if (rangeKey === 'all-time' || rangeKey === 'all') {
        start = new Date(0);
        label = 'All time';
    } else if (rangeKey === 'since-dec') {
        start = getDecemberStartDate();
        label = `Since ${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (ISO_DATE.test(customStart)) {
        start = startOfDay(new Date(`${customStart}T00:00:00`));
        label = `Since ${customStart}`;
    } else {
        const days = parseDays(rangeKey, 30);
        start = new Date(end);
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        label = `Last ${days} days`;
    }

    return {
        match: rangeKey === 'all-time' || rangeKey === 'all'
            ? {}
            : { createdAt: { $gte: start, $lte: end } },
        range: {
            key: rangeKey,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            label,
            allTime: rangeKey === 'all-time' || rangeKey === 'all',
        },
    };
}

module.exports = {
    recordUserLoginLog,
    recordUserActivity,
    resolveUserIdentity,
    detectDevice,
    startOfDay,
    endOfToday,
    parseDays,
    parseReportRange,
    getDecemberStartDate,
    rangeToGaDates,
    normalizeEmail,
};
