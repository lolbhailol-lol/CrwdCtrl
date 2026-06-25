export const EVENT_TYPE_LABELS = {
    play: 'Play',
    musical: 'Musical',
    standup: 'Stand-up',
    improv: 'Improv',
    dance_drama: 'Dance Drama',
    fashion: 'Fashion',
};

export const EVENTS_PAGE_SECTION_OPTS = [
    { value: '', label: '— None —' },
    { value: 'hero', label: '🎬 Hero Banner' },
    { value: 'spotlight', label: '✨ In the Spotlight' },
    { value: 'upcoming', label: '🎭 Upcoming Shows' },
    { value: 'community', label: '🤝 Community Events' },
];

/** @deprecated use EVENTS_PAGE_SECTION_OPTS in Section Manager */
export const EVENTS_PAGE_SECTIONS = EVENTS_PAGE_SECTION_OPTS;

export function formatEventShowDate(showTimings) {
    if (!showTimings?.length) return 'Date TBA';
    const upcoming = showTimings
        .filter((s) => s.date)
        .map((s) => new Date(s.date))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b);
    if (!upcoming.length) return 'Date TBA';
    return upcoming[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mapEventShow(raw) {
    return {
        id: raw._id,
        title: raw.title,
        subtitle: raw.city || raw.organizer || '',
        basedIn: raw.city || raw.organizer || 'Based in',
        type: EVENT_TYPE_LABELS[raw.eventType] || raw.eventType || 'Event',
        eventType: raw.eventType,
        image: raw.poster || null,
        poster: raw.poster,
        city: raw.city,
        venue: raw.venue,
        organizer: raw.organizer,
        bookingLink: raw.bookingLink,
        showTimings: raw.showTimings || [],
        date: formatEventShowDate(raw.showTimings),
        pageSection: raw.pageSection || null,
        pagePriority: raw.pagePriority ?? 999,
    };
}
