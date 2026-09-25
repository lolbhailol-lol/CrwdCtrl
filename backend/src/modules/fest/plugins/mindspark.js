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
        // Cashfree baseline (gross / organiser clear). New Cashfree + Razorpay live
        // confirmed payments above `liveBaseline*` add on top from now on.
        mode: 'floor_plus_live',
        grossCollected: 442381,
        revenue: 435303,
        liveBaselineGross: 325827,
        liveBaselineRevenue: 320614,
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
};
