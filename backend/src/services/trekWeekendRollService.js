const mongoose = require('mongoose');
const TrekCommunity = require('../model/trek_community_model');
const Trek = require('../model/trek_model');
const { logger } = require('../utils/logger');
const { startOfLocalDay } = require('../utils/trekDateNormalize');
const {
    buildRollingWeekendBatches,
    isRecurringWeekendTrek,
    matchesTrekVedeCommunity,
} = require('../utils/trekWeekendDates');

const ROLL_WEEKS = Number(process.env.TREK_WEEKEND_ROLL_WEEKS) || 8;
const ROLL_INTERVAL_MS = Number(process.env.TREK_WEEKEND_ROLL_INTERVAL_MS) || 24 * 60 * 60 * 1000;

let trekVedeCommunityIdCache = null;
let rolling = false;

async function findTrekVedeCommunity() {
    if (trekVedeCommunityIdCache) {
        const cached = await TrekCommunity.findById(trekVedeCommunityIdCache).select('_id name slug status').lean();
        if (cached && matchesTrekVedeCommunity(cached)) return cached;
        trekVedeCommunityIdCache = null;
    }

    const communities = await TrekCommunity.find({ status: 'published' }).select('_id name slug status').lean();
    const hit = communities.find((c) => matchesTrekVedeCommunity(c));
    if (hit) trekVedeCommunityIdCache = String(hit._id);
    return hit || null;
}

async function isTrekVedeCommunityId(communityId) {
    if (!communityId || !mongoose.Types.ObjectId.isValid(String(communityId))) return false;
    if (trekVedeCommunityIdCache && String(communityId) === trekVedeCommunityIdCache) return true;
    const community = await TrekCommunity.findById(communityId).select('_id name slug').lean();
    if (!community) return false;
    const hit = matchesTrekVedeCommunity(community);
    if (hit) trekVedeCommunityIdCache = String(community._id);
    return hit;
}

function trekDateIsPast(trek, now = new Date()) {
    if (!trek?.trekDate) return false;
    return startOfLocalDay(new Date(trek.trekDate)).getTime() < startOfLocalDay(now).getTime();
}

function shouldRollTrek(trek) {
    if (!trek || trek.status !== 'published') return false;
    return isRecurringWeekendTrek(trek);
}

function rollTrekDocument(trek, now = new Date()) {
    if (!shouldRollTrek(trek)) return { changed: false };

    const nextBatches = buildRollingWeekendBatches(trek.trekBatches || [], {
        weeks: ROLL_WEEKS,
        dateLabel: trek.dateLabel,
    }, now);

    const nextDates = [...new Set(nextBatches.map((b) => b.date))].sort();
    const prevDates = [...new Set((trek.trekBatches || []).map((b) => b.date))].sort().join('|');
    const nextDatesKey = nextDates.join('|');

    trek.trekBatches = nextBatches;
    if (!trek.registration) trek.registration = {};
    trek.registration.availableDates = nextDates;
    if (trek.registration.status !== 'closed') {
        trek.registration.status = 'open';
    }
    trek.status = 'published';
    trek.markModified('trekBatches');
    trek.markModified('registration');

    return { changed: prevDates !== nextDatesKey, batchCount: nextBatches.length };
}

async function rollTrekVedeWeekendTreks({ now = new Date() } = {}) {
    if (rolling) {
        return { skipped: true, reason: 'roll_in_progress' };
    }

    rolling = true;
    try {
        const community = await findTrekVedeCommunity();
        if (!community) {
            return { updated: 0, reason: 'community_not_found' };
        }

        const treks = await Trek.find({ communityId: community._id, status: 'published' });
        let updated = 0;

        for (const trek of treks) {
            if (!shouldRollTrek(trek)) continue;
            const result = rollTrekDocument(trek, now);
            if (result.changed || trekDateIsPast(trek, now)) {
                await trek.save();
                updated += 1;
            }
        }

        if (updated > 0) {
            logger.info('TrekkVede weekend trek dates rolled forward', {
                communityId: String(community._id),
                updated,
                weeks: ROLL_WEEKS,
            });
        }

        return { updated, communityId: String(community._id) };
    } finally {
        rolling = false;
    }
}

function initTrekWeekendRollCron() {
    if (String(process.env.TREK_WEEKEND_ROLL_ENABLED || 'true').toLowerCase() === 'false') {
        logger.info('TrekkVede weekend roll disabled via TREK_WEEKEND_ROLL_ENABLED');
        return;
    }

    const run = () => {
        rollTrekVedeWeekendTreks().catch((err) => {
            logger.warn('TrekkVede weekend roll failed', { error: err.message });
        });
    };

    // Roll shortly after boot, then daily
    setTimeout(run, 20_000);
    setInterval(run, ROLL_INTERVAL_MS);

    logger.info('TrekkVede weekend roll scheduled', {
        intervalMs: ROLL_INTERVAL_MS,
        weeks: ROLL_WEEKS,
    });
}

module.exports = {
    findTrekVedeCommunity,
    isTrekVedeCommunityId,
    rollTrekVedeWeekendTreks,
    rollTrekDocument,
    initTrekWeekendRollCron,
};
