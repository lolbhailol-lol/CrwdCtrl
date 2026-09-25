const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');

/** MindSpark payments run through the separate Delulu/events Cashfree merchant. */
function resolveFestCashfreeMerchant(pricing) {
  if (!['fest', 'competition'].includes(pricing?.entityType)) return 'platform';
  return isMindSparkFestId(pricing?.notes?.festId) ? 'events' : 'platform';
}

module.exports = { resolveFestCashfreeMerchant };
