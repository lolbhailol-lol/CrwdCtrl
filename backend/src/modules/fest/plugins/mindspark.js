const MINDSPARK_FEST_ID = '6a7f1010ed26d983b34e55c2';

function isMindSparkFestId(festId) {
    return String(festId || '') === MINDSPARK_FEST_ID;
}

/**
 * MindSpark-only registration / settlement behavior.
 * Generic fest controllers must call getFestPlugin(festId) instead of
 * comparing this id inline.
 */
const mindsparkPlugin = {
    id: 'mindspark',
    autoConfirmOnRegister: true,
    forcePersonFields: true,
    useCashfreeSettlement: true,
    skipReviewQueue: true,
    settlementExcludeCompetitionIds: [],
    settlementOverride: {
        // Cashfree merchant clear lock (₹4,35,303 / gross ₹4,42,381)
        // + actual Razorpay paid (₹9,314 gross / ≈₹9,165 clear).
        // Do NOT use floor_plus_live with live-baseline delta — that invented
        // ₹4,89,111 by double-counting Cashfree catch-up as "new" money.
        // mode `floor`: show this until live confirmed paid exceeds it, then live.
        mode: 'floor',
        grossCollected: 451695,
        revenue: 444468,
        // Reference actuals (dashboard also returns these live):
        // cashfreeLockGross: 442381, cashfreeLockRevenue: 435303,
        // razorpayPaidGross: 9314, razorpayPaidRevenue: 9165,
        // liveConfirmedGross: ~380504 (still below Cashfree lock; ghosts excluded)
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
};
