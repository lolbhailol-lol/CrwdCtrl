export const SPORT_TYPE_LABELS = {
    run_club: 'Run Club',
    football: 'Football',
    cricket: 'Cricket',
    badminton: 'Badminton',
    marathon: 'Marathon',
    gymkhana: 'Gymkhana',
    other: 'Sports',
};

/** Legacy dropdown labels — Section Manager & old records */
export const SPORTS_FEATURED_SECTION_LABELS = {
    upcoming: 'Upcoming',
    run_clubs: 'Run Clubs',
    both: 'Both',
};

function clampPriority(value) {
    const p = parseInt(value, 10);
    if (Number.isNaN(p)) return 999;
    return Math.max(1, Math.min(999, p));
}

/** Normalize legacy featuredSection + priority into explicit section flags */
export function normalizeSportsSections(event) {
    if (!event) return event;
    const e = { ...event };

    if (e.showInUpcoming === undefined) {
        if (e.showOnSportsPage === false) e.showInUpcoming = false;
        else if (e.featuredSection === 'run_clubs') e.showInUpcoming = false;
        else e.showInUpcoming = true;
    }

    if (e.showInRunClubs === undefined) {
        if (e.showOnSportsPage === false) e.showInRunClubs = false;
        else if (e.sportType !== 'run_club') e.showInRunClubs = false;
        else if (e.featuredSection === 'upcoming') e.showInRunClubs = false;
        else e.showInRunClubs = true;
    }

    if (e.upcomingPriority === undefined || e.upcomingPriority === null) {
        e.upcomingPriority = e.priority ?? 999;
    }
    if (e.runClubPriority === undefined || e.runClubPriority === null) {
        e.runClubPriority = 999;
    }

    return e;
}

export function showsInUpcoming(event) {
    const e = normalizeSportsSections(event);
    if (e.showOnSportsPage === false) return false;
    return e.showInUpcoming !== false;
}

export function showsInRunClubs(event) {
    const e = normalizeSportsSections(event);
    if (e.showOnSportsPage === false) return false;
    if (e.sportType !== 'run_club') return false;
    return e.showInRunClubs !== false;
}

export function sortUpcomingEvents(events = []) {
    return [...events].sort((a, b) => {
        const na = normalizeSportsSections(a);
        const nb = normalizeSportsSections(b);
        const pa = na.upcomingPriority ?? 999;
        const pb = nb.upcomingPriority ?? 999;
        if (pa !== pb) return pa - pb;
        const da = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
        const db = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

export function sortRunClubEvents(events = []) {
    return [...events].sort((a, b) => {
        const na = normalizeSportsSections(a);
        const nb = normalizeSportsSections(b);
        const pa = na.runClubPriority ?? 999;
        const pb = nb.runClubPriority ?? 999;
        if (pa !== pb) return pa - pb;
        const da = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
        const db = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

/** @deprecated use sortUpcomingEvents or sortRunClubEvents */
export function sortSportsEvents(events = []) {
    return sortUpcomingEvents(events);
}

export function getSportsDisplayType(event, labels = SPORT_TYPE_LABELS) {
    const custom = event?.displayType?.trim();
    if (custom) return custom;
    return labels[event?.sportType] || 'Sports';
}

export function deriveFeaturedSection({ showInUpcoming, showInRunClubs }) {
    if (showInUpcoming && showInRunClubs) return 'both';
    if (showInUpcoming) return 'upcoming';
    if (showInRunClubs) return 'run_clubs';
    return null;
}

export function getSectionSummary(event) {
    const e = normalizeSportsSections(event);
    if (e.showOnSportsPage === false) return { upcoming: false, runClubs: false, label: 'Hidden' };
    return {
        upcoming: e.showInUpcoming !== false,
        runClubs: e.sportType === 'run_club' && e.showInRunClubs !== false,
        label: null,
    };
}

export function clampSportsPriority(value) {
    return clampPriority(value);
}
