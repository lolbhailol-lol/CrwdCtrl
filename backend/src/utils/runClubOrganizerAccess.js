const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');
const { findByIdOrSlug } = require('./slug');
const { normalizeUsername } = require('./normalizeUsername');

const EVENT_SELECT =
    'title city venue eventDate status maxParticipants registration.status registration.mode registrationFee runClubId sportType distance runCategory coverImage reportingTime';

async function getOrganizerEvents(organizer) {
    if (!organizer?.runClubId) return [];

    return SportsEvent.find({
        runClubId: organizer.runClubId,
        sportType: 'run_club',
    })
        .select(EVENT_SELECT)
        .sort({ eventDate: -1, createdAt: -1 })
        .lean();
}

/**
 * @returns {{ allowed: boolean, eventId: string|null }}
 * Resolves URL slug → real ObjectId so later findById calls never cast-fail.
 */
async function organizerCanAccessEvent(organizer, eventId) {
    if (!organizer || !eventId || !organizer.runClubId) {
        return { allowed: false, eventId: null };
    }

    const event = await findByIdOrSlug(SportsEvent, eventId, {
        pickName: (row) => row.title || '',
        lean: true,
        select: 'runClubId sportType title',
    });
    if (!event || event.sportType !== 'run_club') {
        return { allowed: false, eventId: null };
    }

    const allowed = String(event.runClubId) === String(organizer.runClubId);
    return { allowed, eventId: allowed ? String(event._id) : null };
}

async function getOrganizerRunClub(organizer) {
    if (!organizer?.runClubId) return null;
    return RunClub.findById(organizer.runClubId)
        .select('name basedIn aboutUs runCategories contactPhone contactInstagram coverImage status')
        .lean();
}

module.exports = {
    normalizeUsername,
    getOrganizerEvents,
    organizerCanAccessEvent,
    getOrganizerRunClub,
};
