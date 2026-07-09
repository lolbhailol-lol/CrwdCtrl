const FestOrganizer = require('../model/fest_organizer_model');
const EventShow = require('../model/event_show_model');

const HERO_ENTITY_TYPES = new Set(['fest', 'events']);

/** Clear home hero slides from every fest and event show. */
async function clearAllHomeHeroSlides() {
    await Promise.all([
        FestOrganizer.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
        EventShow.updateMany({ showOnHomeSlide: true }, { $set: { showOnHomeSlide: false } }),
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
        throw new Error('Hero banner only supports fests and events');
    }

    await clearAllHomeHeroSlides();

    if (entityType === 'fest') {
        return FestOrganizer.findByIdAndUpdate(
            entityId,
            { $set: { showOnHomeSlide: true, homeSection: null, homePriority: 1 } },
            { new: true },
        );
    }

    return EventShow.findByIdAndUpdate(
        entityId,
        { $set: { showOnHomeSlide: true, homeSection: null, homePriority: 1 } },
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
