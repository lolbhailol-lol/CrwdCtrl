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
        // Locked to live paid total (all competitions, after 1.6% gateway fee).
        grossCollected: 456429,
        revenue: 449133.92,
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
};
