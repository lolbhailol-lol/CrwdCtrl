/** Admin-assigned home section only (no status-based auto placement). */
export function festHomeSection(fest) {
    if (fest.showOnHomeSlide) return null;
    return fest.homeSection || null;
}

const PRIORITY_FIELD = {
    fest: 'homePriority',
    trek: 'priority',
    community: 'priority',
    sport: 'homePriority',
    runclub: 'priority',
    events: 'homePriority',
};

function getCustomPagePriority(entity, targetPage, sectionSlug) {
    const match = (entity.customPageSections || []).find(
        (a) => a.page === targetPage && a.sectionSlug === sectionSlug,
    );
    return match?.priority ?? 999;
}

function entityMatchesPageSection(entity, type, targetPage, sectionSlug) {
    if (targetPage === 'home') {
        const inMulti = (entity.customPageSections || []).some(
            (a) => a.page === 'home' && a.sectionSlug === sectionSlug,
        );
        if (inMulti) return true;
        if (type === 'fest') return festHomeSection(entity) === sectionSlug;
        return entity.homeSection === sectionSlug;
    }
    return (entity.customPageSections || []).some(
        (a) => a.page === targetPage && a.sectionSlug === sectionSlug,
    );
}

export function normalizeHomeCarouselItem(type, raw, { targetPage = 'home', sectionSlug } = {}) {
    const field = PRIORITY_FIELD[type];
    let priority = raw[field] ?? raw.priority ?? raw.homePriority ?? 999;
    if (targetPage !== 'home' && sectionSlug) {
        priority = getCustomPagePriority(raw, targetPage, sectionSlug);
    }

    return {
        ...raw,
        _type: type,
        _id: raw._id || raw.id,
        _priority: priority,
        _title: type === 'fest' ? (raw.festName || 'Untitled')
            : type === 'trek' ? (raw.trekName || 'Untitled')
            : type === 'sport' ? (raw.title || 'Untitled')
            : type === 'events' ? (raw.title || 'Untitled')
            : (raw.name || 'Untitled'),
        _image: type === 'fest' ? raw.coverImage
            : type === 'trek' ? (raw.coverImage || raw.images?.[0])
            : type === 'sport' ? (raw.images?.[0] || raw.coverImage)
            : type === 'events' ? (raw.poster || raw.banner)
            : raw.coverImage,
        _subtitle: type === 'fest' ? (raw.collegeName || '')
            : type === 'trek' ? (raw.city || '')
            : type === 'sport' ? (raw.city || raw.sportType || '')
            : type === 'events' ? (raw.city || raw.organizer || '')
            : (raw.basedIn || raw.organizer || ''),
    };
}

export function buildHomeCarouselItems(fests, treks, communities, section, sportsEvents = [], runClubs = [], eventShows = []) {
    return buildPageCarouselItems(fests, treks, communities, 'home', section, sportsEvents, runClubs, eventShows);
}

export function buildPageCarouselItems(
    fests,
    treks,
    communities,
    targetPage,
    sectionSlug,
    sportsEvents = [],
    runClubs = [],
    eventShows = [],
) {
    const byPriority = (a, b) => {
        if (a._priority !== b._priority) return a._priority - b._priority;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    };

    const opts = { targetPage, sectionSlug };

    return [
        ...(fests || []).filter((f) => entityMatchesPageSection(f, 'fest', targetPage, sectionSlug))
            .map((f) => normalizeHomeCarouselItem('fest', f, opts)),
        ...(treks || []).filter((t) => entityMatchesPageSection(t, 'trek', targetPage, sectionSlug))
            .map((t) => normalizeHomeCarouselItem('trek', t, opts)),
        ...(communities || []).filter((c) => entityMatchesPageSection(c, 'community', targetPage, sectionSlug))
            .map((c) => normalizeHomeCarouselItem('community', c, opts)),
        ...(runClubs || []).filter((c) => entityMatchesPageSection(c, 'runclub', targetPage, sectionSlug))
            .map((c) => normalizeHomeCarouselItem('runclub', c, opts)),
        ...(sportsEvents || []).filter((s) => entityMatchesPageSection(s, 'sport', targetPage, sectionSlug))
            .map((s) => normalizeHomeCarouselItem('sport', s, opts)),
        ...(eventShows || []).filter((t) => entityMatchesPageSection(t, 'events', targetPage, sectionSlug))
            .map((t) => normalizeHomeCarouselItem('events', t, opts)),
    ].sort(byPriority);
}
