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
const { isKshitijFest, kshitijPlugin } = require('./kshitij');

const defaultFestPlugin = {
    id: 'default',
    autoConfirmOnRegister: false,
    manualApprovalRequired: false,
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
    if (isKshitijFest(festIdOrFest)) return kshitijPlugin;
    return defaultFestPlugin;
}

function shouldAutoConfirmRegistration(plugin, paymentStatus) {
    if (plugin?.manualApprovalRequired === true) return false;
    return plugin?.autoConfirmOnRegister === true
        || paymentStatus === 'paid'
        || paymentStatus === 'free';
}

module.exports = {
    getFestPlugin,
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
    TECHFEST_SLUG,
    isTechfestFest,
    techfestPlugin,
    isKshitijFest,
    kshitijPlugin,
    shouldAutoConfirmRegistration,
    defaultFestPlugin,
};
