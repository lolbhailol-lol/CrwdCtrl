const CategoryRegistration = require('../model/category_registration_model');

const PENDING_TTL_HOURS = Math.max(1, Number(process.env.RUN_QR_PENDING_TTL_HOURS) || 48);

function pendingCutoffDate() {
    return new Date(Date.now() - PENDING_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * Cancel stale organizer_qr pending registrations so they stop holding seats.
 * Safe to call on dashboard/list/register (idempotent).
 */
async function expireStalePendingRegistrations(eventId = null) {
    const filter = {
        category: 'sports',
        status: 'pending',
        paymentStatus: 'pending',
        payment_gateway: 'organizer_qr',
        createdAt: { $lt: pendingCutoffDate() },
    };
    if (eventId) filter.eventId = eventId;

    const result = await CategoryRegistration.updateMany(filter, {
        $set: {
            status: 'cancelled',
            paymentStatus: 'failed',
            paymentReviewNote: `Auto-expired after ${PENDING_TTL_HOURS}h without organizer approval`,
            paymentReviewedAt: new Date(),
            paymentReviewedBy: 'system',
        },
    });

    return result.modifiedCount || 0;
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
        if (!cloud) return true;
        return parsed.pathname.includes(`/${cloud}/`);
    }

    // Local / preview uploads during development
    if (host === 'localhost' || host === '127.0.0.1') return true;

    // Optional extra allowlist: comma-separated hostnames
    const extra = String(process.env.PAYMENT_SCREENSHOT_ALLOWED_HOSTS || '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    if (extra.includes(host)) return true;

    return false;
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

async function sumSeatsHeld(eventId, { excludeId = null } = {}) {
    const filter = {
        category: 'sports',
        eventId,
        status: { $in: ['pending', 'confirmed'] },
    };
    if (excludeId) filter._id = { $ne: excludeId };
    const regs = await CategoryRegistration.find(filter).select('bookingPeople responses').lean();
    return regs.reduce((sum, r) => sum + peopleFromRegistration(r), 0);
}

module.exports = {
    PENDING_TTL_HOURS,
    pendingCutoffDate,
    expireStalePendingRegistrations,
    isAllowedPaymentScreenshotUrl,
    peopleFromRegistration,
    sumSeatsHeld,
};
