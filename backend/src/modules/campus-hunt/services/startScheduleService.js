const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
const { writeAudit } = require('./auditService');
const { normalizeWaitCode, resolveCampusStations, resolveStartCount } = require('./stationCatalogService');

function scheduleError(message, code = 'INVALID_START_SCHEDULE', status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function sortByCode(rows, key) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(
    String(b[key]),
    undefined,
    { numeric: true },
  ));
}

/** First N teams by code — matches generateSchedule / leaderboard field size. */
function selectCompetitionTeams(teams, teamCapacity) {
  const capacity = Math.max(1, Number(teamCapacity) || teams.length || 40);
  return sortByCode(teams, 'teamCode').slice(0, capacity);
}

/** Normalize wait code from A / START-A / similar. */
function waitCodeFromPoint(point) {
  return normalizeWaitCode(point?.code || point?.routeKey);
}

/**
 * Canonical waits A–D (prefer code A over START-A).
 * When startCount < 4, only the first N codes are required (demo layouts).
 */
function selectCanonicalStartingPoints(points, startCount = 4) {
  const required = Math.max(1, Math.min(4, Number(startCount) || 4));
  const want = ['A', 'B', 'C', 'D'].slice(0, required);
  const byWait = new Map();
  for (const point of (points || [])) {
    if (point?.active === false) continue;
    const wait = waitCodeFromPoint(point);
    if (!wait || !want.includes(wait)) continue;
    const existing = byWait.get(wait);
    const code = String(point.code || '').toUpperCase().trim();
    if (!existing || code === wait) {
      byWait.set(wait, point);
    }
  }
  return want.map((code) => byWait.get(code)).filter(Boolean);
}

function buildDeterministicSchedule({
  teams,
  startingPoints,
  routes,
  variants,
  clue2Variants = [],
  clue3Variants = [],
  clue4Variants = [],
  startsAt,
  releaseIntervalMinutes = 5,
  assignmentStrategy = 'route_balanced',
  startCount = 4,
}) {
  const sortedTeams = sortByCode(teams, 'teamCode');
  const requiredStarts = Math.max(1, Math.min(4, Number(startCount) || 4));
  // Keep A→D order so Team 1–N = first start, next block = second start, …
  const points = selectCanonicalStartingPoints(startingPoints, requiredStarts);
  const sortedRoutes = sortByCode(routes.filter((route) => route.active !== false), 'routeKey');
  const base = new Date(startsAt);
  if (Number.isNaN(base.getTime())) throw scheduleError('A valid event start time is required');
  if (!points.length) throw scheduleError('Create at least one active starting point');
  if (points.length < requiredStarts) {
    const lastCode = ['A', 'B', 'C', 'D'][requiredStarts - 1];
    throw scheduleError(
      `Need ${requiredStarts} starting point(s) (A–${lastCode}). Found ${points.length}. `
      + 'Save Teams/starts/places setup, then Update Clue 1 (or Bootstrap), and try again.',
      'INCOMPLETE_START_POINTS',
    );
  }
  if (!sortedRoutes.length) throw scheduleError('Create at least one active route');
  // Defensive: stretch start capacities if layout was resized after teams existed.
  let totalCapacity = points.reduce((sum, point) => sum + Number(point.capacity || 0), 0);
  if (sortedTeams.length > totalCapacity && points.length) {
    const perWait = Math.ceil(sortedTeams.length / points.length);
    points.forEach((point) => {
      // eslint-disable-next-line no-param-reassign
      point.capacity = Math.max(Number(point.capacity) || 0, perWait);
    });
    totalCapacity = points.reduce((sum, point) => sum + Number(point.capacity || 0), 0);
  }
  if (sortedTeams.length > totalCapacity) {
    throw scheduleError(
      `Starting point capacity is ${totalCapacity}, but ${sortedTeams.length} teams need assignment. `
      + 'Set Overall teams to match, Save setup, then Preview again.',
      'START_CAPACITY_EXCEEDED',
    );
  }

  const teamsPerWait = Math.max(
    1,
    ...points.map((point) => Number(point.capacity) || 0),
    Math.ceil(sortedTeams.length / Math.max(1, points.length)),
  );

  const pointSlots = [];
  for (const point of points) {
    for (let slot = 0; slot < point.capacity; slot += 1) pointSlots.push({ point, slot });
  }

  return sortedTeams.map((team, index) => {
    const { point, slot } = pointSlots[index];
    // Route must match the wait location (Library↔A, Chanakya↔B, …).
    const pointCode = waitCodeFromPoint(point)
      || String(point.code || '').toUpperCase().trim();
    const waitIndex = Math.max(0, ['A', 'B', 'C', 'D'].indexOf(pointCode));
    const waveNumber = slot + 1;
    const teamNumber = waitIndex * teamsPerWait + waveNumber;
    let route = sortedRoutes.find(
      (item) => String(item.routeKey || '').toUpperCase() === pointCode,
    );
    if (!route && team.routeId && assignmentStrategy !== 'route_balanced') {
      route = sortedRoutes.find((item) => String(item._id) === String(team.routeId || ''));
    }
    if (!route) {
      route = sortedRoutes[index % sortedRoutes.length];
    }
    const onRoute = variants
      .filter((variant) => (
        variant.active !== false
        && Number(variant.challengeNumber) === 1
        && String(variant.routeId) === String(route._id)
        && variant.firstCheckpointId
      ));
    // Prefer variants pinned to this wait id; else any on the route (covers START-A vs A).
    const exact = onRoute.filter((variant) => (
      !variant.startingPointId
      || String(variant.startingPointId) === String(point._id)
    ));
    const pool = (exact.length ? exact : onRoute)
      .sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)));
    const waveIds = Array.from({ length: teamsPerWait }, (_, i) => `T${i + 1}`);
    const waveId = waveIds[slot % waveIds.length];
    const byWave = pool.find((variant) => (
      String(variant.variantKey || '').toUpperCase().endsWith(`-${waveId}`)
    ));
    const variant = byWave
      || (pool.length ? pool[slot % pool.length] : null);

    const clue2Pool = (clue2Variants || []).filter((row) => (
      row.active !== false
      && Number(row.challengeNumber) === 2
      && String(row.routeId) === String(route._id)
      && row.secondCheckpointId
    ));
    const clue2Exact = clue2Pool.filter((row) => (
      !row.startingPointId
      || String(row.startingPointId) === String(point._id)
    ));
    const clue2Sorted = (clue2Exact.length ? clue2Exact : clue2Pool)
      .sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)));
    const clue2ByWave = clue2Sorted.find((row) => (
      String(row.variantKey || '').toUpperCase().endsWith(`-${waveId}`)
    )) || (variant
      ? clue2Sorted.find((row) => (
        String(row.variantKey || '').toUpperCase() === String(variant.variantKey || '').toUpperCase()
      ))
      : null);
    const clue2 = clue2ByWave
      || (clue2Sorted.length ? clue2Sorted[slot % clue2Sorted.length] : null);

    const clue3Pool = (clue3Variants || []).filter((row) => (
      row.active !== false
      && Number(row.challengeNumber) === 3
      && String(row.routeId) === String(route._id)
      && row.thirdCheckpointId
    ));
    const clue3Exact = clue3Pool.filter((row) => (
      !row.startingPointId
      || String(row.startingPointId) === String(point._id)
    ));
    const clue3Sorted = (clue3Exact.length ? clue3Exact : clue3Pool)
      .sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)));
    const clue3ByWave = clue3Sorted.find((row) => (
      String(row.variantKey || '').toUpperCase().endsWith(`-${waveId}`)
    )) || (variant
      ? clue3Sorted.find((row) => (
        String(row.variantKey || '').toUpperCase() === String(variant.variantKey || '').toUpperCase()
      ))
      : null);
    const clue3 = clue3ByWave
      || (clue3Sorted.length ? clue3Sorted[slot % clue3Sorted.length] : null);

    const clue4Pool = (clue4Variants || []).filter((row) => (
      row.active !== false
      && Number(row.challengeNumber) === 4
      && String(row.routeId) === String(route._id)
      && row.fourthCheckpointId
    ));
    const clue4Exact = clue4Pool.filter((row) => (
      !row.startingPointId
      || String(row.startingPointId) === String(point._id)
    ));
    const clue4Sorted = (clue4Exact.length ? clue4Exact : clue4Pool)
      .sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)));
    const clue4ByWave = clue4Sorted.find((row) => (
      String(row.variantKey || '').toUpperCase().endsWith(`-${waveId}`)
    )) || (variant
      ? clue4Sorted.find((row) => (
        String(row.variantKey || '').toUpperCase() === String(variant.variantKey || '').toUpperCase()
      ))
      : null);
    const clue4 = clue4ByWave
      || (clue4Sorted.length ? clue4Sorted[slot % clue4Sorted.length] : null);

    return {
      teamId: String(team._id),
      teamCode: team.teamCode,
      teamName: team.teamName || '',
      teamNumber,
      startingPointId: String(point._id),
      startingPointCode: point.code,
      startingPointName: point.name || point.code,
      waveNumber,
      routeId: String(route._id),
      routeKey: route.routeKey,
      scheduledStartAt: new Date(base.getTime() + slot * releaseIntervalMinutes * 60 * 1000),
      clue1ChallengeId: variant ? String(variant._id) : null,
      clue1VariantKey: variant?.variantKey || null,
      firstCheckpointId: variant?.firstCheckpointId
        ? String(variant.firstCheckpointId)
        : null,
      clue2ChallengeId: clue2 ? String(clue2._id) : null,
      clue2VariantKey: clue2?.variantKey || null,
      secondCheckpointId: clue2?.secondCheckpointId
        ? String(clue2.secondCheckpointId)
        : null,
      clue3ChallengeId: clue3 ? String(clue3._id) : null,
      clue3VariantKey: clue3?.variantKey || null,
      thirdCheckpointId: clue3?.thirdCheckpointId
        ? String(clue3.thirdCheckpointId)
        : null,
      clue4ChallengeId: clue4 ? String(clue4._id) : null,
      clue4VariantKey: clue4?.variantKey || null,
      fourthCheckpointId: clue4?.fourthCheckpointId
        ? String(clue4.fourthCheckpointId)
        : null,
      complete: Boolean(variant?.firstCheckpointId),
    };
  });
}

/**
 * If Clue 4 still points at removed places (S05/S06…), rebind to active layout.
 * Safe to call before preview/resync — no-op when already correct.
 */
async function ensureClue4MatchesLayout(eventId, roundId) {
  const {
    reconcileClue4ToActiveLayout,
    buildTeamGroups,
    teamsPerWaitFor,
  } = require('./round1BootstrapService');

  const [event, round] = await Promise.all([
    CampusHuntEvent.findById(eventId),
    CampusHuntRound.findOne({ _id: roundId, eventId }),
  ]);
  if (!event || !round) {
    return { reconciled: false, updated: 0, reason: 'missing_event_or_round' };
  }

  const huntStations = resolveCampusStations(event);
  const activeCodes = new Set(huntStations.map((s) => String(s.code).toUpperCase()));
  if (!activeCodes.size) {
    return { reconciled: false, updated: 0, reason: 'no_active_places' };
  }

  const clue4Rows = await CampusHuntChallenge.find({
    eventId,
    challengeNumber: 4,
    active: { $ne: false },
    fourthCheckpointId: { $exists: true, $ne: null },
  }).select('fourthCheckpointId').lean();

  if (!clue4Rows.length) {
    return { reconciled: false, updated: 0, reason: 'no_clue4' };
  }

  const fourthIds = [...new Set(clue4Rows.map((row) => String(row.fourthCheckpointId)))];
  const fourthCheckpoints = await CampusHuntCheckpoint.find({ _id: { $in: fourthIds } })
    .select('stationCode active')
    .lean();

  const hasStale = fourthCheckpoints.some((cp) => {
    if (cp.active === false) return false;
    const code = String(cp.stationCode || '').toUpperCase();
    return code && !activeCodes.has(code);
  });

  if (!hasStale) {
    return { reconciled: false, updated: 0, reason: 'already_ok' };
  }

  const [routes, startingPointsRaw] = await Promise.all([
    CampusHuntRoute.find({ eventId, active: { $ne: false } }),
    CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }),
  ]);
  if (!routes.length) {
    return { reconciled: false, updated: 0, reason: 'no_routes' };
  }

  let startingPoints = startingPointsRaw.filter(
    (point) => String(point.roundId) === String(round._id),
  );
  if (!startingPoints.length) startingPoints = startingPointsRaw;

  const startCount = resolveStartCount(event);
  const capacity = Number(event.teamCapacity) || 40;
  const perWait = teamsPerWaitFor(capacity, startCount);
  const teamGroups = buildTeamGroups(perWait);

  const result = await reconcileClue4ToActiveLayout(
    event,
    round,
    routes,
    startingPoints,
    huntStations,
    teamGroups,
  );

  return {
    reconciled: true,
    updated: result.updated,
    skipped: result.skipped,
    activePlaces: huntStations.length,
  };
}

async function previewSchedule({
  eventId,
  roundId,
  startsAt,
  releaseIntervalMinutes,
  assignmentStrategy,
}) {
  await ensureClue4MatchesLayout(eventId, roundId);

  const CampusHuntEvent = require('../models/CampusHuntEvent');
  const [round, event, teams, startingPointsRaw, routes, variants, clue2Variants, clue3Variants, clue4Variants] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntEvent.findById(eventId).select('startCount teamCapacity stationCount campusStations').lean(),
    CampusHuntTeam.find({ eventId }).select('_id teamCode teamName routeId'),
    // Do NOT require roundId match — Locations may have been created under an older Round 1 id.
    CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }),
    CampusHuntRoute.find({ eventId, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 1, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 2, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 3, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 4, active: { $ne: false } }),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  const startCount = Math.max(1, Math.min(4, Number(event?.startCount) || 4));
  const teamCapacity = Math.max(1, Number(event?.teamCapacity) || teams.length || 40);
  const interval = Number(releaseIntervalMinutes || round.releaseIntervalMinutes || 5);
  if (!Number.isInteger(interval) || interval < 1) {
    throw scheduleError('Release interval must be at least 1 minute', 'INVALID_RELEASE_INTERVAL', 400);
  }
  const strategy = assignmentStrategy || round.assignmentStrategy || 'route_balanced';
  if (!['sequential', 'route_balanced'].includes(strategy)) {
    throw scheduleError('Invalid assignment strategy', 'INVALID_ASSIGNMENT_STRATEGY', 400);
  }

  // Prefer points already on this round; otherwise use any active waits for the event.
  let startingPoints = startingPointsRaw.filter(
    (point) => String(point.roundId) === String(round._id),
  );
  if (selectCanonicalStartingPoints(startingPoints, startCount).length < startCount) {
    startingPoints = startingPointsRaw;
  }
  const canonicalStarts = selectCanonicalStartingPoints(startingPoints, startCount);
  // Only schedule up to Overall teams — leftover CC teams from an older 40-team bootstrap
  // should not block a smaller layout.
  const teamsToAssign = sortByCode(teams, 'teamCode').slice(0, teamCapacity);
  const perWait = Math.max(
    1,
    Math.ceil(Math.max(teamCapacity, teamsToAssign.length) / Math.max(1, startCount)),
  );
  // Keep only the layout's active starts bound to this round, with capacity for this size.
  if (canonicalStarts.length) {
    await CampusHuntStartingPoint.updateMany(
      { _id: { $in: canonicalStarts.map((p) => p._id) } },
      { $set: { roundId: round._id, active: true, capacity: perWait } },
    );
    canonicalStarts.forEach((point) => {
      // eslint-disable-next-line no-param-reassign
      point.capacity = perWait;
    });
  }

  // Prefer challenges for this round; fall back to any active clue variants on the event.
  const pickChallenges = (rows) => {
    const forRound = rows.filter((row) => String(row.roundId) === String(round._id));
    return forRound.length ? forRound : rows;
  };

  const activeStationCodes = new Set(
    resolveCampusStations(event).map((s) => String(s.code).toUpperCase()),
  );
  const pickedClue4 = pickChallenges(clue4Variants);
  const fourthIds = pickedClue4.map((row) => row.fourthCheckpointId).filter(Boolean);
  const fourthCheckpoints = fourthIds.length
    ? await CampusHuntCheckpoint.find({ _id: { $in: fourthIds } })
      .select('stationCode active')
      .lean()
    : [];
  const fourthCpById = new Map(fourthCheckpoints.map((cp) => [String(cp._id), cp]));
  const clue4InLayout = pickedClue4.filter((row) => {
    const cp = fourthCpById.get(String(row.fourthCheckpointId || ''));
    if (!cp || cp.active === false) return false;
    return activeStationCodes.has(String(cp.stationCode || '').toUpperCase());
  });

  const assignments = buildDeterministicSchedule({
    teams: teamsToAssign,
    startingPoints: canonicalStarts,
    routes,
    variants: pickChallenges(variants),
    clue2Variants: pickChallenges(clue2Variants),
    clue3Variants: pickChallenges(clue3Variants),
    clue4Variants: clue4InLayout.length ? clue4InLayout : [],
    startsAt: startsAt || round.startsAt,
    releaseIntervalMinutes: interval,
    assignmentStrategy: strategy,
    startCount,
  });

  // Attach real campus place names for Clue 1 / 2 / 3 stops (not Route A/B).
  const checkpointIds = [
    ...new Set(
      assignments.flatMap((row) => [
        row.firstCheckpointId,
        row.secondCheckpointId,
        row.thirdCheckpointId,
        row.fourthCheckpointId,
      ].filter(Boolean)),
    ),
  ];
  const checkpoints = checkpointIds.length
    ? await CampusHuntCheckpoint.find({ _id: { $in: checkpointIds } })
      .select('locationName stationCode checkpointKey progressionKey')
      .lean()
    : [];
  const byId = new Map(checkpoints.map((cp) => [String(cp._id), cp]));
  const enriched = assignments.map((row) => {
    const first = byId.get(String(row.firstCheckpointId || ''));
    const second = byId.get(String(row.secondCheckpointId || ''));
    const third = byId.get(String(row.thirdCheckpointId || ''));
    const fourth = byId.get(String(row.fourthCheckpointId || ''));
    return {
      ...row,
      startingPointName: row.startingPointName || row.startingPointCode || null,
      firstStopName: first?.locationName || null,
      secondStopName: second?.locationName || null,
      thirdStopName: third?.locationName || null,
      fourthStopName: fourth?.locationName || null,
    };
  });

  return {
    round,
    assignments: enriched,
    releaseIntervalMinutes: interval,
    assignmentStrategy: strategy,
    startCount,
    teamCapacity,
    teamsScheduled: teamsToAssign.length,
    teamsSkipped: Math.max(0, teams.length - teamsToAssign.length),
    startingPointsUsed: canonicalStarts.map((p) => ({
      id: String(p._id),
      code: p.code,
      name: p.name,
      capacity: p.capacity,
    })),
  };
}

/**
 * Bind visiting teams onto each shared Checkpoint 1 / FIRST SCAN QR (~4 teams per place).
 */
async function syncFirstCheckpointAllowLists({ eventId, roundId, assignments }) {
  await CampusHuntCheckpoint.updateMany(
    { eventId, roundId, progressionKey: '1' },
    { $set: { allowedTeamIds: [] } },
  );
  const byCheckpoint = new Map();
  for (const assignment of assignments) {
    if (!assignment.firstCheckpointId || !assignment.teamId) continue;
    const key = String(assignment.firstCheckpointId);
    if (!byCheckpoint.has(key)) byCheckpoint.set(key, []);
    byCheckpoint.get(key).push(assignment.teamId);
  }
  for (const [checkpointId, teamIds] of byCheckpoint.entries()) {
    const unique = [...new Set(teamIds.map(String))];
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateOne(
      { _id: checkpointId, eventId, progressionKey: '1' },
      { $set: { allowedTeamIds: unique } },
    );
  }
  return byCheckpoint.size;
}

/** Bind visiting teams onto each shared Checkpoint 2 / SECOND SCAN QR (~4 teams per place). */
async function syncSecondCheckpointAllowLists({ eventId, roundId, assignments }) {
  await CampusHuntCheckpoint.updateMany(
    { eventId, roundId, progressionKey: '2' },
    { $set: { allowedTeamIds: [] } },
  );
  const byCheckpoint = new Map();
  for (const assignment of assignments) {
    if (!assignment.secondCheckpointId || !assignment.teamId) continue;
    const key = String(assignment.secondCheckpointId);
    if (!byCheckpoint.has(key)) byCheckpoint.set(key, []);
    byCheckpoint.get(key).push(assignment.teamId);
  }
  for (const [checkpointId, teamIds] of byCheckpoint.entries()) {
    const unique = [...new Set(teamIds.map(String))];
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateOne(
      { _id: checkpointId, eventId, progressionKey: '2' },
      { $set: { allowedTeamIds: unique } },
    );
  }
  return byCheckpoint.size;
}

/** Bind visiting teams onto each shared Checkpoint 3 / THIRD SCAN QR (~4 teams per place). */
async function syncThirdCheckpointAllowLists({ eventId, roundId, assignments }) {
  await CampusHuntCheckpoint.updateMany(
    { eventId, roundId, progressionKey: '3' },
    { $set: { allowedTeamIds: [] } },
  );
  const byCheckpoint = new Map();
  for (const assignment of assignments) {
    if (!assignment.thirdCheckpointId || !assignment.teamId) continue;
    const key = String(assignment.thirdCheckpointId);
    if (!byCheckpoint.has(key)) byCheckpoint.set(key, []);
    byCheckpoint.get(key).push(assignment.teamId);
  }
  for (const [checkpointId, teamIds] of byCheckpoint.entries()) {
    const unique = [...new Set(teamIds.map(String))];
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateOne(
      { _id: checkpointId, eventId, progressionKey: '3' },
      { $set: { allowedTeamIds: unique } },
    );
  }
  return byCheckpoint.size;
}

/** Bind visiting teams onto each shared Checkpoint 4 / FOURTH SCAN QR. */
async function syncFourthCheckpointAllowLists({ eventId, roundId, assignments }) {
  await CampusHuntCheckpoint.updateMany(
    { eventId, roundId, progressionKey: '4' },
    { $set: { allowedTeamIds: [] } },
  );
  const byCheckpoint = new Map();
  for (const assignment of assignments) {
    if (!assignment.fourthCheckpointId || !assignment.teamId) continue;
    const key = String(assignment.fourthCheckpointId);
    if (!byCheckpoint.has(key)) byCheckpoint.set(key, []);
    byCheckpoint.get(key).push(assignment.teamId);
  }
  for (const [checkpointId, teamIds] of byCheckpoint.entries()) {
    const unique = [...new Set(teamIds.map(String))];
    // eslint-disable-next-line no-await-in-loop
    await CampusHuntCheckpoint.updateOne(
      { _id: checkpointId, eventId, progressionKey: '4' },
      { $set: { allowedTeamIds: unique } },
    );
  }
  return byCheckpoint.size;
}

async function generateSchedule(options) {
  const result = await previewSchedule(options);
  const { round, assignments } = result;
  if (round.status !== 'scheduled' && options.confirm !== true) {
    throw scheduleError('Regenerating a live/locked round requires confirm: true');
  }
  for (const assignment of assignments) {
    // eslint-disable-next-line no-await-in-loop
    const before = await CampusHuntTeam.findById(assignment.teamId)
      .select('startingPointId routeId scheduledStartAt clue1ChallengeId firstCheckpointId clue2ChallengeId secondCheckpointId clue3ChallengeId thirdCheckpointId clue4ChallengeId fourthCheckpointId currentStage startStatus startingScore currentScore')
      .lean();

    const forceReset = options.forceResetProgress === true;
    const alreadyInProgress = before
      && before.currentStage
      && before.currentStage !== 'WAITING'
      && before.currentStage !== 'SCORE_LOCKED';

    const $set = {
      startingPointId: assignment.startingPointId,
      roundId: round._id,
      routeId: assignment.routeId,
      scheduledStartAt: assignment.scheduledStartAt,
      clue1ChallengeId: assignment.clue1ChallengeId,
      firstCheckpointId: assignment.firstCheckpointId,
    };
    if (assignment.clue2ChallengeId) $set.clue2ChallengeId = assignment.clue2ChallengeId;
    if (assignment.secondCheckpointId) $set.secondCheckpointId = assignment.secondCheckpointId;
    if (assignment.clue3ChallengeId) $set.clue3ChallengeId = assignment.clue3ChallengeId;
    if (assignment.thirdCheckpointId) $set.thirdCheckpointId = assignment.thirdCheckpointId;
    if (assignment.clue4ChallengeId) $set.clue4ChallengeId = assignment.clue4ChallengeId;
    if (assignment.fourthCheckpointId) $set.fourthCheckpointId = assignment.fourthCheckpointId;

    // Never wipe live stages unless organizer explicitly force-resets.
    if (!alreadyInProgress || forceReset) {
      $set.startStatus = 'WAITING';
      $set.currentStage = 'WAITING';
    }

    const $unset = {};
    if (!assignment.clue2ChallengeId) $unset.clue2ChallengeId = 1;
    if (!assignment.secondCheckpointId) $unset.secondCheckpointId = 1;
    if (!assignment.clue3ChallengeId) $unset.clue3ChallengeId = 1;
    if (!assignment.thirdCheckpointId) $unset.thirdCheckpointId = 1;
    if (!assignment.clue4ChallengeId) $unset.clue4ChallengeId = 1;
    if (!assignment.fourthCheckpointId) $unset.fourthCheckpointId = 1;
    if (forceReset) {
      $unset.actualStartAt = 1;
      $unset.finalScore = 1;
      $unset.scoreLockedAt = 1;
      $unset.finishedAt = 1;
      $unset.lastCheckpointNumber = 1;
      $unset.suddenDeathRank = 1;
      $unset['stats.totalCompletionMs'] = 1;
      const startScore = Number(before?.startingScore) > 0
        ? Number(before.startingScore)
        : 100;
      $set.currentScore = startScore;
      $set.startingScore = startScore;
      $set.status = 'registered';
      $set['stats.hintsUsed'] = 0;
      $set['stats.failedAttempts'] = 0;
      $set['stats.manualPenalty'] = 0;
    }

    const update = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne(
      { _id: assignment.teamId, eventId: options.eventId },
      update,
    );
    // eslint-disable-next-line no-await-in-loop
    await writeAudit({
      eventId: options.eventId,
      ...options.actor,
      action: 'team_start_assignment_generated',
      targetType: 'team',
      targetId: assignment.teamId,
      reason: options.reason || '',
      before,
      after: {
        startingPointId: assignment.startingPointId,
        routeId: assignment.routeId,
        scheduledStartAt: assignment.scheduledStartAt,
        clue1ChallengeId: assignment.clue1ChallengeId,
        firstCheckpointId: assignment.firstCheckpointId,
      },
    });
  }

  if (options.forceResetProgress === true && assignments.length) {
    const teamIds = assignments.map((row) => row.teamId);
    await Promise.all([
      CampusHuntTeamProgress.deleteMany({ teamId: { $in: teamIds } }),
      CampusHuntCheckpointVerification.deleteMany({ teamId: { $in: teamIds } }),
    ]);
  }

  const postersBound = await syncFirstCheckpointAllowLists({
    eventId: options.eventId,
    roundId: round._id,
    assignments,
  });
  const secondPostersBound = await syncSecondCheckpointAllowLists({
    eventId: options.eventId,
    roundId: round._id,
    assignments,
  });
  const thirdPostersBound = await syncThirdCheckpointAllowLists({
    eventId: options.eventId,
    roundId: round._id,
    assignments,
  });
  const fourthPostersBound = await syncFourthCheckpointAllowLists({
    eventId: options.eventId,
    roundId: round._id,
    assignments,
  });
  round.startsAt = new Date(options.startsAt || round.startsAt);
  round.releaseIntervalMinutes = result.releaseIntervalMinutes;
  round.assignmentStrategy = result.assignmentStrategy;
  round.scheduleStatus = 'draft';
  round.scheduleLockedAt = undefined;
  // Keep endsAt after the new startsAt so live play does not stay "closed".
  if (
    round.endsAt
    && new Date(round.endsAt).getTime() <= new Date(round.startsAt).getTime()
  ) {
    const durationMs = 50 * 60 * 1000;
    round.endsAt = new Date(new Date(round.startsAt).getTime() + durationMs);
  }
  await round.save();
  await writeAudit({
    eventId: options.eventId,
    ...options.actor,
    action: 'start_schedule_generated',
    targetType: 'round',
    targetId: round._id,
    reason: options.reason || '',
    after: {
      teams: assignments.length,
      startsAt: round.startsAt,
      releaseIntervalMinutes: result.releaseIntervalMinutes,
      assignmentStrategy: result.assignmentStrategy,
      firstStopPostersBound: postersBound,
      secondStopPostersBound: secondPostersBound,
      thirdStopPostersBound: thirdPostersBound,
      fourthStopPostersBound: fourthPostersBound,
    },
  });
  return { ...result, postersBound, secondPostersBound, thirdPostersBound, fourthPostersBound };
}

/**
 * Push latest Clue 1 variants + first checkpoints onto every team dashboard.
 * Does not reset live stages or wipe existing release times.
 */
async function resyncClue1TeamBindings({ eventId, roundId, actor = {}, reason = '' }) {
  const round = await CampusHuntRound.findOne({ _id: roundId, eventId });
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);

  const clue4Fix = await ensureClue4MatchesLayout(eventId, roundId);

  // Hide legacy START-* duplicates so capacity stays 4 waits × 10 = 40.
  await CampusHuntStartingPoint.updateMany(
    {
      eventId,
      roundId,
      code: { $nin: ['A', 'B', 'C', 'D'] },
    },
    { $set: { active: false } },
  );

  const startsAt = round.startsAt || new Date();
  const preview = await previewSchedule({
    eventId,
    roundId,
    startsAt,
    releaseIntervalMinutes: round.releaseIntervalMinutes || 5,
    assignmentStrategy: round.assignmentStrategy || 'route_balanced',
  });

  let updated = 0;
  let incomplete = 0;
  const bound = [];

  for (const assignment of preview.assignments) {
    if (!assignment.clue1ChallengeId || !assignment.firstCheckpointId) {
      incomplete += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const team = await CampusHuntTeam.findById(assignment.teamId)
      .select('startingPointId routeId scheduledStartAt roundId currentStage startStatus clue1ChallengeId firstCheckpointId clue2ChallengeId secondCheckpointId clue3ChallengeId thirdCheckpointId clue4ChallengeId fourthCheckpointId');
    if (!team) continue;

    const $set = {
      clue1ChallengeId: assignment.clue1ChallengeId,
      firstCheckpointId: assignment.firstCheckpointId,
      // Always realign wait/route so duplicate START-* leftovers cannot strand teams.
      startingPointId: assignment.startingPointId,
      routeId: assignment.routeId,
      roundId: round._id,
    };
    if (assignment.clue2ChallengeId) $set.clue2ChallengeId = assignment.clue2ChallengeId;
    if (assignment.secondCheckpointId) $set.secondCheckpointId = assignment.secondCheckpointId;
    if (assignment.clue3ChallengeId) $set.clue3ChallengeId = assignment.clue3ChallengeId;
    if (assignment.thirdCheckpointId) $set.thirdCheckpointId = assignment.thirdCheckpointId;
    if (assignment.clue4ChallengeId) $set.clue4ChallengeId = assignment.clue4ChallengeId;
    if (assignment.fourthCheckpointId) $set.fourthCheckpointId = assignment.fourthCheckpointId;
    if (!team.scheduledStartAt) $set.scheduledStartAt = assignment.scheduledStartAt;

    // eslint-disable-next-line no-await-in-loop
    await CampusHuntTeam.updateOne({ _id: team._id, eventId }, { $set });
    updated += 1;
    bound.push({
      teamId: assignment.teamId,
      teamCode: assignment.teamCode,
      clue1ChallengeId: assignment.clue1ChallengeId,
      firstCheckpointId: assignment.firstCheckpointId,
      clue2ChallengeId: assignment.clue2ChallengeId,
      secondCheckpointId: assignment.secondCheckpointId,
      clue3ChallengeId: assignment.clue3ChallengeId,
      thirdCheckpointId: assignment.thirdCheckpointId,
      clue4ChallengeId: assignment.clue4ChallengeId,
      fourthCheckpointId: assignment.fourthCheckpointId,
      startingPointCode: assignment.startingPointCode,
      clue1VariantKey: assignment.clue1VariantKey,
      clue2VariantKey: assignment.clue2VariantKey,
      clue3VariantKey: assignment.clue3VariantKey,
    });
  }

  const postersBound = await syncFirstCheckpointAllowLists({
    eventId,
    roundId: round._id,
    assignments: preview.assignments,
  });
  const secondPostersBound = await syncSecondCheckpointAllowLists({
    eventId,
    roundId: round._id,
    assignments: preview.assignments,
  });
  const thirdPostersBound = await syncThirdCheckpointAllowLists({
    eventId,
    roundId: round._id,
    assignments: preview.assignments,
  });
  const fourthPostersBound = await syncFourthCheckpointAllowLists({
    eventId,
    roundId: round._id,
    assignments: preview.assignments,
  });

  await writeAudit({
    eventId,
    ...actor,
    action: 'clue1_team_bindings_resynced',
    targetType: 'round',
    targetId: round._id,
    reason: reason || '',
    after: {
      updated,
      incomplete,
      teams: preview.assignments.length,
      firstStopPostersBound: postersBound,
      secondStopPostersBound: secondPostersBound,
      thirdStopPostersBound: thirdPostersBound,
      fourthStopPostersBound: fourthPostersBound,
      clue4Fix,
    },
  });

  return {
    round,
    updated,
    incomplete,
    teams: preview.assignments.length,
    postersBound,
    secondPostersBound,
    thirdPostersBound,
    fourthPostersBound,
    clue4Fix,
    assignments: bound,
  };
}

async function lockSchedule({ eventId, roundId, actor, reason }) {
  const [round, teams, event] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntTeam.find({ eventId, roundId }),
    CampusHuntEvent.findById(eventId).select('teamCapacity').lean(),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  if (!teams.length) throw scheduleError('No teams assigned to this round');

  const teamCapacity = Math.max(1, Number(event?.teamCapacity) || teams.length || 40);
  const teamsToLock = selectCompetitionTeams(teams, teamCapacity);
  const leftoverTeams = sortByCode(teams, 'teamCode').slice(teamCapacity);

  if (!teamsToLock.length) {
    throw scheduleError('No teams within the current overall team capacity');
  }

  // Park demo leftovers from an older bootstrap so they cannot block lock.
  if (leftoverTeams.length) {
    await CampusHuntTeam.updateMany(
      { _id: { $in: leftoverTeams.map((team) => team._id) } },
      { $set: { startStatus: 'CANCELLED', currentStage: 'WAITING' } },
    );
  }

  const incomplete = teamsToLock.filter((team) => (
    !team.startingPointId
    || !team.routeId
    || !team.scheduledStartAt
    || !team.clue1ChallengeId
    || !team.firstCheckpointId
    || !team.clue2ChallengeId
    || !team.secondCheckpointId
    || !team.clue3ChallengeId
    || !team.thirdCheckpointId
    || !team.clue4ChallengeId
    || !team.fourthCheckpointId
  ));
  if (incomplete.length) {
    throw scheduleError(
      `${incomplete.length} of ${teamsToLock.length} field teams missing Clue 1–4 bindings. `
      + 'Update Clue 1–4, Generate schedule, then Lock.',
      'INCOMPLETE_START_ASSIGNMENTS',
    );
  }
  const pointIds = [...new Set(teamsToLock.map((team) => String(team.startingPointId)))];
  const points = await CampusHuntStartingPoint.find({ _id: { $in: pointIds }, active: true });
  if (points.length !== pointIds.length) {
    throw scheduleError('One or more assigned starting points are inactive or missing');
  }
  for (const point of points) {
    const count = teamsToLock.filter((team) => String(team.startingPointId) === String(point._id)).length;
    if (count > point.capacity) {
      throw scheduleError(`${point.code} exceeds capacity ${point.capacity}`, 'START_CAPACITY_EXCEEDED');
    }
  }
  const [variants, checkpoints] = await Promise.all([
    CampusHuntChallenge.countDocuments({
      _id: { $in: teamsToLock.map((team) => team.clue1ChallengeId) },
      active: true,
      challengeNumber: 1,
    }),
    CampusHuntCheckpoint.countDocuments({
      _id: { $in: teamsToLock.map((team) => team.firstCheckpointId) },
      active: true,
      progressionKey: '1',
    }),
  ]);
  if (variants < new Set(teamsToLock.map((team) => String(team.clue1ChallengeId))).size) {
    throw scheduleError('One or more Clue 1 variants are inactive or invalid');
  }
  if (checkpoints < new Set(teamsToLock.map((team) => String(team.firstCheckpointId))).size) {
    throw scheduleError('One or more first checkpoints are inactive or invalid');
  }
  await CampusHuntTeam.updateMany(
    { _id: { $in: teamsToLock.map((team) => team._id) }, startStatus: { $ne: 'CANCELLED' } },
    { $set: { startStatus: 'READY', currentStage: 'WAITING' } },
  );
  // Re-bind each Clue 1 / Clue 2 poster to its assigned team before lock
  await syncFirstCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teamsToLock.map((team) => ({
      teamId: String(team._id),
      firstCheckpointId: team.firstCheckpointId ? String(team.firstCheckpointId) : null,
    })),
  });
  await syncSecondCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teamsToLock.map((team) => ({
      teamId: String(team._id),
      secondCheckpointId: team.secondCheckpointId ? String(team.secondCheckpointId) : null,
    })),
  });
  await syncThirdCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teamsToLock.map((team) => ({
      teamId: String(team._id),
      thirdCheckpointId: team.thirdCheckpointId ? String(team.thirdCheckpointId) : null,
    })),
  });
  await syncFourthCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teamsToLock.map((team) => ({
      teamId: String(team._id),
      fourthCheckpointId: team.fourthCheckpointId ? String(team.fourthCheckpointId) : null,
    })),
  });
  round.scheduleStatus = 'locked';
  round.scheduleLockedAt = new Date();
  await round.save();
  await writeAudit({
    eventId,
    ...actor,
    action: 'start_schedule_locked',
    targetType: 'round',
    targetId: round._id,
    reason: reason || '',
    after: {
      teams: teamsToLock.length,
      leftoverParked: leftoverTeams.length,
      scheduleLockedAt: round.scheduleLockedAt,
    },
  });
  return {
    round,
    teamsReady: teamsToLock.length,
    leftoverParked: leftoverTeams.length,
  };
}

module.exports = {
  buildDeterministicSchedule,
  previewSchedule,
  generateSchedule,
  lockSchedule,
  selectCompetitionTeams,
  resyncClue1TeamBindings,
  ensureClue4MatchesLayout,
  syncFirstCheckpointAllowLists,
  syncSecondCheckpointAllowLists,
  syncThirdCheckpointAllowLists,
  syncFourthCheckpointAllowLists,
  selectCanonicalStartingPoints,
  waitCodeFromPoint,
  scheduleError,
};
