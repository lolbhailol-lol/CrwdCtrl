const SportsEvent = require('../model/sports_model');
const RunClub = require('../model/run_club_model');

const EVENT_SELECT =
    'title city eventDate status maxParticipants registration.status registrationFee runClubId sportType distance runCategory';

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

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

async function organizerCanAccessEvent(organizer, eventId) {
    if (!organizer || !eventId || !organizer.runClubId) return false;

    const event = await SportsEvent.findById(eventId).select('runClubId sportType').lean();
    if (!event || event.sportType !== 'run_club') return false;

    return String(event.runClubId) === String(organizer.runClubId);
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
