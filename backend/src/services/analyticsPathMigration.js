const Analytics = require('../model/analytics_model');
const { buildSlugPathLookup } = require('../utils/analyticsPathNormalizer');

let migrationPromise = null;

/**
 * Rewrite stored page_view paths from legacy Mongo IDs to slug URLs.
 * Safe to run multiple times — only updates rows that still use old paths.
 */
async function migrateStoredPageViewPaths() {
    const lookup = await buildSlugPathLookup();
    let updated = 0;

    for (const [oldPath, newPath] of lookup.entries()) {
        const result = await Analytics.updateMany(
            { eventType: 'page_view', 'metadata.page': oldPath },
            { $set: { 'metadata.page': newPath } },
        );
        updated += result.modifiedCount || 0;
    }

    return { updated, mappings: lookup.size };
}

/**
 * Run migration once per server process (deduped).
 */
function ensurePageViewPathsMigrated() {
    if (!migrationPromise) {
        migrationPromise = migrateStoredPageViewPaths()
            .then((result) => {
                if (result.updated > 0) {
                    console.log(`✅ Analytics path migration: updated ${result.updated} page_view records`);
                }
                return result;
            })
            .catch((error) => {
                console.error('❌ Analytics path migration failed:', error.message);
                migrationPromise = null;
                throw error;
            });
    }
    return migrationPromise;
}

module.exports = {
    migrateStoredPageViewPaths,
    ensurePageViewPathsMigrated,
};
