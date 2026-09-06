const mongoose = require('mongoose');
const TrekBooking = require('../model/trek_booking_model');
const CategoryRegistration = require('../model/category_registration_model');
const { pickFormField } = require('./trekOrganizerFormat');

function toObjectId(id) {
    if (!id) return id;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
        return new mongoose.Types.ObjectId(String(id));
    }
    return id;
}

function responsesPlain(responses) {
    if (!responses) return {};
    if (responses instanceof Map) return Object.fromEntries(responses);
    if (typeof responses.toObject === 'function') return responses.toObject();
    return typeof responses === 'object' ? { ...responses } : {};
}

function emptyGenderStats() {
    return {
        female: { filled: 0, bookings: 0 },
        male: { filled: 0, bookings: 0 },
        others: { filled: 0, bookings: 0 },
    };
}

function countSportsGenderFromRegs(regs = []) {
    const stats = emptyGenderStats();
    for (const reg of regs) {
        const form = responsesPlain(reg?.responses);
        const gender = normalizeGender(
            reg?.participantGender
            || form.gender
            || form.sex
            || form.Gender
            || form.participant_gender,
        );
        if (!gender) continue;
        const key = genderToQuotaKey(gender);
        const people = Math.max(
            1,
            Number(reg?.bookingPeople) || Number(form.people) || 1,
        );
        stats[key].filled += people;
        stats[key].bookings += 1;
    }
    return stats;
}

const GENDER_VALUES = ['Female', 'Male', 'Others'];
const GENDER_PHASES = ['closed', 'women_only', 'men_only', 'all'];

const PHASE_LABELS = {
    closed: 'Registration paused',
    women_only: 'Women registration open',
    men_only: 'Men registration open',
    all: 'Open to all',
};

function normalizeGender(value) {
    if (value === null || value === undefined || value === '') return null;
    const s = String(value).trim().toLowerCase();
    if (['female', 'f', 'woman', 'women'].includes(s)) return 'Female';
    if (['male', 'm', 'man', 'men'].includes(s)) return 'Male';
    if (['others', 'other', 'non-binary', 'nonbinary', 'prefer not to say'].includes(s)) return 'Others';
    if (s === 'female') return 'Female';
    if (s === 'male') return 'Male';
    return GENDER_VALUES.includes(value) ? value : null;
}

function genderToQuotaKey(gender) {
    if (gender === 'Female') return 'female';
    if (gender === 'Male') return 'male';
    return 'others';
}

function resolveParticipantGender({ user, formData }) {
    const fromForm = pickFormField(formData || {}, ['gender', 'sex', 'Gender', 'participant_gender']);
    return normalizeGender(fromForm) || normalizeGender(user?.gender);
}

function sanitizeGenderQuotas(raw = {}) {
    return {
        enabled: Boolean(raw.enabled),
        femaleSeats: Math.max(0, Number(raw.femaleSeats) || 0),
        maleSeats: Math.max(0, Number(raw.maleSeats) || 0),
        othersSeats: Math.max(0, Number(raw.othersSeats) || 0),
    };
}

function sanitizeGenderPhase(phase) {
    return GENDER_PHASES.includes(phase) ? phase : 'all';
}

function isGenderQuotasEnabled(trek) {
    return Boolean(trek?.registration?.genderQuotas?.enabled);
}

function getEffectiveGenderPhase(trek) {
    if (!isGenderQuotasEnabled(trek)) return 'all';
    return sanitizeGenderPhase(trek?.registration?.genderPhase);
}

function canGenderRegisterInPhase(gender, phase) {
    if (phase === 'closed') return false;
    if (phase === 'all') return Boolean(gender);
    if (phase === 'women_only') return gender === 'Female';
    if (phase === 'men_only') return gender === 'Male';
    return false;
}

function isGenderPhaseRestricted(phase) {
    return phase === 'women_only' || phase === 'men_only';
}

function requiresSinglePersonGenderBooking(trek) {
    if (!isGenderQuotasEnabled(trek)) return false;
    return isGenderPhaseRestricted(getEffectiveGenderPhase(trek));
}

function phaseBlockMessage(phase) {
    if (phase === 'closed') return 'Registration is currently paused for this trek.';
    if (phase === 'women_only') return 'Registration is open for women only right now. Men\'s registration will open later.';
    if (phase === 'men_only') return 'Registration is open for men only right now.';
    return 'Registration is not available for your profile.';
}

async function aggregateGenderQuotaStats(trekId) {
    const rows = await TrekBooking.aggregate([
        { $match: { trekId, status: 'confirmed', participantGender: { $in: GENDER_VALUES } } },
        {
            $group: {
                _id: '$participantGender',
                seats: { $sum: { $ifNull: ['$bookingDetails.people', 1] } },
                count: { $sum: 1 },
            },
        },
    ]);

    const stats = {
        female: { filled: 0, bookings: 0 },
        male: { filled: 0, bookings: 0 },
        others: { filled: 0, bookings: 0 },
    };

    for (const row of rows) {
        const key = genderToQuotaKey(row._id);
        stats[key].filled = row.seats || 0;
        stats[key].bookings = row.count || 0;
    }

    return stats;
}

function buildQuotaSummary(quotas, filledStats) {
    const keys = ['female', 'male', 'others'];
    const summary = {};
    for (const key of keys) {
        const cap = Number(quotas[`${key}Seats`]) || 0;
        const filled = filledStats[key]?.filled || 0;
        summary[key] = {
            label: key === 'female' ? 'Women' : key === 'male' ? 'Men' : 'Others',
            cap,
            filled,
            remaining: cap > 0 ? Math.max(0, cap - filled) : null,
            full: cap > 0 && filled >= cap,
        };
    }
    return summary;
}

async function getGenderRegistrationSnapshot(trek, participantGender = null) {
    const quotas = sanitizeGenderQuotas(trek?.registration?.genderQuotas || {});
    const enabled = quotas.enabled;
    const phase = getEffectiveGenderPhase(trek);

    if (!enabled) {
        return {
            enabled: false,
            phase: 'all',
            phaseLabel: PHASE_LABELS.all,
            quotas: null,
            canRegister: true,
            participantGender,
            blockReason: null,
        };
    }

    const filledStats = await aggregateGenderQuotaStats(trek._id);
    const quotaSummary = buildQuotaSummary(quotas, filledStats);
    let canRegister = true;
    let blockReason = null;

    if (participantGender) {
        if (!canGenderRegisterInPhase(participantGender, phase)) {
            canRegister = false;
            blockReason = phaseBlockMessage(phase);
        } else {
            const bucket = genderToQuotaKey(participantGender);
            const cap = Number(quotas[`${bucket}Seats`]) || 0;
            const filled = filledStats[bucket]?.filled || 0;
            if (cap > 0 && filled >= cap) {
                canRegister = false;
                blockReason = `No ${quotaSummary[bucket].label.toLowerCase()} seats left (${filled}/${cap} filled).`;
            }
        }
    }

    return {
        enabled: true,
        phase,
        phaseLabel: PHASE_LABELS[phase] || PHASE_LABELS.all,
        quotas: quotaSummary,
        canRegister: participantGender ? canRegister : null,
        participantGender,
        blockReason,
    };
}

async function assertUserCanBookTrek({ trekId, userId, people = 1 }) {
    const peopleCount = Math.max(1, Number(people) || 1);
    if (peopleCount < 1) {
        return {
            ok: false,
            status: 400,
            message: 'Select at least 1 person for this booking.',
        };
    }

    // Multiple bookings per account are allowed (same as BookMyShow-style apps).
    void trekId;
    void userId;
    return { ok: true };
}

async function validateTrekGenderRegistration({ trek, userId, formData, people = 1 }) {
    const bookingCheck = await assertUserCanBookTrek({
        trekId: trek?._id,
        userId,
        people,
    });
    if (!bookingCheck.ok) {
        return bookingCheck;
    }

    const fromForm = pickFormField(formData || {}, ['gender', 'sex', 'Gender', 'participant_gender']);
    const participantGender = normalizeGender(fromForm);

    if (!participantGender) {
        return {
            ok: false,
            status: 400,
            message: 'Please select Female or Male on the booking form.',
        };
    }

    if (!isGenderQuotasEnabled(trek)) {
        return { ok: true, participantGender };
    }

    const phase = getEffectiveGenderPhase(trek);
    if (!canGenderRegisterInPhase(participantGender, phase)) {
        return { ok: false, status: 403, message: phaseBlockMessage(phase) };
    }

    const peopleCount = Math.max(1, Number(people) || 1);

    const quotas = sanitizeGenderQuotas(trek.registration.genderQuotas);
    const filledStats = await aggregateGenderQuotaStats(trek._id);
    const bucket = genderToQuotaKey(participantGender);
    const cap = Number(quotas[`${bucket}Seats`]) || 0;
    const filled = filledStats[bucket]?.filled || 0;

    if (cap > 0 && filled + peopleCount > cap) {
        const label = bucket === 'female' ? 'women' : bucket === 'male' ? 'men' : 'others';
        return {
            ok: false,
            status: 409,
            message: `No ${label} seats left (${filled}/${cap} filled).`,
        };
    }

    return { ok: true, participantGender };
}

function sportsGenderMatchStatuses(statuses) {
    if (Array.isArray(statuses) && statuses.length) return statuses;
    return ['confirmed', 'pending'];
}

async function aggregateSportsGenderQuotaStats(eventId, { excludeId = null, statuses } = {}) {
    const match = {
        category: 'sports',
        eventId: toObjectId(eventId),
        status: { $in: sportsGenderMatchStatuses(statuses) },
    };
    if (excludeId) match._id = { $ne: toObjectId(excludeId) };

    const rows = await CategoryRegistration.aggregate([
        { $match: match },
        {
            $addFields: {
                resolvedGender: {
                    $switch: {
                        branches: [
                            { case: { $in: ['$participantGender', GENDER_VALUES] }, then: '$participantGender' },
                            { case: { $in: ['$responses.gender', GENDER_VALUES] }, then: '$responses.gender' },
                            { case: { $in: ['$responses.sex', GENDER_VALUES] }, then: '$responses.sex' },
                            {
                                case: {
                                    $in: [
                                        { $toLower: { $toString: { $ifNull: ['$responses.gender', ''] } } },
                                        ['female', 'f', 'woman', 'women'],
                                    ],
                                },
                                then: 'Female',
                            },
                            {
                                case: {
                                    $in: [
                                        { $toLower: { $toString: { $ifNull: ['$responses.gender', ''] } } },
                                        ['male', 'm', 'man', 'men'],
                                    ],
                                },
                                then: 'Male',
                            },
                        ],
                        default: null,
                    },
                },
            },
        },
        { $match: { resolvedGender: { $in: GENDER_VALUES } } },
        {
            $group: {
                _id: '$resolvedGender',
                seats: { $sum: { $max: [{ $ifNull: ['$bookingPeople', 1] }, 1] } },
                count: { $sum: 1 },
            },
        },
    ]);

    const stats = emptyGenderStats();

    for (const row of rows) {
        const key = genderToQuotaKey(row._id);
        stats[key].filled = row.seats || 0;
        stats[key].bookings = row.count || 0;
    }

    const filledTotal = stats.female.filled + stats.male.filled + stats.others.filled;
    if (filledTotal === 0) {
        const leanRegs = await CategoryRegistration.find(match)
            .select('participantGender responses bookingPeople')
            .lean();
        return countSportsGenderFromRegs(leanRegs);
    }

    return stats;
}

async function getSportsGenderRegistrationSnapshot(event, participantGender = null, { excludeId = null } = {}) {
    const quotas = sanitizeGenderQuotas(event?.registration?.genderQuotas || {});
    const enabled = quotas.enabled;
    const phase = getEffectiveGenderPhase(event);

    if (!enabled) {
        return {
            enabled: false,
            phase: 'all',
            phaseLabel: PHASE_LABELS.all,
            quotas: null,
            canRegister: true,
            participantGender,
            blockReason: null,
        };
    }

    const filledStats = await aggregateSportsGenderQuotaStats(event._id, { excludeId });
    const quotaSummary = buildQuotaSummary(quotas, filledStats);
    let canRegister = true;
    let blockReason = null;

    if (participantGender) {
        if (!canGenderRegisterInPhase(participantGender, phase)) {
            canRegister = false;
            blockReason = phaseBlockMessage(phase).replace('trek', 'event');
        } else {
            const bucket = genderToQuotaKey(participantGender);
            const cap = Number(quotas[`${bucket}Seats`]) || 0;
            const filled = filledStats[bucket]?.filled || 0;
            if (cap > 0 && filled >= cap) {
                canRegister = false;
                blockReason = `No ${quotaSummary[bucket].label.toLowerCase()} seats left (${filled}/${cap} filled).`;
            }
        }
    }

    const allCappedFull = ['female', 'male', 'others'].every((key) => {
        const cap = Number(quotas[`${key}Seats`]) || 0;
        if (cap <= 0) return true;
        return quotaSummary[key].full;
    });

    return {
        enabled: true,
        phase,
        phaseLabel: PHASE_LABELS[phase] || PHASE_LABELS.all,
        quotas: quotaSummary,
        canRegister: participantGender ? canRegister : null,
        participantGender,
        blockReason,
        allGenderSeatsFull: allCappedFull,
    };
}

async function validateSportsGenderRegistration({
    event,
    formData,
    people = 1,
    excludeId = null,
}) {
    const fromForm = pickFormField(formData || {}, ['gender', 'sex', 'Gender', 'participant_gender']);
    const participantGender = normalizeGender(fromForm);

    if (!isGenderQuotasEnabled(event)) {
        return { ok: true, participantGender: participantGender || '' };
    }

    if (!participantGender) {
        return {
            ok: false,
            status: 400,
            message: 'Please select Female or Male on the booking form.',
        };
    }

    const phase = getEffectiveGenderPhase(event);
    if (!canGenderRegisterInPhase(participantGender, phase)) {
        return {
            ok: false,
            status: 403,
            message: phaseBlockMessage(phase).replace('this trek', 'this event').replace('trek', 'event'),
        };
    }

    const peopleCount = Math.max(1, Number(people) || 1);
    const quotas = sanitizeGenderQuotas(event.registration.genderQuotas);
    const filledStats = await aggregateSportsGenderQuotaStats(event._id, { excludeId });
    const bucket = genderToQuotaKey(participantGender);
    const cap = Number(quotas[`${bucket}Seats`]) || 0;
    const filled = filledStats[bucket]?.filled || 0;

    if (cap > 0 && filled + peopleCount > cap) {
        const label = bucket === 'female' ? 'women' : bucket === 'male' ? 'men' : 'others';
        const left = Math.max(0, cap - filled);
        return {
            ok: false,
            status: 409,
            message: left > 0
                ? `Only ${left} ${label} seat${left === 1 ? '' : 's'} left.`
                : `No ${label} seats left (${filled}/${cap} filled).`,
        };
    }

    return { ok: true, participantGender };
}

module.exports = {
    GENDER_VALUES,
    GENDER_PHASES,
    PHASE_LABELS,
    normalizeGender,
    genderToQuotaKey,
    resolveParticipantGender,
    sanitizeGenderQuotas,
    sanitizeGenderPhase,
    isGenderQuotasEnabled,
    getEffectiveGenderPhase,
    canGenderRegisterInPhase,
    isGenderPhaseRestricted,
    requiresSinglePersonGenderBooking,
    phaseBlockMessage,
    aggregateGenderQuotaStats,
    buildQuotaSummary,
    getGenderRegistrationSnapshot,
    validateTrekGenderRegistration,
    assertUserCanBookTrek,
    aggregateSportsGenderQuotaStats,
    countSportsGenderFromRegs,
    getSportsGenderRegistrationSnapshot,
    validateSportsGenderRegistration,
};
