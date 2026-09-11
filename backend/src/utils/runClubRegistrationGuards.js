const CategoryRegistration = require('../model/category_registration_model');

/**
 * Pending organizer-QR payments never auto-expire.
 * Organizers approve/reject anytime; optional manual "Expire stale" uses forceTtlHours only.
 */
const PENDING_TTL_HOURS = 0;
/** Used only when organizer clicks "Expire stale" on the dashboard. */
const MANUAL_EXPIRE_TTL_HOURS = Math.max(
    1,
    Number(process.env.RUN_QR_MANUAL_EXPIRE_TTL_HOURS) || 72,
);
const PENDING_EXPIRE_BATCH = Math.max(50, Number(process.env.RUN_QR_PENDING_EXPIRE_BATCH) || 200);
const PENDING_EXPIRE_MAX_ROUNDS = Math.max(1, Number(process.env.RUN_QR_PENDING_EXPIRE_ROUNDS) || 10);
const MAX_PENDING_QR_PER_USER_WINDOW = Math.max(1, Number(process.env.RUN_QR_PENDING_PER_USER_LIMIT) || 3);

function pendingCutoffDate(ttlHours = MANUAL_EXPIRE_TTL_HOURS) {
    return new Date(Date.now() - ttlHours * 60 * 60 * 1000);
}

function isProductionEnv() {
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Cancel stale organizer_qr pending registrations (manual only).
 * Auto-expiry is permanently disabled — pending holds stay until organizer reviews.
 * @param {string|null} eventId
 * @param {{ forceTtlHours?: number|null }} [options]
 *   forceTtlHours — required to expire anything (dashboard "Expire stale" button).
 */
async function expireStalePendingRegistrations(eventId = null, options = {}) {
    const forceTtl = options?.forceTtlHours;
    const ttlHours = Number.isFinite(Number(forceTtl)) && Number(forceTtl) > 0
        ? Number(forceTtl)
        : 0;

    // Auto-expiry disabled: only run when an organizer explicitly forces a TTL
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
        const note = `Cancelled by organizer after ${ttlHours}h without approval`;
        const reviewedAt = new Date();

        await CategoryRegistration.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    status: 'cancelled',
                    paymentStatus: 'failed',
                    paymentReviewNote: note,
                    paymentReviewedAt: reviewedAt,
                    paymentReviewedBy: 'organizer_manual_expire',
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
                                title: 'Payment hold released',
                                message: `Your payment hold for ${eventTitle} was released by the club. You can register again from My Bookings or the run page.`,
                                type: 'registration',
                                link: '/booking',
                                emailSubject: `Payment hold released — ${eventTitle}`,
                                metadata: {
                                    registrationId: String(reg._id),
                                    action: 'manual_expire',
                                    ttlHours,
                                },
                                paymentContext: {
                                    status: 'failed',
                                    message: 'Hold released by the organizer. Register again anytime.',
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
    noun = 'run',
} = {}) {
    const cap = Math.max(0, Number(capacity) || 0);
    if (cap <= 0) return { ok: true };
    const activity = noun === 'event' ? 'event' : 'run';
    const reviewer = activity === 'event' ? 'community' : 'club';

    const confirmed = await sumConfirmedSeats(eventId, { excludeId });
    if (confirmed + people > cap) {
        return {
            ok: false,
            message: confirmed >= cap ? `This ${activity} is full` : `Only ${cap - confirmed} seat(s) left`,
        };
    }

    if (forPendingQr) {
        const pending = await sumPendingSeats(eventId, { excludeId });
        if (pending + people > cap) {
            return {
                ok: false,
                message: `Too many payments are awaiting ${reviewer} review. Try again later or contact the organizer.`,
            };
        }
    }

    return { ok: true };
}

async function countRecentPendingQrByUser(userId, excludeId = null) {
    if (!userId) return 0;
    const filter = {
        category: 'sports',
        user: userId,
        payment_gateway: 'organizer_qr',
        status: 'pending',
        paymentStatus: 'pending',
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return CategoryRegistration.countDocuments(filter);
}

async function assertUserPendingQrRateLimit(userId, excludeId = null) {
    const count = await countRecentPendingQrByUser(userId, excludeId);
    if (count >= MAX_PENDING_QR_PER_USER_WINDOW) {
        return {
            ok: false,
            message: `You already have ${count} payment(s) awaiting club review. Wait for the club to approve before submitting another.`,
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
