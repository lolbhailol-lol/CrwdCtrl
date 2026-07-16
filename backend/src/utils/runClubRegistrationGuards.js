const CategoryRegistration = require('../model/category_registration_model');

/**
 * Hours before pending organizer-QR holds auto-cancel.
 * Set RUN_QR_PENDING_TTL_HOURS=0 (default) to disable automatic expiry.
 * Organizers can still clear stale holds manually from the dashboard.
 */
const rawPendingTtl = Number(process.env.RUN_QR_PENDING_TTL_HOURS);
const PENDING_TTL_HOURS = Number.isFinite(rawPendingTtl) ? Math.max(0, rawPendingTtl) : 0;
/** Used only when organizer clicks "Expire stale" and auto-TTL is disabled. */
const MANUAL_EXPIRE_TTL_HOURS = Math.max(
    1,
    Number(process.env.RUN_QR_MANUAL_EXPIRE_TTL_HOURS) || 72,
);
const PENDING_EXPIRE_BATCH = Math.max(50, Number(process.env.RUN_QR_PENDING_EXPIRE_BATCH) || 200);
const PENDING_EXPIRE_MAX_ROUNDS = Math.max(1, Number(process.env.RUN_QR_PENDING_EXPIRE_ROUNDS) || 10);
const MAX_PENDING_QR_PER_USER_WINDOW = Math.max(1, Number(process.env.RUN_QR_PENDING_PER_USER_LIMIT) || 3);

function pendingCutoffDate(ttlHours = PENDING_TTL_HOURS) {
    return new Date(Date.now() - ttlHours * 60 * 60 * 1000);
}

function isProductionEnv() {
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Cancel stale organizer_qr pending registrations so they stop holding seats.
 * Loops in batches until drained (capped rounds) so griefing floods clear.
 * @param {string|null} eventId
 * @param {{ forceTtlHours?: number|null }} [options]
 *   forceTtlHours — use this TTL even when auto-expiry is disabled (manual expire).
 */
async function expireStalePendingRegistrations(eventId = null, options = {}) {
    const forceTtl = options?.forceTtlHours;
    const ttlHours = Number.isFinite(Number(forceTtl)) && Number(forceTtl) > 0
        ? Number(forceTtl)
        : PENDING_TTL_HOURS;

    // 0 = never auto-expire (unless caller forces a TTL, e.g. dashboard button)
    if (!ttlHours || ttlHours <= 0) return 0;

    let total = 0;
    for (let round = 0; round < PENDING_EXPIRE_MAX_ROUNDS; round += 1) {
        const filter = {
            category: 'sports',
            status: 'pending',
            paymentStatus: 'pending',
            payment_gateway: 'organizer_qr',
            createdAt: { $lt: pendingCutoffDate(ttlHours) },
        };
        if (eventId) filter.eventId = eventId;

        const stale = await CategoryRegistration.find(filter)
            .populate('user', 'name email phoneNumber notificationPreferences')
            .limit(PENDING_EXPIRE_BATCH)
            .lean();

        if (!stale.length) break;

        const ids = stale.map((r) => r._id);
        const note = `Auto-expired after ${ttlHours}h without organizer approval`;
        const reviewedAt = new Date();

        await CategoryRegistration.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    status: 'cancelled',
                    paymentStatus: 'failed',
                    paymentReviewNote: note,
                    paymentReviewedAt: reviewedAt,
                    paymentReviewedBy: 'system',
                },
            },
        );

        total += stale.length;

        setImmediate(() => {
            Promise.resolve()
                .then(async () => {
                    const { notifyRunClubParticipant } = require('./runClubParticipantOutreach');
                    const { decryptRegistrationPii } = require('./runClubPiiCrypto');
                    const SportsEvent = require('../model/sports_model');

                    for (const reg of stale) {
                        try {
                            const event = await SportsEvent.findById(reg.eventId).select('title runClubId').lean();
                            const eventTitle = event?.title || 'your run';
                            const lean = decryptRegistrationPii(
                                {
                                    ...reg,
                                    status: 'cancelled',
                                    paymentStatus: 'failed',
                                    paymentReviewNote: note,
                                },
                                event?.runClubId || reg.runClubId,
                            );
                            await notifyRunClubParticipant({
                                registration: lean,
                                eventId: reg.eventId,
                                eventTitle,
                                title: 'Payment hold expired',
                                message: `Your payment hold for ${eventTitle} expired after ${ttlHours} hours without club approval. You can register again from My Bookings or the run page.`,
                                type: 'registration',
                                link: '/booking',
                                emailSubject: `Payment hold expired — ${eventTitle}`,
                                metadata: {
                                    registrationId: String(reg._id),
                                    action: 'auto_expire',
                                    ttlHours,
                                },
                                paymentContext: {
                                    status: 'failed',
                                    message: `Hold released after ${ttlHours}h without organizer approval. Register again anytime.`,
                                },
                            });
                        } catch (err) {
                            console.error('[expireStalePending.notify]', err.message);
                        }
                    }
                })
                .catch((err) => console.error('[expireStalePending.batch]', err.message));
        });

        if (stale.length < PENDING_EXPIRE_BATCH) break;
    }

    return total;
}

function isAllowedPaymentScreenshotUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return false;
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return false;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();

    if (host === 'res.cloudinary.com') {
        // Require configured cloud name so arbitrary Cloudinary accounts cannot pass
        if (!cloud) return false;
        return parsed.pathname.includes(`/${cloud}/`);
    }

    // Local uploads only outside production
    if ((host === 'localhost' || host === '127.0.0.1') && !isProductionEnv()) return true;

    const extra = String(process.env.PAYMENT_SCREENSHOT_ALLOWED_HOSTS || '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    if (extra.includes(host)) return true;

    return false;
}

function normalizeTransactionId(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

function peopleFromRegistration(reg) {
    const fromField = Number(reg?.bookingPeople);
    if (Number.isFinite(fromField) && fromField >= 1) return Math.floor(fromField);
    const responses = reg?.responses;
    let raw;
    if (responses instanceof Map) raw = responses.get('people');
    else if (responses && typeof responses.get === 'function') raw = responses.get('people');
    else raw = responses?.people;
    return Math.max(1, Number(raw) || 1);
}

async function sumSeatsHeld(eventId, { excludeId = null, statuses = ['pending', 'confirmed'] } = {}) {
    const filter = {
        category: 'sports',
        eventId,
        status: { $in: statuses },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    const regs = await CategoryRegistration.find(filter).select('bookingPeople responses').lean();
    return regs.reduce((sum, r) => sum + peopleFromRegistration(r), 0);
}

async function sumConfirmedSeats(eventId, { excludeId = null } = {}) {
    return sumSeatsHeld(eventId, { excludeId, statuses: ['confirmed'] });
}

async function sumPendingSeats(eventId, { excludeId = null } = {}) {
    return sumSeatsHeld(eventId, { excludeId, statuses: ['pending'] });
}

/**
 * Soft-hold capacity:
 * - Sold out = confirmed seats only (fake pending QR cannot block cashfree/free confirms)
 * - Pending QR pool also capped at capacity so griefing cannot grow without limit
 */
async function assertSportsCapacityAvailable(eventId, people, {
    excludeId = null,
    forPendingQr = false,
    capacity = 0,
} = {}) {
    const cap = Math.max(0, Number(capacity) || 0);
    if (cap <= 0) return { ok: true };

    const confirmed = await sumConfirmedSeats(eventId, { excludeId });
    if (confirmed + people > cap) {
        return {
            ok: false,
            message: confirmed >= cap ? 'This run is full' : `Only ${cap - confirmed} seat(s) left`,
        };
    }

    if (forPendingQr) {
        const pending = await sumPendingSeats(eventId, { excludeId });
        if (pending + people > cap) {
            return {
                ok: false,
                message: 'Too many payments are awaiting club review. Try again later or contact the organizer.',
            };
        }
    } else {
        // Cashfree / free confirm: pending holds do not hard-block confirmed seats anymore
        // (confirmed check above is enough). Soft warn only if pending+confirmed wildly high? skip.
    }

    return { ok: true };
}

async function countRecentPendingQrByUser(userId) {
    if (!userId) return 0;
    return CategoryRegistration.countDocuments({
        category: 'sports',
        user: userId,
        payment_gateway: 'organizer_qr',
        status: 'pending',
        paymentStatus: 'pending',
    });
}

async function assertUserPendingQrRateLimit(userId) {
    const count = await countRecentPendingQrByUser(userId);
    if (count >= MAX_PENDING_QR_PER_USER_WINDOW) {
        return {
            ok: false,
            message: `You already have ${count} payment(s) awaiting club review. Wait for approval or expiry before submitting another.`,
        };
    }
    return { ok: true };
}

/**
 * Build a regex that matches a normalized txn id even when the DB value
 * still has spaces / mixed case (e.g. "ABC 123" ↔ "ABC123").
 */
function transactionIdFlexibleRegex(normalized) {
    const escapedChars = String(normalized)
        .split('')
        .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // optional whitespace between each char + trim edges
    return new RegExp(`^\\s*${escapedChars.join('\\s*')}\\s*$`, 'i');
}

async function findDuplicateTransactionId({ eventId, transactionId, excludeId = null }) {
    const normalized = normalizeTransactionId(transactionId);
    if (!normalized || normalized.length < 4) return null;

    const filter = {
        category: 'sports',
        eventId,
        status: { $in: ['pending', 'confirmed'] },
        transactionId: { $regex: transactionIdFlexibleRegex(normalized) },
    };
    if (excludeId) filter._id = { $ne: excludeId };

    return CategoryRegistration.findOne(filter).select('_id user status transactionId').lean();
}

module.exports = {
    PENDING_TTL_HOURS,
    MANUAL_EXPIRE_TTL_HOURS,
    pendingCutoffDate,
    expireStalePendingRegistrations,
    isAllowedPaymentScreenshotUrl,
    normalizeTransactionId,
    peopleFromRegistration,
    sumSeatsHeld,
    sumConfirmedSeats,
    sumPendingSeats,
    assertSportsCapacityAvailable,
    assertUserPendingQrRateLimit,
    findDuplicateTransactionId,
};
