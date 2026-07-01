/** Platform fee % presets for treks (0.5 … 10 in 0.5 steps). */
const FEE_STEP = 0.5;
const FEE_MAX = 10;

const TREK_PLATFORM_FEE_PERCENT_VALUES = (() => {
    const values = [];
    for (let pct = FEE_STEP; pct <= FEE_MAX + 1e-9; pct += FEE_STEP) {
        values.push(Math.round(pct * 10) / 10);
    }
    return new Set(values);
})();

function sanitizeTrekRegistrationFee(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n);
}

function sanitizeTrekPlatformFeePercent(value, fallback = 3) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    if (TREK_PLATFORM_FEE_PERCENT_VALUES.has(n)) return n;
    const snapped = Math.round(n * 2) / 2;
    if (snapped >= FEE_STEP && snapped <= FEE_MAX) return snapped;
    return fallback;
}

module.exports = {
    sanitizeTrekRegistrationFee,
    sanitizeTrekPlatformFeePercent,
};
