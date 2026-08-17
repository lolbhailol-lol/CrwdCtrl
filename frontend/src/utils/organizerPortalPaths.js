/** Shared run-club vs event-community organizer URL helpers. */

export const RUN_CLUB_ORGANIZER_BASE = '/run-club-organizer';
export const EVENT_COMMUNITY_ORGANIZER_BASE = '/event-community-organizer';

export function isEventCommunityOrganizerPath(pathname = '') {
    return String(pathname || '').startsWith(EVENT_COMMUNITY_ORGANIZER_BASE);
}

export function organizerPortalBase(isEventHub) {
    return isEventHub ? EVENT_COMMUNITY_ORGANIZER_BASE : RUN_CLUB_ORGANIZER_BASE;
}

export function organizerLoginPath(isEventHub, from = '') {
    const base = organizerPortalBase(isEventHub);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    const qs = params.toString();
    return qs ? `${base}/login?${qs}` : `${base}/login`;
}

export function organizerSignupPath(isEventHub) {
    return `${organizerPortalBase(isEventHub)}/signup`;
}

export function organizerHomePath(isEventHub) {
    return organizerPortalBase(isEventHub);
}

export function organizerEventPath(eventId, isEventHub, suffix = '') {
    const tail = suffix ? `/${String(suffix).replace(/^\//, '')}` : '';
    return `${organizerPortalBase(isEventHub)}/events/${eventId}${tail}`;
}

/** Map legacy run-club-organizer URLs → event-community-organizer when on events hub. */
export function toEventCommunityOrganizerPath(pathname, search = '') {
    if (!pathname.startsWith(RUN_CLUB_ORGANIZER_BASE)) return null;
    const next = pathname.replace(RUN_CLUB_ORGANIZER_BASE, EVENT_COMMUNITY_ORGANIZER_BASE);
    return `${next}${search || ''}`;
}
