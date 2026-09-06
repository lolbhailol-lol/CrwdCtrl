import { getCoverImageUrl, resolveCoverImage } from './coverImages';

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

/** Prefer community name for trek cards (populated object or lookup map). */
export function resolveTrekCommunityName(trek, communitiesById) {
    if (!trek) return '';
    const raw = trek.communityId;
    if (raw && typeof raw === 'object') {
        return String(raw.name || raw.title || '').trim();
    }
    if (raw != null && communitiesById) {
        const hit = communitiesById.get(String(raw._id || raw));
        if (hit) return String(hit.name || hit.title || '').trim();
    }
    return String(trek.communityName || '').trim();
}

function buildCommunitiesById(communities = []) {
    const map = new Map();
    for (const c of communities) {
        if (c?._id != null) map.set(String(c._id), c);
        if (c?.id != null) map.set(String(c.id), c);
    }
    return map;
}

export function normalizeHomeCarouselItem(type, raw, { targetPage = 'home', sectionSlug, communitiesById } = {}) {
    const field = PRIORITY_FIELD[type];
    let priority = raw[field] ?? raw.priority ?? raw.homePriority ?? 999;
    if (targetPage !== 'home' && sectionSlug) {
        priority = getCustomPagePriority(raw, targetPage, sectionSlug);
    }

    const trekCommunityName = type === 'trek'
        ? resolveTrekCommunityName(raw, communitiesById)
        : '';

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
        _image: (() => {
            const preset = type === 'sport' || type === 'events' ? 'cardWide' : 'cardPortrait';
            return (
                getCoverImageUrl(raw, preset)
                || resolveCoverImage(raw, preset)
                || (type === 'fest' ? raw.coverImage
                    : type === 'trek' ? (raw.coverImage || raw.images?.[0])
                    : type === 'sport' ? (raw.images?.[0] || raw.coverImage)
                    : type === 'events' ? (raw.poster || raw.banner)
                    : raw.coverImage)
            );
        })(),
        // Treks show community name (not city) so section cards identify which community they belong to
        _subtitle: type === 'fest' ? (raw.collegeName || '')
            : type === 'trek' ? (trekCommunityName || raw.city || '')
            : type === 'sport' ? (raw.city || raw.sportType || '')
            : type === 'events' ? (raw.city || raw.organizer || '')
            : (raw.basedIn || raw.organizer || ''),
        ...(type === 'trek' && trekCommunityName ? { communityName: trekCommunityName } : {}),
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

    const communitiesById = buildCommunitiesById(communities);
    const opts = { targetPage, sectionSlug, communitiesById };

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
