const MINDSPARK_FEST_ID = '6a7f1010ed26d983b34e55c2';
/** HACKATHON is settled outside this organizer revenue total. */
const MINDSPARK_SETTLEMENT_EXCLUDE_COMPETITION_IDS = [
    '6a7f158f0e5ff505e2a4c4ad',
];

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
    settlementExcludeCompetitionIds: MINDSPARK_SETTLEMENT_EXCLUDE_COMPETITION_IDS,
    settlementOverride: {
        // Locked organizer revenue (matches competition sum after gateway charges).
        grossCollected: 442280,
        revenue: 435203,
        gatewayFeeRate: 0.016,
        additionalDeduction: 0,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    MINDSPARK_SETTLEMENT_EXCLUDE_COMPETITION_IDS,
    isMindSparkFestId,
    mindsparkPlugin,
};
