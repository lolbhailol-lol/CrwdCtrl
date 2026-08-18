/** Filter chips on event community pages — not run-club categories. */
export const EVENT_COMMUNITY_CATEGORY_OPTIONS = [
    'Sports',
    'Games',
    'Café',
    'Meetups',
    'Workshops',
];

export function normalizeEventCommunityCategory(label) {
    if (!label) return null;
    const trimmed = String(label).trim();
    if (!trimmed) return null;
    const match = EVENT_COMMUNITY_CATEGORY_OPTIONS.find(
        (opt) => opt.toLowerCase() === trimmed.toLowerCase(),
    );
    return match || trimmed;
}

/** Public chips = All + this community's selected categories (Sports stays if nothing is set). */
export function eventCommunityCategoryChips(clubCategories = []) {
    const fromClub = (Array.isArray(clubCategories) ? clubCategories : [])
        .map((label) => normalizeEventCommunityCategory(label))
        .filter(Boolean)
        .filter((label) => !/\bruns?\b/i.test(label));
    const labels = [];
    (fromClub.length ? fromClub : ['Sports']).forEach((label) => {
        if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
            labels.push(label);
        }
    });
    return [
        { label: 'All', value: 'all' },
        ...labels.map((label) => ({ label, value: label })),
    ];
}
