export function toSlug(value = '') {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export function isObjectId(value = '') {
    return OBJECT_ID_RE.test(String(value || '').trim());
}

/** Routes that auto-replace legacy Mongo IDs with name slugs in the address bar. */
const LEGACY_SLUG_ROUTE_PATTERNS = [
    /^\/trek\/([^/]+)(?:\/book)?$/,
    /^\/treks\/community\/([^/]+)$/,
    /^\/sports\/run-club\/([^/]+)$/,
    /^\/events\/community\/([^/]+)$/,
    /^\/sports\/run\/([^/]+)(?:\/book)?$/,
    /^\/events\/community-event\/([^/]+)(?:\/book)?$/,
    /^\/events\/([^/]+)(?:\/register)?$/,
    /^\/view-details\/([^/]+)$/,
    /^\/fest\/([^/]+)\/register(?:\/([^/]+))?$/,
    /^\/competitions-view-details\/([^/]+)$/,
    /^\/competition-registration\/([^/]+)$/,
];

export function isLegacyIdSlugPath(pathname = '') {
    const path = String(pathname || '').split('?')[0];
    return LEGACY_SLUG_ROUTE_PATTERNS.some((pattern) => {
        const match = path.match(pattern);
        if (!match) return false;
        return match.slice(1).some((part) => part && isObjectId(part));
    });
}

/** Wait for ObjectId → slug (or ?competition= → /register/:slug) before sending GA page_path. */
export function shouldDelayAnalyticsPageView(pathname = '', search = '') {
    const path = String(pathname || '').split('?')[0];
    if (isLegacyIdSlugPath(path)) return true;
    const query = String(search || '').replace(/^\?/, '');
    const params = new URLSearchParams(query);
    return /^\/fest\/[^/]+\/register$/.test(path) && Boolean(params.get('competition'));
}

function pickId(entity = {}) {
    return entity.id || entity._id || '';
}

/**
 * True when entity id or name-slug matches the route :idOrSlug param.
 * Prevents flashing the previous (or demo) entity while a new one loads.
 */
export function entityMatchesRouteParam(entity, routeParam, nameKeys = ['name', 'title']) {
    if (!entity || !routeParam) return false;
    const param = String(routeParam);
    const paramSlug = toSlug(param);
    const eid = String(pickId(entity) || '');
    if (eid && eid === param) return true;
    if (entity.slug && toSlug(entity.slug) === paramSlug) return true;
    const previous = Array.isArray(entity.previousSlugs) ? entity.previousSlugs : [];
    if (previous.some((s) => toSlug(s) === paramSlug)) return true;
    for (const key of nameKeys) {
        const slug = toSlug(entity[key] || '');
        if (slug && slug === paramSlug) return true;
    }
    return false;
}

export function festPath(fest = {}) {
    const id = pickId(fest);
    const slug = toSlug(fest.festName || fest.title || '');
    return `/view-details/${slug || id}`;
}

function competitionPathToken(competition) {
    if (competition == null || competition === '') return '';
    if (typeof competition === 'string' || typeof competition === 'number') {
        const token = String(competition).trim();
        if (!token) return '';
        return isObjectId(token) ? token : (toSlug(token) || token);
    }
    const id = pickId(competition);
    const slug = toSlug(competition.slug || competition.name || competition.title || '');
    return slug || id || '';
}

export function festRegisterPath(fest = {}, competition = null) {
    const id = pickId(fest);
    const slug = toSlug(fest.festName || fest.title || '');
    const base = `/fest/${slug || id}/register`;
    const token = competitionPathToken(competition);
    return token ? `${base}/${token}` : base;
}

/** Parse /fest/:festId/register and /fest/:festId/register/:competition (plus legacy ?competition=). */
export function parseFestRegisterPath(href = '') {
    const raw = String(href || '');
    try {
        const [path, query = ''] = raw.split('?');
        const match = path.match(/^\/fest\/([^/]+)\/register(?:\/([^/]+))?\/?$/);
        if (!match) return null;
        const params = new URLSearchParams(query);
        return {
            festId: match[1],
            competitionSlug: match[2] || params.get('competition') || '',
            path,
            query,
        };
    } catch {
        return null;
    }
}

export function trekPath(trek = {}) {
    const id = pickId(trek);
    const persisted = toSlug(trek.slug || '');
    if (persisted) return `/trek/${persisted}`;
    // Prefer Mongo id — never emit a derived title slug (collisions / renames break shares)
    return id ? `/trek/${id}` : '';
}

export function communityPath(community = {}) {
    const id = pickId(community);
    const persisted = toSlug(community.slug || '');
    if (persisted) return `/treks/community/${persisted}`;
    if (id) return `/treks/community/${id}`;
    const slug = toSlug(community.name || community.title || '');
    return `/treks/community/${slug || ''}`;
}

export function eventCommunityPath(club = {}) {
    const id = pickId(club);
    const slug = toSlug(club.slug || club.name || club.title || '');
    return `/events/community/${slug || id}`;
}

export function runClubPath(club = {}) {
    const id = pickId(club);
    const slug = toSlug(club.slug || club.name || club.title || '');
    if (club.listingHub === 'events') {
        return eventCommunityPath(club);
    }
    return `/sports/run-club/${slug || id}`;
}

export function eventCommunityEventPath(run = {}) {
    const id = pickId(run);
    const persisted = toSlug(run.slug || '');
    if (persisted) return `/events/community-event/${persisted}`;
    return id ? `/events/community-event/${id}` : '';
}

export function sportRunPath(run = {}) {
    if (run?.listingHub === 'events' || run?.runClub?.listingHub === 'events' || run?.runClubId?.listingHub === 'events') {
        return eventCommunityEventPath(run);
    }
    const id = pickId(run);
    const persisted = toSlug(run.slug || '');
    if (persisted) return `/sports/run/${persisted}`;
    // Prefer Mongo id — never emit a derived title slug (collisions / renames break shares)
    return id ? `/sports/run/${id}` : '';
}

export function eventShowPath(show = {}) {
    const id = pickId(show);
    const slug = toSlug(show.title || show.displayName || '');
    return `/events/${slug || id}`;
}

export function competitionPath(competition = {}) {
    const id = pickId(competition);
    const slug = toSlug(competition.name || competition.title || '');
    return `/competitions-view-details/${slug || id}`;
}

export function competitionRegistrationPath(competition = {}) {
    const id = pickId(competition);
    const slug = toSlug(competition.name || competition.title || '');
    return `/competition-registration/${slug || id}`;
}

