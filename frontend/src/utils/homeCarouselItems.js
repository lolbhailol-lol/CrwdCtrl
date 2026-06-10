/** Same routing rules as Dashboard home carousels. */
export function festHomeSection(fest) {
    if (fest.homeSection) return fest.homeSection;
    if (fest.showOnHomeSlide) return null;
    const status = fest.status || 'upcoming';
    if (status === 'ongoing') return 'trending';
    if (status === 'upcoming' || status === 'beyondcampus') return 'happening';
    return null;
}

const PRIORITY_FIELD = {
    fest: 'homePriority',
    trek: 'priority',
    community: 'priority',
    sport: 'homePriority',
    runclub: 'priority',
};

export function normalizeHomeCarouselItem(type, raw) {
    const field = PRIORITY_FIELD[type];
    return {
        ...raw,
        _type: type,
        _id: raw._id || raw.id,
        _priority: raw[field] ?? raw.priority ?? raw.homePriority ?? 999,
        _title: type === 'fest' ? (raw.festName || 'Untitled')
            : type === 'trek' ? (raw.trekName || 'Untitled')
            : type === 'sport' ? (raw.title || 'Untitled')
            : (raw.name || 'Untitled'),
        _image: type === 'fest' ? raw.coverImage
            : type === 'trek' ? (raw.coverImage || raw.images?.[0])
            : type === 'sport' ? (raw.images?.[0] || raw.coverImage)
            : raw.coverImage,
        _subtitle: type === 'fest' ? (raw.collegeName || '')
            : type === 'trek' ? (raw.city || '')
            : type === 'sport' ? (raw.city || raw.sportType || '')
            : (raw.basedIn || raw.organizer || ''),
    };
}

export function buildHomeCarouselItems(fests, treks, communities, section, sportsEvents = [], runClubs = []) {
    const byPriority = (a, b) => {
        if (a._priority !== b._priority) return a._priority - b._priority;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    };

    return [
        ...(fests || []).filter((f) => festHomeSection(f) === section).map((f) => normalizeHomeCarouselItem('fest', f)),
        ...(treks || []).filter((t) => t.homeSection === section).map((t) => normalizeHomeCarouselItem('trek', t)),
        ...(communities || []).filter((c) => c.homeSection === section).map((c) => normalizeHomeCarouselItem('community', c)),
        ...(runClubs || []).filter((c) => c.homeSection === section).map((c) => normalizeHomeCarouselItem('runclub', c)),
        ...(sportsEvents || []).filter((s) => s.homeSection === section).map((s) => normalizeHomeCarouselItem('sport', s)),
    ].sort(byPriority);
}
