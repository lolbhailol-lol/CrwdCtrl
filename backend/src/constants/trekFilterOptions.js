const TREK_FILTER_OPTIONS = {
    duration: ['Camping', 'Half Day', 'Full Day', 'Weekend', 'Multi-day'],
    difficulty: ['Bonfire', 'Stargazing'],
    budget: ['Free', 'Under ₹1000', '₹1000 – ₹3000', '₹3000+'],
    experience: ['Sunrise View', 'Sunset View'],
    timing: ['Photography', 'Morning', 'Evening'],
    terrain: ['Offbeat Trails', 'Forest', 'Mountain'],
    style: ['Group', 'Solo', 'Family'],
};

function sanitizeTrekFilters(input) {
    if (!input || typeof input !== 'object') {
        return {
            duration: [],
            difficulty: [],
            budget: [],
            experience: [],
            timing: [],
            terrain: [],
            style: [],
        };
    }

    const sanitized = {};
    for (const [key, allowed] of Object.entries(TREK_FILTER_OPTIONS)) {
        const values = Array.isArray(input[key]) ? input[key] : [];
        sanitized[key] = [...new Set(values.filter((v) => typeof v === 'string' && allowed.includes(v)))];
    }
    return sanitized;
}

module.exports = { TREK_FILTER_OPTIONS, sanitizeTrekFilters };
