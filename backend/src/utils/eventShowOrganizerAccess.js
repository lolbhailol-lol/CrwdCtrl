const EventShow = require('../model/event_show_model');
const { findByIdOrSlug } = require('./slug');
const { normalizeUsername } = require('./normalizeUsername');

const EVENT_SELECT = [
    'title',
    'displayName',
    'slug',
    'type',
    'city',
    'venue',
    'timing',
    'status',
    'ticketPrice',
    'pricingMode',
    'tiers',
    'platformFeePercent',
    'registration.status',
    'registration.mode',
    'coverImages',
    'poster',
    'organizer',
].join(' ');

function assignedIds(organizer) {
    return (organizer?.assignedEventShowIds || [])
        .map((id) => String(id))
        .filter(Boolean);
}

async function getOrganizerEvents(organizer) {
    const ids = assignedIds(organizer);
    if (!ids.length) return [];

    return EventShow.find({ _id: { $in: ids } })
        .select(EVENT_SELECT)
        .sort({ 'timing.start': -1, createdAt: -1 })
        .lean();
}

/**
 * @returns {{ allowed: boolean, eventShowId: string|null }}
 */
async function organizerCanAccessEvent(organizer, eventIdOrSlug) {
    if (!organizer || !eventIdOrSlug) {
        return { allowed: false, eventShowId: null };
    }

    const ids = assignedIds(organizer);
    if (!ids.length) return { allowed: false, eventShowId: null };

    const event = await findByIdOrSlug(EventShow, eventIdOrSlug, {
        pickName: (row) => row.displayName || row.title || '',
        lean: true,
        select: '_id title displayName',
    });
    if (!event) return { allowed: false, eventShowId: null };

    const allowed = ids.includes(String(event._id));
    return { allowed, eventShowId: allowed ? String(event._id) : null };
}

module.exports = {
    normalizeUsername,
    getOrganizerEvents,
    organizerCanAccessEvent,
    EVENT_SELECT,
};
