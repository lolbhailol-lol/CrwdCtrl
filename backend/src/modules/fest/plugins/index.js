const {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
} = require('./mindspark');
const {
    TECHFEST_SLUG,
    isTechfestFest,
    techfestPlugin,
} = require('./techfest');

const defaultFestPlugin = {
    id: 'default',
    autoConfirmOnRegister: false,
    forcePersonFields: false,
    useCashfreeSettlement: false,
    skipReviewQueue: false,
    omitWhatsAppInEmail: false,
};

function getFestPlugin(festIdOrFest) {
    const id = festIdOrFest && typeof festIdOrFest === 'object'
        ? (festIdOrFest._id || festIdOrFest.id)
        : festIdOrFest;
    if (isMindSparkFestId(id)) return mindsparkPlugin;
    if (isTechfestFest(festIdOrFest)) return techfestPlugin;
    return defaultFestPlugin;
}

module.exports = {
    getFestPlugin,
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
    TECHFEST_SLUG,
    isTechfestFest,
    techfestPlugin,
    defaultFestPlugin,
};
