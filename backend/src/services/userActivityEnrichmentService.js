const Analytics = require('../model/analytics_model');
const User = require('../model/usermodel');
const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const { normalizeEmail, detectDevice } = require('./userActivityService');

/**
 * Fill missing emails on activity rows that already have userId.
 */
async function fillActivityEmailsFromUserId() {
    const rows = await UserActivityLog.find({
        userId: { $ne: null },
        $or: [{ email: '' }, { email: null }, { email: { $exists: false } }],
    }).select('_id userId').lean();

    if (!rows.length) return { updated: 0 };

    const userIds = [...new Set(rows.map((r) => String(r.userId)))];
    const users = await User.find({ _id: { $in: userIds } }).select('email').lean();
    const emailById = new Map(users.map((u) => [String(u._id), normalizeEmail(u.email)]));

    let updated = 0;
    for (const row of rows) {
        const email = emailById.get(String(row.userId));
        if (!email) continue;
        await UserActivityLog.updateOne({ _id: row._id }, { $set: { email } });
        updated += 1;
    }
    return { updated };
}

/**
 * Link anonymous activity to users via shared sessionId (login logs + analytics auth events).
 */
async function linkActivityBySessionId() {
    const sessionOwners = new Map();

    const [loginLogs, authAnalytics] = await Promise.all([
        UserLoginLog.find({ sessionId: { $nin: [null, ''] } }).select('sessionId userId email').lean(),
        Analytics.find({
            sessionId: { $nin: [null, ''] },
            userId: { $ne: null },
            eventType: { $in: ['login', 'signup', 'registration'] },
        }).select('sessionId userId').lean(),
    ]);

    loginLogs.forEach((l) => {
        if (l.sessionId) {
            sessionOwners.set(l.sessionId, {
                userId: l.userId,
                email: normalizeEmail(l.email),
            });
        }
    });

    authAnalytics.forEach((a) => {
        if (a.sessionId && a.userId && !sessionOwners.has(a.sessionId)) {
            sessionOwners.set(a.sessionId, { userId: a.userId, email: '' });
        }
    });

    if (!sessionOwners.size) return { activityUpdated: 0, sessions: 0 };

    const missingEmails = [...sessionOwners.values()].filter((v) => !v.email && v.userId);
    if (missingEmails.length) {
        const users = await User.find({
            _id: { $in: missingEmails.map((v) => v.userId) },
        }).select('email').lean();
        const emailById = new Map(users.map((u) => [String(u._id), normalizeEmail(u.email)]));
        sessionOwners.forEach((v, sid) => {
            if (!v.email && v.userId) {
                v.email = emailById.get(String(v.userId)) || '';
            }
        });
    }

    let activityUpdated = 0;
    for (const [sessionId, owner] of sessionOwners.entries()) {
        if (!owner.userId) continue;
        const result = await UserActivityLog.updateMany(
            {
                sessionId,
                $or: [{ userId: null }, { userId: { $exists: false } }, { email: '' }, { email: null }],
            },
            {
                $set: {
                    userId: owner.userId,
                    email: owner.email || '',
                },
            },
        );
        activityUpdated += result.modifiedCount || 0;
    }

    return { activityUpdated, sessions: sessionOwners.size };
}

function metaPlain(metadata) {
    if (!metadata) return {};
    if (metadata instanceof Map) return Object.fromEntries(metadata);
    if (typeof metadata.toObject === 'function') return metadata.toObject();
    return { ...metadata };
}

const TRACKABLE_EVENTS = [
    'page_view', 'fest_view', 'competition_view', 'registration',
    'search', 'login', 'signup', 'book_now_click',
];

/**
 * Import any Analytics rows (all time) not yet in UserActivityLog.
 */
async function importMissingAnalyticsRows() {
    const existingIds = new Set(
        (await UserActivityLog.find({ sourceAnalyticsId: { $ne: null } }).select('sourceAnalyticsId').lean())
            .map((r) => String(r.sourceAnalyticsId)),
    );

    const analyticsUserIds = await Analytics.distinct('userId', { userId: { $ne: null } });
    const users = await User.find({ _id: { $in: analyticsUserIds } }).select('email name').lean();
    const emailByUserId = new Map(users.map((u) => [String(u._id), normalizeEmail(u.email)]));

    const rows = await Analytics.find({ eventType: { $in: TRACKABLE_EVENTS } }).sort({ createdAt: 1 }).lean();
    const docs = [];

    for (const row of rows) {
        if (existingIds.has(String(row._id))) continue;
        const meta = metaPlain(row.metadata);
        const email = row.userId ? (emailByUserId.get(String(row.userId)) || '') : '';
        docs.push({
            userId: row.userId || null,
            email,
            sessionId: row.sessionId || null,
            eventType: row.eventType,
            page: String(meta.page || '').slice(0, 500),
            previousPage: String(meta.previousPage || '').slice(0, 500),
            durationSeconds: Math.max(0, Math.min(Number(meta.durationSeconds) || 0, 86400)),
            metadata: { ...meta, backfilledFromAnalytics: true },
            ip: '',
            userAgent: String(meta.userAgent || '').slice(0, 300),
            device: meta.device || detectDevice(meta.userAgent),
            source: 'backfill',
            sourceAnalyticsId: row._id,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt || row.createdAt,
        });
    }

    if (!docs.length) return { inserted: 0 };

    try {
        const inserted = await UserActivityLog.insertMany(docs, { ordered: false });
        return { inserted: inserted.length };
    } catch (err) {
        return { inserted: err.insertedDocs?.length ?? err.result?.nInserted ?? 0 };
    }
}

async function runUserActivityEnrichment() {
    const [emails, sessions, imported] = await Promise.all([
        fillActivityEmailsFromUserId(),
        linkActivityBySessionId(),
        importMissingAnalyticsRows(),
    ]);
    return {
        emailsFilled: emails.updated,
        activityLinkedBySession: sessions.activityUpdated,
        sessionsScanned: sessions.sessions,
        analyticsImported: imported.inserted,
    };
}

module.exports = {
    fillActivityEmailsFromUserId,
    linkActivityBySessionId,
    importMissingAnalyticsRows,
    runUserActivityEnrichment,
};
