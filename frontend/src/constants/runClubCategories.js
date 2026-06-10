/** Run category chips on the public run club detail page */
export const RUN_CATEGORY_OPTIONS = [
    'Social Runs',
    'Morning Runs',
    'Night Runs',
    'Long Runs',
    'Trail Runs',
];

export const normalizeRunCategory = (label) => {
    if (!label) return null;
    const trimmed = String(label).trim();
    if (RUN_CATEGORY_OPTIONS.includes(trimmed)) return trimmed;
    const match = RUN_CATEGORY_OPTIONS.find(
        (opt) => opt.toLowerCase() === trimmed.toLowerCase(),
    );
    return match || trimmed;
};
