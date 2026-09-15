const FestOrganizer = require('../model/fest_organizer_model');
const { normalizeUsername } = require('./normalizeUsername');

const FEST_SELECT = 'festName collegeName city festDates category status coverImage slug isApproved';

async function getOrganizerFests(organizer) {
    const ids = organizer?.assignedFestIds || [];
    if (!ids.length) return [];
    return FestOrganizer.find({ _id: { $in: ids } })
        .select(FEST_SELECT)
        .sort({ createdAt: -1 })
        .lean();
}

function organizerCanAccessFest(organizer, festId) {
    if (!organizer || !festId) return false;
    return (organizer.assignedFestIds || []).some((id) => String(id) === String(festId));
}

module.exports = {
    normalizeUsername,
    getOrganizerFests,
    organizerCanAccessFest,
    FEST_SELECT,
};
