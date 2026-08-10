const CampusHuntRound = require('../models/CampusHuntRound');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntRoute = require('../models/CampusHuntRoute');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
const { writeAudit } = require('./auditService');

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

/** Normalize wait code from A / START-A / similar. */
function waitCodeFromPoint(point) {
  const raw = String(point?.code || point?.routeKey || '').toUpperCase().trim();
  if (/^[A-D]$/.test(raw)) return raw;
  const stripped = raw.replace(/^START[-_\s]?/, '');
  if (/^[A-D]$/.test(stripped)) return stripped;
  return raw.match(/^([A-D])/)?.[1] || null;
}

/**
 * Exactly 4 waits (A–D). Prefer code A over START-A so duplicate legacy
 * points do not eat half the team slots (symptom: only 20/40 bound).
 */
function selectCanonicalStartingPoints(points) {
  const byWait = new Map();
  for (const point of (points || [])) {
    if (point?.active === false) continue;
    const wait = waitCodeFromPoint(point);
    if (!wait || !['A', 'B', 'C', 'D'].includes(wait)) continue;
    const existing = byWait.get(wait);
    const code = String(point.code || '').toUpperCase().trim();
    if (!existing || code === wait) {
      byWait.set(wait, point);
    }
  }
  return ['A', 'B', 'C', 'D'].map((code) => byWait.get(code)).filter(Boolean);
}

function buildDeterministicSchedule({
  teams,
  startingPoints,
  routes,
  variants,
  clue2Variants = [],
  clue3Variants = [],
  startsAt,
  releaseIntervalMinutes = 5,
  assignmentStrategy = 'route_balanced',
}) {
  const sortedTeams = sortByCode(teams, 'teamCode');
  // Keep A→D order so Team 1–10 = Library, 11–20 = Chanakya, 21–30 = Design, 31–40 = Vyas.
  const points = selectCanonicalStartingPoints(startingPoints);
  const sortedRoutes = sortByCode(routes.filter((route) => route.active !== false), 'routeKey');
  const base = new Date(startsAt);
  if (Number.isNaN(base.getTime())) throw scheduleError('A valid event start time is required');
  if (!points.length) throw scheduleError('Create at least one active starting point');
  if (points.length < 4) {
    throw scheduleError(
      `Need 4 starting points (A–D). Found ${points.length}. Remove duplicate START-* points or bootstrap again.`,
      'INCOMPLETE_START_POINTS',
    );
  }
  if (!sortedRoutes.length) throw scheduleError('Create at least one active route');
  const totalCapacity = points.reduce((sum, point) => sum + Number(point.capacity || 0), 0);
  if (sortedTeams.length > totalCapacity) {
    throw scheduleError(
      `Starting point capacity is ${totalCapacity}, but ${sortedTeams.length} teams need assignment`,
      'START_CAPACITY_EXCEEDED',
    );
  }

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
    const teamNumber = waitIndex * 10 + waveNumber;
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
    const waveIds = Array.from({ length: 10 }, (_, i) => `T${i + 1}`);
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
      complete: Boolean(variant?.firstCheckpointId),
    };
  });
}

async function previewSchedule({
  eventId,
  roundId,
  startsAt,
  releaseIntervalMinutes,
  assignmentStrategy,
}) {
  const [round, teams, startingPointsRaw, routes, variants, clue2Variants, clue3Variants] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntTeam.find({ eventId }).select('_id teamCode teamName routeId'),
    // Do NOT require roundId match — Locations may have been created under an older Round 1 id.
    CampusHuntStartingPoint.find({ eventId, active: { $ne: false } }),
    CampusHuntRoute.find({ eventId, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 1, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 2, active: { $ne: false } }),
    CampusHuntChallenge.find({ eventId, challengeNumber: 3, active: { $ne: false } }),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  const interval = Number(releaseIntervalMinutes || round.releaseIntervalMinutes || 5);
  if (!Number.isInteger(interval) || interval < 1) {
    throw scheduleError('Release interval must be at least 1 minute', 'INVALID_RELEASE_INTERVAL', 400);
  }
  const strategy = assignmentStrategy || round.assignmentStrategy || 'route_balanced';
  if (!['sequential', 'route_balanced'].includes(strategy)) {
    throw scheduleError('Invalid assignment strategy', 'INVALID_ASSIGNMENT_STRATEGY', 400);
  }

  // Prefer points already on this round; otherwise use any active A–D for the event.
  let startingPoints = startingPointsRaw.filter(
    (point) => String(point.roundId) === String(round._id),
  );
  if (selectCanonicalStartingPoints(startingPoints).length < 4) {
    startingPoints = startingPointsRaw;
  }
  // Keep Locations bound to the round used for schedule so later ops stay consistent.
  if (startingPoints.length) {
    await CampusHuntStartingPoint.updateMany(
      { _id: { $in: startingPoints.map((p) => p._id) } },
      { $set: { roundId: round._id, active: true } },
    );
  }

  // Prefer challenges for this round; fall back to any active clue variants on the event.
  const pickChallenges = (rows) => {
    const forRound = rows.filter((row) => String(row.roundId) === String(round._id));
    return forRound.length ? forRound : rows;
  };

  const assignments = buildDeterministicSchedule({
    teams,
    startingPoints,
    routes,
    variants: pickChallenges(variants),
    clue2Variants: pickChallenges(clue2Variants),
    clue3Variants: pickChallenges(clue3Variants),
    startsAt: startsAt || round.startsAt,
    releaseIntervalMinutes: interval,
    assignmentStrategy: strategy,
  });

  // Attach real campus place names for Clue 1 / 2 / 3 stops (not Route A/B).
  const checkpointIds = [
    ...new Set(
      assignments.flatMap((row) => [
        row.firstCheckpointId,
        row.secondCheckpointId,
        row.thirdCheckpointId,
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
    return {
      ...row,
      startingPointName: row.startingPointName || row.startingPointCode || null,
      firstStopName: first?.locationName || null,
      secondStopName: second?.locationName || null,
      thirdStopName: third?.locationName || null,
    };
  });

  return {
    round,
    assignments: enriched,
    releaseIntervalMinutes: interval,
    assignmentStrategy: strategy,
    startingPointsUsed: selectCanonicalStartingPoints(startingPoints).map((p) => ({
      id: String(p._id),
      code: p.code,
      name: p.name,
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

async function generateSchedule(options) {
  const result = await previewSchedule(options);
  const { round, assignments } = result;
  if (round.status !== 'scheduled' && options.confirm !== true) {
    throw scheduleError('Regenerating a live/locked round requires confirm: true');
  }
  for (const assignment of assignments) {
    // eslint-disable-next-line no-await-in-loop
    const before = await CampusHuntTeam.findById(assignment.teamId)
      .select('startingPointId routeId scheduledStartAt clue1ChallengeId firstCheckpointId clue2ChallengeId secondCheckpointId clue3ChallengeId thirdCheckpointId currentStage startStatus startingScore currentScore')
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
    },
  });
  return { ...result, postersBound, secondPostersBound, thirdPostersBound };
}

/**
 * Push latest Clue 1 variants + first checkpoints onto every team dashboard.
 * Does not reset live stages or wipe existing release times.
 */
async function resyncClue1TeamBindings({ eventId, roundId, actor = {}, reason = '' }) {
  const round = await CampusHuntRound.findOne({ _id: roundId, eventId });
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);

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
      .select('startingPointId routeId scheduledStartAt roundId currentStage startStatus clue1ChallengeId firstCheckpointId clue2ChallengeId secondCheckpointId clue3ChallengeId thirdCheckpointId');
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
    assignments: bound,
  };
}

async function lockSchedule({ eventId, roundId, actor, reason }) {
  const [round, teams] = await Promise.all([
    CampusHuntRound.findOne({ _id: roundId, eventId }),
    CampusHuntTeam.find({ eventId, roundId }),
  ]);
  if (!round) throw scheduleError('Round not found', 'ROUND_NOT_FOUND', 404);
  if (!teams.length) throw scheduleError('No teams assigned to this round');
  const incomplete = teams.filter((team) => (
    !team.startingPointId
    || !team.routeId
    || !team.scheduledStartAt
    || !team.clue1ChallengeId
    || !team.firstCheckpointId
    || !team.clue2ChallengeId
    || !team.secondCheckpointId
    || !team.clue3ChallengeId
    || !team.thirdCheckpointId
  ));
  if (incomplete.length) {
    throw scheduleError(
      `${incomplete.length} teams missing Clue 1/2/3 bindings (checkpoint or challenge). `
      + 'Save Clue 2 & Clue 3, then Resync before locking.',
      'INCOMPLETE_START_ASSIGNMENTS',
    );
  }
  const pointIds = [...new Set(teams.map((team) => String(team.startingPointId)))];
  const points = await CampusHuntStartingPoint.find({ _id: { $in: pointIds }, active: true });
  if (points.length !== pointIds.length) {
    throw scheduleError('One or more assigned starting points are inactive or missing');
  }
  for (const point of points) {
    const count = teams.filter((team) => String(team.startingPointId) === String(point._id)).length;
    if (count > point.capacity) {
      throw scheduleError(`${point.code} exceeds capacity ${point.capacity}`, 'START_CAPACITY_EXCEEDED');
    }
  }
  const [variants, checkpoints] = await Promise.all([
    CampusHuntChallenge.countDocuments({
      _id: { $in: teams.map((team) => team.clue1ChallengeId) },
      active: true,
      challengeNumber: 1,
    }),
    CampusHuntCheckpoint.countDocuments({
      _id: { $in: teams.map((team) => team.firstCheckpointId) },
      active: true,
      progressionKey: '1',
    }),
  ]);
  if (variants < new Set(teams.map((team) => String(team.clue1ChallengeId))).size) {
    throw scheduleError('One or more Clue 1 variants are inactive or invalid');
  }
  if (checkpoints < new Set(teams.map((team) => String(team.firstCheckpointId))).size) {
    throw scheduleError('One or more first checkpoints are inactive or invalid');
  }
  await CampusHuntTeam.updateMany(
    { eventId, roundId, startStatus: { $ne: 'CANCELLED' } },
    { $set: { startStatus: 'READY', currentStage: 'WAITING' } },
  );
  // Re-bind each Clue 1 / Clue 2 poster to its assigned team before lock
  await syncFirstCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teams.map((team) => ({
      teamId: String(team._id),
      firstCheckpointId: team.firstCheckpointId ? String(team.firstCheckpointId) : null,
    })),
  });
  await syncSecondCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teams.map((team) => ({
      teamId: String(team._id),
      secondCheckpointId: team.secondCheckpointId ? String(team.secondCheckpointId) : null,
    })),
  });
  await syncThirdCheckpointAllowLists({
    eventId,
    roundId,
    assignments: teams.map((team) => ({
      teamId: String(team._id),
      thirdCheckpointId: team.thirdCheckpointId ? String(team.thirdCheckpointId) : null,
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
    after: { teams: teams.length, scheduleLockedAt: round.scheduleLockedAt },
  });
  return { round, teamsReady: teams.length };
}

module.exports = {
  buildDeterministicSchedule,
  previewSchedule,
  generateSchedule,
  lockSchedule,
  resyncClue1TeamBindings,
  syncFirstCheckpointAllowLists,
  syncSecondCheckpointAllowLists,
  syncThirdCheckpointAllowLists,
  selectCanonicalStartingPoints,
  waitCodeFromPoint,
  scheduleError,
};
