/**
 * Fest organizer portal page ACL — shared by middleware + Access APIs.
 */

const PORTAL_ROLES = ['organizer', 'cohead', 'desk'];

const PAGE_CATALOG = [
    { key: 'overview', label: 'Overview', navLabels: ['Overview'] },
    { key: 'edit-listing', label: 'Edit fest & comps', navLabels: ['Edit fest & comps'] },
    { key: 'fest-day-desk', label: 'Fest Day Desk', navLabels: ['Fest Day Desk'] },
    { key: 'competitions', label: 'Competitions', navLabels: ['Competitions'] },
    { key: 'participants', label: 'Participants', navLabels: ['Participants'] },
    { key: 'check-in', label: 'Check-in', navLabels: ['Check-in'] },
    { key: 'auditorium', label: 'Auditorium', navLabels: [] },
    { key: 'coupons', label: 'Coupons', navLabels: ['Coupons'] },
    { key: 'revenue', label: 'Revenue', navLabels: ['Revenue'] },
    { key: 'connect', label: 'Connect', navLabels: ['Connect'] },
    { key: 'access', label: 'Access', navLabels: ['Access'] },
];

const PAGE_KEYS = PAGE_CATALOG.map((p) => p.key);
const PAGE_KEY_SET = new Set(PAGE_KEYS);

/** API path matchers relative to fest routes (req.path on fest router). */
const PAGE_ROUTE_MATCHERS = {
    overview: [
        { methods: ['GET'], re: /\/dashboard$/ },
    ],
    'edit-listing': [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/details$/ },
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/competitions(\/|$)/ },
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/live-updates/ },
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/pro-show/ },
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/leads/ },
    ],
    'fest-day-desk': [
        { methods: ['GET', 'POST'], re: /\/fest-day-desk(\/|$)/ },
    ],
    competitions: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/competitions(\/|$)/ },
    ],
    participants: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/participants(\/|$)/ },
    ],
    'check-in': [
        { methods: ['GET', 'POST'], re: /\/checkin(\/|$)/ },
    ],
    auditorium: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/auditorium(\/|$)/ },
    ],
    coupons: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/coupons(\/|$)/ },
    ],
    revenue: [
        { methods: ['GET'], re: /\/dashboard$/ },
        { methods: ['GET'], re: /\/notifications\/contacts$/ },
    ],
    connect: [
        { methods: ['GET', 'POST'], re: /\/notifications(\/|$)/ },
    ],
    access: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/access(\/|$)/ },
    ],
};

const DESK_ROUTE_ALLOWED = [
    { method: 'GET', re: /\/fest-day-desk$/ },
    { method: 'POST', re: /\/fest-day-desk\/registrations$/ },
    { method: 'POST', re: /\/fest-day-desk\/bundles$/ },
    { method: 'POST', re: /\/fest-day-desk\/orders\/[^/]+\/refresh$/ },
];

function normalizePortalRole(role) {
    const r = String(role || 'organizer').trim().toLowerCase();
    if (r === 'desk') return 'desk';
    if (r === 'cohead') return 'cohead';
    return 'organizer';
}

function sanitizeAllowedPages(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        const key = String(item || '').trim().toLowerCase();
        if (!PAGE_KEY_SET.has(key) || seen.has(key)) continue;
        // Co-heads must never self-grant Access management
        if (key === 'access') continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

function isFullOrganizer(organizer) {
    return normalizePortalRole(organizer?.portalRole) === 'organizer';
}

function organizerHasPage(organizer, pageKey) {
    const role = normalizePortalRole(organizer?.portalRole);
    if (role === 'organizer') return true;
    if (role === 'desk') return pageKey === 'fest-day-desk';
    const pages = Array.isArray(organizer?.allowedPages) ? organizer.allowedPages : [];
    return pages.map((p) => String(p).toLowerCase()).includes(String(pageKey).toLowerCase());
}

function routeAllowedForPages(method, path, pages) {
    const m = String(method || 'GET').toUpperCase();
    const p = String(path || '');
    const granted = new Set((pages || []).map((x) => String(x).toLowerCase()));
    for (const pageKey of granted) {
        const matchers = PAGE_ROUTE_MATCHERS[pageKey] || [];
        for (const rule of matchers) {
            if (!rule.methods.includes(m)) continue;
            if (rule.re.test(p)) return true;
        }
    }
    return false;
}

function deskRouteAllowed(method, path) {
    const m = String(method || 'GET').toUpperCase();
    const p = String(path || '');
    return DESK_ROUTE_ALLOWED.some((rule) => rule.method === m && rule.re.test(p));
}

/**
 * Whether this fest-scoped request is allowed for the organizer account.
 */
function festRouteAllowedForOrganizer(organizer, method, path) {
    const role = normalizePortalRole(organizer?.portalRole);
    if (role === 'organizer') return true;
    if (role === 'desk') return deskRouteAllowed(method, path);
    return routeAllowedForPages(method, path, organizer?.allowedPages);
}

function publicOrganizerFields(organizer) {
    const portalRole = normalizePortalRole(organizer?.portalRole);
    const allowedPages = portalRole === 'cohead'
        ? sanitizeAllowedPages(organizer?.allowedPages)
        : portalRole === 'desk'
            ? ['fest-day-desk']
            : [...PAGE_KEYS];
    return {
        portalRole,
        allowedPages,
        canManageAccess: portalRole === 'organizer',
    };
}

function navPageKeyForLabel(label) {
    const hit = PAGE_CATALOG.find((p) => (p.navLabels || []).includes(label));
    return hit?.key || null;
}

module.exports = {
    PORTAL_ROLES,
    PAGE_CATALOG,
    PAGE_KEYS,
    PAGE_ROUTE_MATCHERS,
    normalizePortalRole,
    sanitizeAllowedPages,
    isFullOrganizer,
    organizerHasPage,
    festRouteAllowedForOrganizer,
    deskRouteAllowed,
    publicOrganizerFields,
    navPageKeyForLabel,
};
