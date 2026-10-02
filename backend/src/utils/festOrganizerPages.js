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
    { key: 'auditorium', label: 'Auditorium', navLabels: ['Auditorium'] },
    /** Granted only through the auditorium competition's `gate` section, never as a whole page. */
    { key: 'auditorium-gate', label: 'Auditorium gate', navLabels: ['Auditorium gate'] },
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
        { methods: ['GET', 'POST', 'DELETE'], re: /\/fest-day-desk(\/|$)/ },
    ],
    competitions: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/competitions(\/|$)/ },
    ],
    participants: [
        { methods: ['GET', 'PATCH', 'PUT', 'POST', 'DELETE'], re: /\/participants(\/|$)/ },
    ],
    'check-in': [
        { methods: ['GET', 'POST'], re: /\/checkin(\/|$)/ },
        { methods: ['GET'], re: /\/participants(\/lookup)?$/ },
        { methods: ['GET'], re: /\/auditorium\/(gate|lookup)$/ },
    ],
    'auditorium-gate': [
        { methods: ['POST'], re: /\/checkin$/ },
        { methods: ['GET'], re: /\/checkin\/stats$/ },
        { methods: ['GET'], re: /\/auditorium\/(gate|lookup)$/ },
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
    { method: 'DELETE', re: /\/fest-day-desk\/drafts$/ },
    { method: 'DELETE', re: /\/fest-day-desk\/expired$/ },
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
        if (key === 'auditorium-gate') continue;
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
    const access = sanitizeCompetitionAccess(organizer?.competitionAccess);
    const pages = access.length ? pagesForCompetitionAccess(access) : organizer?.allowedPages;
    return routeAllowedForPages(method, path, pages);
}

/** Per-competition sections a co-head can be granted. */
const COMPETITION_SECTIONS = [
    { key: 'participants', label: 'Participants', pages: ['participants', 'competitions', 'overview'] },
    { key: 'desk', label: 'Desk registration', pages: ['fest-day-desk'] },
    { key: 'scanner', label: 'Scanner', pages: ['check-in'] },
    { key: 'revenue', label: 'Revenue', pages: ['revenue', 'overview'] },
    /** Auditorium competition only — gate scanner limited to `categories`. */
    { key: 'gate', label: 'Auditorium gate', pages: ['auditorium-gate'] },
];
const COMPETITION_SECTION_KEYS = new Set(COMPETITION_SECTIONS.map((s) => s.key));

function sanitizeCategoryIds(raw) {
    return [...new Set((Array.isArray(raw) ? raw : [])
        .map((c) => String(c || '').trim())
        .filter((c) => /^[A-Za-z0-9_-]{1,40}$/.test(c)))];
}

function sanitizeCompetitionAccess(raw) {
    if (!Array.isArray(raw)) return [];
    const byCompetition = new Map();
    for (const item of raw) {
        const festId = String(item?.festId || '').trim();
        const competitionId = String(item?.competitionId || '').trim();
        if (!/^[a-f0-9]{24}$/i.test(festId) || !/^[a-f0-9]{24}$/i.test(competitionId)) continue;
        let sections = [...new Set((Array.isArray(item.sections) ? item.sections : [])
            .map((s) => String(s || '').trim().toLowerCase())
            .filter((s) => COMPETITION_SECTION_KEYS.has(s)))];
        // The gate never mixes with competition sections on the same entry.
        if (sections.includes('gate')) sections = ['gate'];
        if (!sections.length) continue;
        const entry = { festId, competitionId, sections };
        if (sections[0] === 'gate') entry.categories = sanitizeCategoryIds(item.categories);
        byCompetition.set(competitionId, entry);
    }
    return [...byCompetition.values()];
}

function pagesForCompetitionAccess(access) {
    const pages = new Set();
    for (const entry of access || []) {
        for (const key of entry.sections || []) {
            const section = COMPETITION_SECTIONS.find((s) => s.key === key);
            (section?.pages || []).forEach((p) => pages.add(p));
        }
    }
    return PAGE_KEYS.filter((key) => pages.has(key));
}

/**
 * Competition scope for a fest, or null when the account is not competition-limited.
 * `gateCategories` maps an auditorium competition id to its allowed category ids (null = all).
 * @returns {null | { all: Set<string>, participants: Set<string>, desk: Set<string>, scanner: Set<string>, revenue: Set<string>, gate: Set<string>, gateCategories: Map<string, Set<string>|null> }}
 */
function getCompetitionScope(organizer, festId) {
    if (normalizePortalRole(organizer?.portalRole) !== 'cohead') return null;
    const access = sanitizeCompetitionAccess(
        (Array.isArray(organizer?.competitionAccess) ? organizer.competitionAccess : [])
            .map((entry) => ({ ...entry, festId: String(entry?.festId || ''), competitionId: String(entry?.competitionId || '') })),
    );
    if (!access.length) return null;
    const scope = {
        all: new Set(),
        participants: new Set(),
        desk: new Set(),
        scanner: new Set(),
        revenue: new Set(),
        gate: new Set(),
        gateCategories: new Map(),
    };
    for (const entry of access) {
        if (String(entry.festId) !== String(festId)) continue;
        const id = String(entry.competitionId);
        for (const key of entry.sections || []) {
            if (scope[key]) scope[key].add(id);
        }
        if (entry.sections.includes('gate')) {
            scope.gateCategories.set(id, entry.categories?.length ? new Set(entry.categories) : null);
        } else {
            scope.all.add(id);
        }
    }
    return scope;
}

function publicOrganizerFields(organizer) {
    const portalRole = normalizePortalRole(organizer?.portalRole);
    const competitionAccess = portalRole === 'cohead'
        ? sanitizeCompetitionAccess(organizer?.competitionAccess)
        : [];
    const allowedPages = portalRole === 'cohead'
        ? (competitionAccess.length ? pagesForCompetitionAccess(competitionAccess) : sanitizeAllowedPages(organizer?.allowedPages))
        : portalRole === 'desk'
            ? ['fest-day-desk']
            : [...PAGE_KEYS];
    return {
        portalRole,
        allowedPages,
        competitionAccess,
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
    COMPETITION_SECTIONS,
    sanitizeCompetitionAccess,
    sanitizeCategoryIds,
    pagesForCompetitionAccess,
    getCompetitionScope,
};
