const Analytics = require('../model/analytics_model');
const User = require('../model/usermodel');
const UserLoginLog = require('../model/user_login_log_model');
const UserActivityLog = require('../model/user_activity_log_model');
const {
    getDecemberStartDate,
    detectDevice,
    normalizeEmail,
} = require('./userActivityService');

const TRACKABLE_EVENTS = [
    'page_view',
    'fest_view',
    'competition_view',
    'registration',
    'search',
    'login',
    'signup',
    'book_now_click',
];

const BATCH_SIZE = 250;

function metaPlain(metadata) {
    if (!metadata) return {};
    if (metadata instanceof Map) return Object.fromEntries(metadata);
    if (typeof metadata.toObject === 'function') return metadata.toObject();
    return { ...metadata };
}

async function insertActivityBatch(docs) {
    if (!docs.length) return { inserted: 0, skipped: 0 };
    try {
        const result = await UserActivityLog.insertMany(docs, { ordered: false });
        return { inserted: result.length, skipped: 0 };
    } catch (err) {
        if (err?.code === 11000 || err?.name === 'MongoBulkWriteError') {
            const inserted = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
            return { inserted, skipped: docs.length - inserted };
        }
        throw err;
    }
}

/**
 * Import legacy Analytics rows + user last-login snapshots since December 1.
 * Safe to run multiple times — skips rows already imported.
 */
async function backfillUserActivitySinceDecember({ since = null, force = false } = {}) {
    const sinceDate = since ? new Date(since) : getDecemberStartDate();
    sinceDate.setHours(0, 0, 0, 0);

    const [hasActivityBackfill, hasLoginBackfill] = await Promise.all([
        UserActivityLog.exists({ source: 'backfill' }),
        UserLoginLog.exists({ source: 'backfill' }),
    ]);

    if (!force && hasActivityBackfill && hasLoginBackfill) {
        return {
            skipped: true,
            message: 'Backfill already completed',
            since: sinceDate.toISOString(),
        };
    }

    const importActivity = force || !hasActivityBackfill;
    const importLogins = force || !hasLoginBackfill;

    let users = [];
    if (importLogins) {
        users = await User.find({
            isDeleted: { $ne: true },
            lastLoginAt: { $gte: sinceDate },
        }).select('email name lastLoginAt lastLoginIp lastLoginUserAgent lastLoginMethod loginCount').lean();
    }

    const emailByUserId = new Map();
    if (importActivity) {
        const analyticsUserIds = await Analytics.distinct('userId', {
            createdAt: { $gte: sinceDate },
            userId: { $ne: null },
        });
        const identityUsers = await User.find({
            _id: { $in: analyticsUserIds },
            isDeleted: { $ne: true },
        }).select('email name').lean();
        identityUsers.forEach((u) => {
            emailByUserId.set(String(u._id), {
                email: normalizeEmail(u.email),
                name: String(u.name || '').trim(),
            });
        });
    }

    let activityInserted = 0;
    let activitySkipped = 0;
    let loginInserted = 0;
    let loginSkipped = 0;

    if (importActivity) {
        const existingIds = new Set(
            (await UserActivityLog.find({ sourceAnalyticsId: { $ne: null } })
                .select('sourceAnalyticsId')
                .lean())
                .map((r) => String(r.sourceAnalyticsId)),
        );

        const analyticsRows = await Analytics.find({
            createdAt: { $gte: sinceDate },
            eventType: { $in: TRACKABLE_EVENTS },
        }).sort({ createdAt: 1 }).lean();

        let batch = [];
        for (const row of analyticsRows) {
            if (existingIds.has(String(row._id))) {
                activitySkipped += 1;
                continue;
            }

            const meta = metaPlain(row.metadata);
            const identity = row.userId ? emailByUserId.get(String(row.userId)) : null;
            batch.push({
                userId: row.userId || null,
                email: identity?.email || '',
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

            if (batch.length >= BATCH_SIZE) {
                const { inserted, skipped } = await insertActivityBatch(batch);
                activityInserted += inserted;
                activitySkipped += skipped;
                batch = [];
            }
        }

        if (batch.length) {
            const { inserted, skipped } = await insertActivityBatch(batch);
            activityInserted += inserted;
            activitySkipped += skipped;
        }
    }

    if (importLogins) {
        const existingLoginUsers = new Set(
            (await UserLoginLog.find({ source: 'backfill' }).select('userId').lean())
                .map((r) => String(r.userId)),
        );

        const loginDocs = [];
        for (const user of users) {
            if (!user.lastLoginAt) continue;
            if (existingLoginUsers.has(String(user._id))) {
                loginSkipped += 1;
                continue;
            }
            const ua = String(user.lastLoginUserAgent || '').slice(0, 300);
            loginDocs.push({
                userId: user._id,
                email: normalizeEmail(user.email),
                name: String(user.name || '').trim(),
                method: user.lastLoginMethod || 'password',
                ip: user.lastLoginIp || '',
                userAgent: ua,
                device: detectDevice(ua),
                sessionId: null,
                source: 'backfill',
                lifetimeLoginCount: Number(user.loginCount) || 1,
                createdAt: user.lastLoginAt,
                updatedAt: user.lastLoginAt,
            });
        }

        if (loginDocs.length) {
            try {
                const inserted = await UserLoginLog.insertMany(loginDocs, { ordered: false });
                loginInserted = inserted.length;
            } catch (err) {
                if (err?.code === 11000 || err?.name === 'MongoBulkWriteError') {
                    loginInserted = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
                    loginSkipped += loginDocs.length - loginInserted;
                } else {
                    throw err;
                }
            }
        }
    }

    return {
        skipped: false,
        since: sinceDate.toISOString(),
        activityInserted,
        activitySkipped,
        loginInserted,
        loginSkipped,
        usersScanned: users.length,
    };
}

module.exports = {
    backfillUserActivitySinceDecember,
};
