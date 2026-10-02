/** Mirrors backend/src/utils/festOrganizerPages.js page keys for nav + Access UI. */

export const FEST_ORG_PAGE_CATALOG = [
    { key: 'overview', label: 'Overview', navLabels: ['Overview'] },
    { key: 'edit-listing', label: 'Edit fest & comps', navLabels: ['Edit fest & comps'] },
    { key: 'fest-day-desk', label: 'Fest Day Desk', navLabels: ['Fest Day Desk'] },
    { key: 'competitions', label: 'Competitions', navLabels: ['Competitions'] },
    { key: 'participants', label: 'Participants', navLabels: ['Participants'] },
    { key: 'check-in', label: 'Check-in', navLabels: ['Check-in'] },
    { key: 'auditorium', label: 'Auditorium', navLabels: ['Auditorium'] },
    { key: 'auditorium-gate', label: 'Auditorium gate', navLabels: ['Auditorium gate'] },
    { key: 'coupons', label: 'Coupons', navLabels: ['Coupons'] },
    { key: 'revenue', label: 'Revenue', navLabels: ['Revenue'] },
    { key: 'connect', label: 'Connect', navLabels: ['Connect'] },
    { key: 'access', label: 'Access', navLabels: ['Access'] },
];

export function navPageKeyForLabel(label) {
    const hit = FEST_ORG_PAGE_CATALOG.find((p) => (p.navLabels || []).includes(label));
    return hit?.key || null;
}

export function organizerPortalRole(sessionOrOrganizer) {
    const org = sessionOrOrganizer?.organizer || sessionOrOrganizer || {};
    const role = String(org.portalRole || 'organizer').toLowerCase();
    if (role === 'desk') return 'desk';
    if (role === 'cohead') return 'cohead';
    return 'organizer';
}

export function organizerAllowedPages(sessionOrOrganizer) {
    const org = sessionOrOrganizer?.organizer || sessionOrOrganizer || {};
    const role = organizerPortalRole(org);
    if (role === 'organizer') return FEST_ORG_PAGE_CATALOG.map((p) => p.key);
    if (role === 'desk') return ['fest-day-desk'];
    return (Array.isArray(org.allowedPages) ? org.allowedPages : [])
        .map((p) => String(p || '').toLowerCase())
        .filter(Boolean);
}

/** Competition ids granted a section on this fest, or null when access is not competition-limited. */
export function organizerCompetitionIds(sessionOrOrganizer, festId, section) {
    const org = sessionOrOrganizer?.organizer || sessionOrOrganizer || {};
    if (organizerPortalRole(org) !== 'cohead') return null;
    const access = Array.isArray(org.competitionAccess) ? org.competitionAccess : [];
    if (!access.length) return null;
    return new Set(access
        .filter((a) => String(a.festId) === String(festId) && (a.sections || []).includes(section))
        .map((a) => String(a.competitionId)));
}

export function canManageFestAccess(sessionOrOrganizer) {
    const org = sessionOrOrganizer?.organizer || sessionOrOrganizer || {};
    if (org.canManageAccess === true) return true;
    return organizerPortalRole(org) === 'organizer';
}

export function organizerHasPage(sessionOrOrganizer, pageKey) {
    return organizerAllowedPages(sessionOrOrganizer).includes(String(pageKey || '').toLowerCase());
}

/** First granted page path for redirects. */
export function firstGrantedFestPath(festId, sessionOrOrganizer) {
    const pages = organizerAllowedPages(sessionOrOrganizer);
    const base = `/fest-organizer/fests/${festId}`;
    const order = [
        ['overview', base],
        ['fest-day-desk', `${base}/fest-day-desk`],
        ['competitions', `${base}/competitions`],
        ['participants', `${base}/participants`],
        ['check-in', `${base}/scan`],
        ['auditorium', `${base}/auditorium`],
        ['auditorium-gate', `${base}/auditorium/scan`],
        ['coupons', `${base}/coupons`],
        ['revenue', `${base}/revenue`],
        ['connect', `${base}/notifications`],
        ['edit-listing', `${base}/edit-listing`],
        ['access', `${base}/access`],
    ];
    for (const [key, path] of order) {
        if (pages.includes(key)) return path;
    }
    return base;
}

export function pathAllowedForOrganizer(pathname, festId, sessionOrOrganizer) {
    const role = organizerPortalRole(sessionOrOrganizer);
    if (role === 'organizer') return true;
    const base = `/fest-organizer/fests/${festId}`;
    const path = String(pathname || '').replace(/\/$/, '') || pathname;
    const pages = new Set(organizerAllowedPages(sessionOrOrganizer));

    if (path === base || path === `${base}/`) return pages.has('overview');
    if (path.startsWith(`${base}/fest-day-desk`)) return pages.has('fest-day-desk');
    if (path.startsWith(`${base}/competitions`)) return pages.has('competitions') || pages.has('edit-listing');
    if (path.startsWith(`${base}/participants`)) return pages.has('participants');
    if (path.startsWith(`${base}/scan`)) return pages.has('check-in');
    if (path.startsWith(`${base}/auditorium/scan`)) {
        return pages.has('auditorium') || pages.has('auditorium-gate') || pages.has('check-in');
    }
    if (path.startsWith(`${base}/auditorium`)) return pages.has('auditorium');
    if (path.startsWith(`${base}/coupons`)) return pages.has('coupons');
    if (path.startsWith(`${base}/revenue`)) return pages.has('revenue');
    if (path.startsWith(`${base}/notifications`)) return pages.has('connect');
    if (path.startsWith(`${base}/edit-listing`) || path.startsWith(`${base}/info`)) return pages.has('edit-listing');
    if (path.startsWith(`${base}/access`)) return pages.has('access') || role === 'organizer';
    if (path.startsWith(`${base}/live`) || path.startsWith(`${base}/leads`) || path.startsWith(`${base}/pro-show`)) {
        return pages.has('edit-listing');
    }
    return false;
}
