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
    settlementOverride: {
        // Locked totals shown on fest organizer revenue / MindSpark payments.
        grossCollected: 4535303,
        revenue: 4535303,
        gatewayFeeRate: 0.016,
        additionalDeduction: 2000,
    },
};

module.exports = {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
};
