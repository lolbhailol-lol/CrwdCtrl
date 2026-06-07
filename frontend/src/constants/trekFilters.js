/** Shared trek filter config — used by Trek Category page and admin trek form */

export const DIFFICULTY_LEVEL_FILTER_OPTIONS = ['Easy', 'Moderate', 'Difficult', 'Extreme'];

export const TREK_FILTER_SECTIONS = [
    {
        id: 'duration',
        label: 'Duration',
        options: ['Camping', 'Half Day', 'Full Day', 'Weekend', 'Multi-day'],
    },
    {
        id: 'difficulty',
        label: 'Difficulty',
        options: ['Bonfire', 'Stargazing'],
        adminNote: 'Easy, Moderate, Difficult and Extreme are taken from the Difficulty Level field.',
    },
    {
        id: 'budget',
        label: 'Budget',
        options: ['Free', 'Under ₹1000', '₹1000 – ₹3000', '₹3000+'],
        adminAuto: true,
    },
    {
        id: 'experience',
        label: 'Experience',
        options: ['Sunrise View', 'Sunset View'],
    },
    {
        id: 'timing',
        label: 'Timing',
        options: ['Photography', 'Morning', 'Evening'],
    },
    {
        id: 'terrain',
        label: 'Terrain',
        options: ['Offbeat Trails', 'Forest', 'Mountain'],
    },
    {
        id: 'style',
        label: 'Style',
        options: ['Group', 'Solo', 'Family'],
    },
];

/** Sections + options shown in the user filter modal */
export const USER_FILTER_SECTIONS = TREK_FILTER_SECTIONS.map((section) =>
    section.id === 'difficulty'
        ? { ...section, options: [...DIFFICULTY_LEVEL_FILTER_OPTIONS, ...section.options] }
        : section
);

export const emptyTrekFilters = () =>
    TREK_FILTER_SECTIONS.reduce((acc, section) => {
        if (!section.adminAuto) acc[section.id] = [];
        return acc;
    }, {});

export const emptyUserFilters = () =>
    USER_FILTER_SECTIONS.reduce((acc, section) => ({ ...acc, [section.id]: [] }), {});

export function getBudgetTier(fee) {
    const amount = Number(fee) || 0;
    if (amount === 0) return 'Free';
    if (amount < 1000) return 'Under ₹1000';
    if (amount <= 3000) return '₹1000 – ₹3000';
    return '₹3000+';
}

function matchesBudget(trek, option) {
    return getBudgetTier(trek.registrationFee) === option;
}

export function trekMatchesFilters(trek, filters) {
    const selections = USER_FILTER_SECTIONS.flatMap((section) =>
        (filters[section.id] || []).map((value) => ({ section: section.id, value }))
    );
    if (selections.length === 0) return true;

    const trekFilters = trek.trekFilters || {};

    return selections.every(({ section, value }) => {
        if (section === 'budget') return matchesBudget(trek, value);

        if (section === 'difficulty' && DIFFICULTY_LEVEL_FILTER_OPTIONS.includes(value)) {
            return trek.difficultyLevel === value.toLowerCase();
        }

        const tags = trekFilters[section] || [];
        return tags.includes(value);
    });
}
