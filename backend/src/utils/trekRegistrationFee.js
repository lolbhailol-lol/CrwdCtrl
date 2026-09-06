/** Platform fee % presets for treks (0 = Cashfree only / no platform fee, then 0.5 … 10). */
const FEE_STEP = 0.5;
const FEE_MAX = 10;

const TREK_PLATFORM_FEE_PERCENT_VALUES = (() => {
    const values = [0];
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

/** Allow 0% (Cashfree with no CrwdCtrl platform fee). */
function sanitizeTrekPlatformFeePercent(value, fallback = 3) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    if (n === 0) return 0;
    if (TREK_PLATFORM_FEE_PERCENT_VALUES.has(n)) return n;
    const snapped = Math.round(n * 2) / 2;
    if (snapped >= FEE_STEP && snapped <= FEE_MAX) return snapped;
    return fallback;
}

function sanitizeEventPlatformFeePercent(value, fallback = 2.5) {
    return sanitizeTrekPlatformFeePercent(value, fallback);
}

/** Resolve stored % without treating 0 as missing (unlike `x || 3`). */
function resolveTrekPlatformFeePercent(value, fallback = 3) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
}

module.exports = {
    sanitizeTrekRegistrationFee,
    sanitizeTrekPlatformFeePercent,
    sanitizeEventPlatformFeePercent,
    resolveTrekPlatformFeePercent,
};
