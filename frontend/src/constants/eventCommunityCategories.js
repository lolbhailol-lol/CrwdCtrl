/** Filter chips on event community pages — not run-club categories. */
export const EVENT_COMMUNITY_CATEGORY_OPTIONS = ['Sports'];

export function normalizeEventCommunityCategory(label) {
    if (!label) return null;
    const trimmed = String(label).trim();
    if (!trimmed) return null;
    const match = EVENT_COMMUNITY_CATEGORY_OPTIONS.find(
        (opt) => opt.toLowerCase() === trimmed.toLowerCase(),
    );
    return match || trimmed;
}

export function eventCommunityCategoryChips(clubCategories = []) {
    const fromClub = (Array.isArray(clubCategories) ? clubCategories : [])
        .map((label) => normalizeEventCommunityCategory(label))
        .filter(Boolean)
        .filter((label) => !/\bruns?\b/i.test(label));
    const labels = [...EVENT_COMMUNITY_CATEGORY_OPTIONS];
    fromClub.forEach((label) => {
        if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
            labels.push(label);
        }
    });
    return [
        { label: 'All', value: 'all' },
        ...labels.map((label) => ({ label, value: label })),
    ];
}
