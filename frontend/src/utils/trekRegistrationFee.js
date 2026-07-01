/** Platform fee % presets for treks (added on top of registration fee at checkout). */
const FEE_STEP = 0.5;
const FEE_MAX = 10;

export const TREK_PLATFORM_FEE_PERCENT_OPTIONS = (() => {
    const options = [];
    for (let pct = FEE_STEP; pct <= FEE_MAX + 1e-9; pct += FEE_STEP) {
        const value = Math.round(pct * 10) / 10;
        options.push({
            value,
            label: `${value}%`,
            chip: Number.isInteger(value) ? String(value) : String(value),
        });
    }
    return options;
})();

export const TREK_PLATFORM_FEE_PERCENT_VALUES = new Set(
    TREK_PLATFORM_FEE_PERCENT_OPTIONS.map((o) => o.value),
);

export function sanitizeTrekRegistrationFee(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
}

export function sanitizeTrekPlatformFeePercent(value, fallback = 3) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    if (TREK_PLATFORM_FEE_PERCENT_VALUES.has(n)) return n;
    const snapped = Math.round(n * 2) / 2;
    if (snapped >= FEE_STEP && snapped <= FEE_MAX) return snapped;
    return fallback;
}

export function formatTrekPerPersonFee(value) {
    const n = Number(value) || 0;
    if (n <= 0) return 'Free';
    return `₹${n.toLocaleString('en-IN')} / person`;
}
