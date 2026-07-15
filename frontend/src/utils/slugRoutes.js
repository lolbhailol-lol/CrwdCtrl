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
    /^\/sports\/run\/([^/]+)(?:\/book)?$/,
    /^\/events\/([^/]+)(?:\/register)?$/,
    /^\/view-details\/([^/]+)$/,
    /^\/fest\/([^/]+)\/register$/,
    /^\/competitions-view-details\/([^/]+)$/,
    /^\/competition-registration\/([^/]+)$/,
];

export function isLegacyIdSlugPath(pathname = '') {
    const path = String(pathname || '').split('?')[0];
    return LEGACY_SLUG_ROUTE_PATTERNS.some((pattern) => {
        const match = path.match(pattern);
        return match ? isObjectId(match[1]) : false;
    });
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
    const eid = String(pickId(entity) || '');
    if (eid && eid === param) return true;
    for (const key of nameKeys) {
        const slug = toSlug(entity[key] || '');
        if (slug && slug === param) return true;
    }
    return false;
}

export function festPath(fest = {}) {
    const id = pickId(fest);
    const slug = toSlug(fest.festName || fest.title || '');
    return `/view-details/${slug || id}`;
}

export function festRegisterPath(fest = {}) {
    const id = pickId(fest);
    const slug = toSlug(fest.festName || fest.title || '');
    return `/fest/${slug || id}/register`;
}

export function trekPath(trek = {}) {
    const id = pickId(trek);
    const slug = toSlug(trek.trekName || trek.title || '');
    return `/trek/${slug || id}`;
}

export function communityPath(community = {}) {
    const id = pickId(community);
    const slug = toSlug(community.name || community.title || '');
    return `/treks/community/${slug || id}`;
}

export function runClubPath(club = {}) {
    const id = pickId(club);
    const slug = toSlug(club.name || club.title || '');
    return `/sports/run-club/${slug || id}`;
}

export function sportRunPath(run = {}) {
    const id = pickId(run);
    const slug = toSlug(run.title || run.name || '');
    return `/sports/run/${slug || id}`;
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

