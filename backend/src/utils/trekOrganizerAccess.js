const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const { normalizeUsername } = require('./normalizeUsername');

const TREK_SELECT = 'trekName city trekDate dateLabel status maxParticipants trekBatches registration.status communityId';

async function getOrganizerTreks(organizer) {
    if (organizer?.communityId) {
        return Trek.find({ communityId: organizer.communityId })
            .select(TREK_SELECT)
            .sort({ trekDate: -1, createdAt: -1 })
            .lean();
    }

    const ids = organizer?.assignedTrekIds || [];
    if (ids.length) {
        return Trek.find({ _id: { $in: ids } })
            .select(TREK_SELECT)
            .sort({ trekDate: -1, createdAt: -1 })
            .lean();
    }

    return [];
}

async function organizerCanAccessTrek(organizer, trekId) {
    if (!organizer || !trekId) return false;

    const trek = await Trek.findById(trekId).select('communityId').lean();
    if (!trek) return false;

    if (organizer.communityId && trek.communityId) {
        return String(organizer.communityId) === String(trek.communityId);
    }

    return (organizer.assignedTrekIds || []).some((id) => String(id) === String(trekId));
}

async function getOrganizerCommunity(organizer) {
    if (!organizer?.communityId) return null;
    return TrekCommunity.findById(organizer.communityId)
        .select('name basedIn aboutUs trekCategories contactPhone contactInstagram contacts status coverImage')
        .lean();
}

module.exports = {
    normalizeUsername,
    getOrganizerTreks,
    organizerCanAccessTrek,
    getOrganizerCommunity,
};
