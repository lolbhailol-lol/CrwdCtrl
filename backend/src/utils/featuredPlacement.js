const FestOrganizer = require('../model/fest_organizer_model');
const EventShow = require('../model/event_show_model');

const HERO_ENTITY_TYPES = new Set(['fest', 'events', 'trek', 'community', 'sport', 'runclub']);

/** Clear home hero slides from every supported entity type. */
async function clearAllHomeHeroSlides() {
    const Trek = require('../model/trek_model');
    const TrekCommunity = require('../model/trek_community_model');
    const SportsEvent = require('../model/sports_model');
    const RunClub = require('../model/run_club_model');
    await Promise.all([
        FestOrganizer.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        EventShow.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        Trek.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        TrekCommunity.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        SportsEvent.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        RunClub.updateMany(
            { $or: [{ showOnHomeSlide: true }, { homeSection: 'slide' }] },
            { $set: { showOnHomeSlide: false, homeSection: null } },
        ),
    ]);
}

/**
 * Pin exactly one item to the home hero banner (moving slide).
 * Clears any previous hero slides first.
 */
async function setHomeHeroSlide(entityType, entityId) {
    if (!entityId) {
        await clearAllHomeHeroSlides();
        return null;
    }
    if (!HERO_ENTITY_TYPES.has(entityType)) {
        throw new Error('Unsupported hero banner entity type');
    }

    await clearAllHomeHeroSlides();

    const fields = { showOnHomeSlide: true, homePriority: 1 };
    if (entityType === 'fest') {
        return FestOrganizer.findByIdAndUpdate(entityId, { $set: { ...fields, homeSection: null } }, { new: true });
    }
    if (entityType === 'events') {
        return EventShow.findByIdAndUpdate(entityId, { $set: { ...fields, homeSection: null } }, { new: true });
    }
    if (entityType === 'trek') {
        const Trek = require('../model/trek_model');
        return Trek.findByIdAndUpdate(entityId, { $set: { showOnHomeSlide: true, priority: 1 } }, { new: true });
    }
    if (entityType === 'community') {
        const TrekCommunity = require('../model/trek_community_model');
        return TrekCommunity.findByIdAndUpdate(entityId, { $set: { showOnHomeSlide: true, priority: 1 } }, { new: true });
    }
    if (entityType === 'sport') {
        const SportsEvent = require('../model/sports_model');
        return SportsEvent.findByIdAndUpdate(entityId, { $set: fields }, { new: true });
    }
    const RunClub = require('../model/run_club_model');
    return RunClub.findByIdAndUpdate(
        entityId,
        { $set: { showOnHomeSlide: true, homeSection: null, priority: 1 } },
        { new: true },
    );
}

/**
 * Pin one item as the lead card in the home "Ongoing Events" (trending) section.
 */
async function setHomeFeaturedExperience(entityType, entityId) {
    if (!entityId) return null;

    const fields = { homeSection: 'trending', homePriority: 1, showOnHomeSlide: false };

    switch (entityType) {
        case 'fest':
            return FestOrganizer.findByIdAndUpdate(entityId, { $set: fields }, { new: true });
        case 'events':
            return EventShow.findByIdAndUpdate(entityId, { $set: fields }, { new: true });
        case 'trek': {
            const Trek = require('../model/trek_model');
            return Trek.findByIdAndUpdate(entityId, { $set: { homeSection: 'trending', priority: 1 } }, { new: true });
        }
        case 'community': {
            const TrekCommunity = require('../model/trek_community_model');
            return TrekCommunity.findByIdAndUpdate(entityId, { $set: { homeSection: 'trending', priority: 1 } }, { new: true });
        }
        case 'sport': {
            const SportsEvent = require('../model/sports_model');
            return SportsEvent.findByIdAndUpdate(entityId, { $set: fields }, { new: true });
        }
        case 'runclub': {
            const RunClub = require('../model/run_club_model');
            return RunClub.findByIdAndUpdate(entityId, { $set: { homeSection: 'trending', priority: 1 } }, { new: true });
        }
        default:
            throw new Error(`Unsupported entity type: ${entityType}`);
    }
}

/** When an event is assigned to /events hero banner, clear other hero assignments. */
async function setExclusiveEventsPageHero(eventId) {
    if (!eventId) return;
    await EventShow.updateMany(
        { pageSection: 'hero', _id: { $ne: eventId } },
        { $set: { pageSection: null } },
    );
    await EventShow.findByIdAndUpdate(eventId, { $set: { pageSection: 'hero', pagePriority: 1 } });
}

/** Apply showOnHomeSlide on a fest or event — clears other hero slides when enabling. */
async function applyShowOnHomeSlide(entityType, entityId, enabled) {
    if (!enabled) {
        if (entityType === 'fest') {
            return FestOrganizer.findByIdAndUpdate(entityId, { $set: { showOnHomeSlide: false } }, { new: true });
        }
        if (entityType === 'events') {
            return EventShow.findByIdAndUpdate(entityId, { $set: { showOnHomeSlide: false } }, { new: true });
        }
        return null;
    }
    return setHomeHeroSlide(entityType, entityId);
}

module.exports = {
    HERO_ENTITY_TYPES,
    clearAllHomeHeroSlides,
    setHomeHeroSlide,
    setHomeFeaturedExperience,
    setExclusiveEventsPageHero,
    applyShowOnHomeSlide,
};
