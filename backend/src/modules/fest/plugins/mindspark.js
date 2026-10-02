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
        // Cashfree merchant clear stays locked until live Cashfree exceeds it.
        // Razorpay is added from live paid orders, and never shown below this snapshot.
        // Do NOT use floor_plus_live — that double-counted Cashfree catch-up.
        mode: 'floor',
        grossCollected: 451695,
        revenue: 444468,
        cashfreeLockGross: 442381,
        cashfreeLockRevenue: 435303,
        razorpayPaidGross: 9314,
        razorpayPaidRevenue: 9165,
        gatewayFeeRate: 0.0195,
        // Taken off the Razorpay amount. New Razorpay payments still add on top.
        additionalDeduction: 9000,
        wholeRupeeRazorpayRevenue: true,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
};
