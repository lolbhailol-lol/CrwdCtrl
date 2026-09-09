/** Canonical public website origin — always www (apex often hits Railway API 404). */
export const PUBLIC_WEB_ORIGIN = 'https://www.crwdctrl.in';

export function publicWebUrl(path = '/') {
    const p = String(path || '/');
    if (p.startsWith('http://') || p.startsWith('https://')) {
        try {
            const u = new URL(p);
            if (u.hostname === 'crwdctrl.in') u.hostname = 'www.crwdctrl.in';
            return `${u.origin}${u.pathname}${u.search}${u.hash}`;
        } catch {
            return PUBLIC_WEB_ORIGIN;
        }
    }
    return `${PUBLIC_WEB_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`;
}

/** Admin copy-paste matrix for organizer portals (always www). */
export const ORGANIZER_LOGIN_MATRIX = [
    {
        id: 'event-community',
        label: 'Event community managers',
        loginPath: '/event-community-organizer/login',
        signupPath: '/event-community-organizer/signup',
        note: 'Delulu / community events hub',
    },
    {
        id: 'event-show',
        label: 'Theatre / show managers',
        loginPath: '/event-organizer/login',
        signupPath: '/event-organizer/signup',
        note: 'Standalone EventShows on /events',
    },
    {
        id: 'fest',
        label: 'Fest organizers',
        loginPath: '/fest-organizer/login',
        signupPath: '/fest-organizer/signup',
        note: 'College fests & competitions',
    },
    {
        id: 'run-club',
        label: 'Run club managers',
        loginPath: '/run-club-organizer/login',
        signupPath: '/run-club-organizer/signup',
        note: 'Sports / run clubs',
    },
    {
        id: 'trek',
        label: 'Trek organizers',
        loginPath: '/trek-organizer/login',
        signupPath: '/trek-organizer/signup',
        note: 'Trek communities',
    },
    {
        id: 'scanner',
        label: 'Scanner / check-in',
        loginPath: '/organizer/login',
        signupPath: null,
        note: 'QR check-in staff',
    },
];
