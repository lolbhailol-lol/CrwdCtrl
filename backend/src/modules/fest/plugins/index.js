const {
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
} = require('./mindspark');

const defaultFestPlugin = {
    id: 'default',
    autoConfirmOnRegister: false,
    forcePersonFields: false,
    useCashfreeSettlement: false,
    skipReviewQueue: false,
};

function getFestPlugin(festId) {
    if (isMindSparkFestId(festId)) return mindsparkPlugin;
    return defaultFestPlugin;
}

module.exports = {
    getFestPlugin,
    MINDSPARK_FEST_ID,
    isMindSparkFestId,
    mindsparkPlugin,
    defaultFestPlugin,
};
