const { isConfigured, getAnalyticsSummary } = require('./googleAnalyticsService');
const { rangeToGaDates } = require('./userActivityService');
const { describeGaError } = require('../utils/gaErrorMessage');

async function fetchGaActivityForRange(range) {
    if (!isConfigured()) {
        return { configured: false };
    }

    const { startDate, endDate } = rangeToGaDates(range);
    try {
        const summary = await getAnalyticsSummary({
            startDate,
            endDate,
            skipPathMigration: true,
        });
        return {
            configured: true,
            range: { startDate, endDate },
            totals: summary.totals,
            daily: summary.daily || [],
            topPages: summary.topPages || [],
            devices: summary.devices || {},
            trafficSources: summary.trafficSources || [],
            topEvents: summary.topEvents || [],
        };
    } catch (error) {
        const safeMessage = describeGaError(error);
        console.error('User activity GA fetch error:', safeMessage);
        return {
            configured: true,
            error: safeMessage,
            range: { startDate, endDate },
            totals: null,
            daily: [],
            topPages: [],
            devices: {},
        };
    }
}

module.exports = {
    fetchGaActivityForRange,
};
