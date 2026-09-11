const CampusHuntFinaleMissionRun = require('../../models/CampusHuntFinaleMissionRun');
const { DEFAULT_INTEL_LOCATION_POOL, FINALE_DEFAULTS } = require('../../constants');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getLocationPool(config) {
  const pool = config?.intelHunt?.locationPool;
  if (Array.isArray(pool) && pool.length >= 2) return pool;
  return DEFAULT_INTEL_LOCATION_POOL;
}

function buildCombinedAnswer(loc1, loc2) {
  const f1 = String(loc1?.fragment || loc1?.acceptedAnswers?.[0] || '').trim().toUpperCase();
  const f2 = String(loc2?.fragment || loc2?.acceptedAnswers?.[0] || '').trim().toUpperCase();
  return `${f1}${f2}`;
}

/**
 * Count how many times each location id has been assigned across intel runs for an event.
 */
async function getLocationUsageCounts(eventId) {
  const runs = await CampusHuntFinaleMissionRun.find({
    eventId,
    missionId: 'intel_hunt',
  }).select('state').lean();

  const counts = new Map();
  for (const run of runs) {
    const ids = run.state?.assignedLocationIds || [];
    for (const id of ids) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Pick 2 locations from the pool with lowest usage (spreads teams across campus).
 * Shuffle only within equal-usage tiers so load-balancing still works.
 */
function pickTwoLocations(pool, usageCounts) {
  if (!Array.isArray(pool) || pool.length < 2) {
    const err = new Error('Intel location pool needs at least 2 locations.');
    err.status = 409;
    err.code = 'INTEL_POOL_TOO_SMALL';
    throw err;
  }

  const usageOf = (loc) => usageCounts.get(loc.id) || 0;
  const sorted = [...pool].sort((a, b) => {
    const diff = usageOf(a) - usageOf(b);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });

  const minUsage = usageOf(sorted[0]);
  const tier1 = shuffle(sorted.filter((loc) => usageOf(loc) === minUsage));
  const first = tier1[0];

  const rest = sorted.filter((loc) => loc.id !== first.id);
  const minUsage2 = usageOf(rest[0]);
  const tier2 = shuffle(rest.filter((loc) => usageOf(loc) === minUsage2));
  const second = tier2[0];

  return [first, second];
}

/**
 * Assign 2 team-specific locations when Intel Hunt starts.
 */
async function assignIntelLocations({ eventId, config }) {
  const pool = getLocationPool(config);
  const usageCounts = await getLocationUsageCounts(eventId);
  const [location1, location2] = pickTwoLocations(pool, usageCounts);
  const combinedAnswer = buildCombinedAnswer(location1, location2);

  return {
    location1: {
      id: location1.id,
      name: location1.name,
      instruction: location1.instruction,
      acceptedAnswers: location1.acceptedAnswers || [location1.fragment].filter(Boolean),
      fragment: location1.fragment || location1.acceptedAnswers?.[0] || '',
    },
    location2: {
      id: location2.id,
      name: location2.name,
      instruction: location2.instruction,
      acceptedAnswers: location2.acceptedAnswers || [location2.fragment].filter(Boolean),
      fragment: location2.fragment || location2.acceptedAnswers?.[0] || '',
    },
    assignedLocationIds: [location1.id, location2.id],
    combinedAnswer,
  };
}

function missionDurationMs(config, missionId) {
  if (missionId === 'operation_blackout') {
    const mins = Number(config?.blackout?.durationMinutes)
      || FINALE_DEFAULTS.blackoutDurationMinutes
      || 15;
    return mins * 60 * 1000;
  }
  const minutes = Number(config?.missionDurationMinutes)
    || FINALE_DEFAULTS.missionDurationMinutes
    || 10;
  return minutes * 60 * 1000;
}

function missionExpiresAt(config, missionId) {
  return new Date(Date.now() + missionDurationMs(config, missionId));
}

function isMissionTimedOut(run) {
  const expires = run?.state?.missionExpiresAt;
  if (!expires) return false;
  return new Date(expires).getTime() <= Date.now();
}

function missionTimeRemainingMs(run) {
  const expires = run?.state?.missionExpiresAt;
  if (!expires) return null;
  return Math.max(0, new Date(expires).getTime() - Date.now());
}

module.exports = {
  assignIntelLocations,
  getLocationPool,
  pickTwoLocations,
  buildCombinedAnswer,
  getLocationUsageCounts,
  missionDurationMs,
  missionExpiresAt,
  isMissionTimedOut,
  missionTimeRemainingMs,
};
