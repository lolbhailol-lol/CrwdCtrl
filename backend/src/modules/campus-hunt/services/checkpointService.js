const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntRound = require('../models/CampusHuntRound');
const User = require('../../../model/usermodel');
const {
  stagesAllowingCheckpoint,
  applyCheckpointCompletionCascade,
  canTransition,
} = require('./stateMachine');
const { isRoundClosed, completionMs } = require('./timerService');
const { writeAudit } = require('./auditService');
const {
  assertOnlineRosterReady,
  hasDistinctVerifiedRoster,
  uniqueIdStrings,
} = require('../utils/roster');

async function getCheckpoint(checkpointId) {
  return CampusHuntCheckpoint.findById(checkpointId);
}

async function findTeamByCode(eventId, teamCode) {
  return CampusHuntTeam.findOne({
    eventId,
    teamCode: String(teamCode).trim().toUpperCase(),
  });
}

function checkpointProgressionKey(checkpoint) {
  return String(checkpoint.progressionKey || checkpoint.checkpointKey).toUpperCase();
}

async function getOrCreateVerification(team, checkpoint) {
  let doc = await CampusHuntCheckpointVerification.findOne({
    teamId: team._id,
    checkpointId: checkpoint._id,
  });
  if (doc) return doc;
  try {
    doc = await CampusHuntCheckpointVerification.create({
      eventId: team.eventId,
      teamId: team._id,
      checkpointId: checkpoint._id,
      checkpointKey: checkpointProgressionKey(checkpoint),
      verifiedMemberIds: [],
      status: 'in_progress',
      source: 'online',
    });
  } catch (err) {
    if (err?.code === 11000) {
      return CampusHuntCheckpointVerification.findOne({
        teamId: team._id,
        checkpointId: checkpoint._id,
      });
    }
    throw err;
  }
  return doc;
}

function assertTeamEligibleForCheckpoint(team, checkpoint) {
  if (!checkpoint.active) {
    const err = new Error('Checkpoint is disabled');
    err.status = 409;
    err.code = 'CHECKPOINT_DISABLED';
    throw err;
  }
  if (String(team.routeId) !== String(checkpoint.routeId)) {
    const err = new Error('Team is on a different route');
    err.status = 409;
    err.code = 'WRONG_ROUTE';
    throw err;
  }
  if (
    String(team.eventId) !== String(checkpoint.eventId)
    || String(team.roundId || '') !== String(checkpoint.roundId || '')
  ) {
    const err = new Error('Checkpoint belongs to a different event or round');
    err.status = 409;
    err.code = 'WRONG_EVENT_OR_ROUND';
    throw err;
  }
  const key = checkpointProgressionKey(checkpoint);
  if (key === '1' && String(team.firstCheckpointId || '') !== String(checkpoint._id)) {
    const err = new Error('This is not the team’s assigned first checkpoint');
    err.status = 409;
    err.code = 'WRONG_FIRST_CHECKPOINT';
    throw err;
  }
  if (
    checkpoint.allowedTeamIds?.length
    && !checkpoint.allowedTeamIds.some((id) => String(id) === String(team._id))
  ) {
    const err = new Error('Team is not allowed at this checkpoint');
    err.status = 409;
    err.code = 'TEAM_NOT_ALLOWED';
    throw err;
  }
  if (team.currentStage === 'SCORE_LOCKED') {
    const err = new Error('Team score is locked');
    err.status = 409;
    throw err;
  }
  const allowed = stagesAllowingCheckpoint(key);
  if (!allowed.includes(team.currentStage)) {
    const err = new Error('Team is not eligible for this checkpoint yet');
    err.status = 409;
    err.code = 'WRONG_STAGE';
    throw err;
  }
}

async function scanTeamPreview(eventId, checkpoint, teamCode) {
  const team = await findTeamByCode(eventId, teamCode);
  if (!team) {
    return { valid: false, message: 'Team not found' };
  }
  try {
    assertTeamEligibleForCheckpoint(team, checkpoint);
  } catch (err) {
    const expected = team.firstCheckpointId
      ? await CampusHuntCheckpoint.findById(team.firstCheckpointId)
        .select('code locationName progressionKey')
        .lean()
      : null;
    return {
      valid: false,
      message: err.message,
      code: err.code,
      team: {
        teamCode: team.teamCode,
        teamName: team.teamName,
        currentStage: team.currentStage,
      },
      expectedCheckpoint: expected
        ? {
          id: String(expected._id),
          code: expected.code,
          locationName: expected.locationName,
        }
        : null,
    };
  }

  const verification = await getOrCreateVerification(team, checkpoint);
  const memberIds = team.allMemberIds();
  const users = await User.find({ _id: { $in: memberIds } }).select('name email');
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const members = memberIds.map((id) => ({
    userId: id,
    name: userMap.get(id)?.name || 'Member',
    verified: verification.verifiedMemberIds.some((v) => String(v) === id),
    isLeader: String(team.leaderUserId) === id,
  }));

  return {
    valid: true,
    team: {
      id: String(team._id),
      teamCode: team.teamCode,
      teamName: team.teamName,
      currentStage: team.currentStage,
    },
    checkpoint: {
      id: String(checkpoint._id),
      checkpointKey: checkpointProgressionKey(checkpoint),
      code: checkpoint.code || checkpoint.checkpointKey,
      locationName: checkpoint.locationName,
    },
    expectedCheckpoint: {
      id: String(checkpoint._id),
      code: checkpoint.code || checkpoint.checkpointKey,
      locationName: checkpoint.locationName,
    },
    members,
    verifiedCount: verification.verifiedMemberIds.length,
    requiredCount: 4,
    status: verification.status,
  };
}

async function verifyMember({
  team,
  checkpoint,
  userId,
  volunteer,
  now = new Date(),
}) {
  assertTeamEligibleForCheckpoint(team, checkpoint);
  if (!team.includesUser(userId)) {
    const err = new Error('User is not on this team');
    err.status = 400;
    throw err;
  }

  const verification = await getOrCreateVerification(team, checkpoint);
  if (verification.status === 'complete' || verification.status === 'manual_reconciled') {
    return {
      alreadyComplete: true,
      verifiedCount: verification.verifiedMemberIds.length,
      requiredCount: 4,
      status: verification.status,
    };
  }

  const already = verification.verifiedMemberIds.some((id) => String(id) === String(userId));
  if (!already) {
    await CampusHuntCheckpointVerification.findOneAndUpdate(
      { _id: verification._id, status: 'in_progress' },
      {
        $addToSet: { verifiedMemberIds: userId },
        $set: {
          volunteerId: volunteer?.volunteerAccessId,
          volunteerLabel: volunteer?.label,
        },
      },
    );
  }

  const fresh = await CampusHuntCheckpointVerification.findById(verification._id);
  return {
    alreadyComplete: false,
    verifiedCount: fresh.verifiedMemberIds.length,
    requiredCount: 4,
    status: fresh.status,
    membersVerified: fresh.verifiedMemberIds.map(String),
  };
}

async function completeCheckpoint({
  team,
  checkpoint,
  volunteer,
  source = 'online',
  notes = '',
  now = new Date(),
  forceMemberIds = null,
}) {
  assertTeamEligibleForCheckpoint(team, checkpoint);
  const round = team.roundId ? await CampusHuntRound.findById(team.roundId) : null;
  if (round && isRoundClosed(round, now) && source === 'online') {
    const err = new Error('Round is closed');
    err.status = 409;
    err.code = 'ROUND_CLOSED';
    throw err;
  }

  // Idempotent if already complete
  const existing = await CampusHuntCheckpointVerification.findOne({
    teamId: team._id,
    checkpointId: checkpoint._id,
  });
  if (existing && (existing.status === 'complete' || existing.status === 'manual_reconciled')) {
    const freshTeam = await CampusHuntTeam.findById(team._id);
    return {
      alreadyProcessed: true,
      status: existing.status,
      teamStage: freshTeam?.currentStage,
      currentScore: freshTeam?.currentScore,
    };
  }

  if (source === 'online') {
    assertTeamEligibleForCheckpoint(team, checkpoint);
  }

  let verification = await getOrCreateVerification(team, checkpoint);

  const rosterUnique = assertOnlineRosterReady(team, 4);

  if (forceMemberIds) {
    const ids = uniqueIdStrings(forceMemberIds);
    const teamIds = new Set(rosterUnique);
    for (const id of ids) {
      if (!teamIds.has(id)) {
        const err = new Error('Manual verification includes non-member');
        err.status = 400;
        throw err;
      }
    }
    if (ids.length < 4) {
      const err = new Error('All 4 distinct members must be listed for verification');
      err.status = 400;
      err.code = 'ROSTER_DUPLICATE';
      throw err;
    }
    verification = await CampusHuntCheckpointVerification.findOneAndUpdate(
      { _id: verification._id },
      { $set: { verifiedMemberIds: ids } },
      { new: true },
    );
  }

  verification = await CampusHuntCheckpointVerification.findById(verification._id);
  const verifiedDistinctOk = hasDistinctVerifiedRoster(
    verification.verifiedMemberIds,
    rosterUnique,
    4,
  );
  if (!verifiedDistinctOk && (source === 'online' || forceMemberIds)) {
    const err = new Error('All 4 distinct team members must be verified');
    err.status = 400;
    err.code = 'INCOMPLETE_ROSTER';
    throw err;
  }

  const completed = await CampusHuntCheckpointVerification.findOneAndUpdate(
    {
      _id: verification._id,
      status: 'in_progress',
    },
    {
      $set: {
        status: source === 'manual' ? 'manual_reconciled' : 'complete',
        verifiedAt: now,
        source,
        notes,
        volunteerId: volunteer?.volunteerAccessId || volunteer?.actorId,
        volunteerLabel: volunteer?.label || volunteer?.actorLabel,
      },
    },
    { new: true },
  );

  if (!completed) {
    const again = await CampusHuntCheckpointVerification.findById(verification._id);
    const freshTeam = await CampusHuntTeam.findById(team._id);
    return {
      alreadyProcessed: true,
      status: again?.status,
      teamStage: freshTeam?.currentStage,
      currentScore: freshTeam?.currentScore,
    };
  }

  // Cascade stage transitions
  const teamDoc = await CampusHuntTeam.findById(team._id);
  const fromStage = teamDoc.currentStage;
  const progressionKey = checkpointProgressionKey(checkpoint);
  applyCheckpointCompletionCascade(teamDoc, progressionKey);
  if (progressionKey === '1') teamDoc.startStatus = 'ACTIVE';

  const extra = {
    currentStage: teamDoc.currentStage,
    startStatus: teamDoc.startStatus,
    lastCheckpointNumber: checkpoint.checkpointNumber,
  };

  if (progressionKey === 'FINISH' || teamDoc.currentStage === 'SCORE_LOCKED') {
    extra.finishedAt = now;
    extra.scoreLockedAt = now;
    extra.finalScore = teamDoc.currentScore;
    extra.status = 'finished';
    extra.startStatus = 'COMPLETED';
  }

  const updateOps = { $set: extra };
  if (
    (progressionKey === 'FINISH' || teamDoc.currentStage === 'SCORE_LOCKED')
    && round?.startsAt
  ) {
    updateOps.$set['stats.totalCompletionMs'] = completionMs(round.startsAt, now);
  }

  // Set final cascaded stage only if still at fromStage (single writer).
  const updatedTeam = await CampusHuntTeam.findOneAndUpdate(
    { _id: team._id, currentStage: fromStage },
    updateOps,
    { new: true },
  );

  if (!updatedTeam) {
    // Another writer won — return current
    const fresh = await CampusHuntTeam.findById(team._id);
    return {
      alreadyProcessed: true,
      status: completed.status,
      teamStage: fresh?.currentStage,
      currentScore: fresh?.currentScore,
    };
  }

  await writeAudit({
    eventId: team.eventId,
    actorType: volunteer?.actorType || 'volunteer',
    actorId: volunteer?.volunteerAccessId || volunteer?.actorId,
    actorLabel: volunteer?.label || volunteer?.actorLabel,
    action: 'checkpoint_verified',
    targetType: 'team',
    targetId: team._id,
    after: {
      checkpointKey: progressionKey,
      checkpointCode: checkpoint.code || checkpoint.checkpointKey,
      stage: updatedTeam.currentStage,
      source,
    },
  });

  return {
    alreadyProcessed: false,
    status: completed.status,
    teamStage: updatedTeam.currentStage,
    currentScore: updatedTeam.currentScore,
    message: 'CHECKPOINT VERIFIED',
  };
}

function normalizePasteCode(raw) {
  let s = String(raw || '').trim().toUpperCase();
  // Accept CH-AB12CD34 / CP1-AB12CD34 / AB12CD34
  s = s.replace(/^CH[-_]?/i, '').replace(/^CP\d+[-_]?/i, '');
  s = s.replace(/[^A-Z0-9]/g, '');
  return s;
}

/**
 * Station QR payload printed at physical checkpoints.
 * Players scan this — not a static guessable code without secret.
 */
function buildStationQrPayload(checkpoint) {
  return JSON.stringify({
    type: 'campus_hunt_station',
    eventId: String(checkpoint.eventId),
    checkpointId: String(checkpoint._id),
    checkpointKey: checkpointProgressionKey(checkpoint),
    checkpointCode: checkpoint.code || checkpoint.checkpointKey,
    secret: checkpoint.qrSecret,
    pasteCode: checkpoint.pasteCode || undefined,
  });
}

function parseStationQr(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.type !== 'campus_hunt_station') return null;
    return {
      eventId: String(parsed.eventId || ''),
      checkpointId: String(parsed.checkpointId || ''),
      checkpointKey: parsed.checkpointKey ? String(parsed.checkpointKey) : null,
      secret: String(parsed.secret || ''),
      pasteCode: parsed.pasteCode ? normalizePasteCode(parsed.pasteCode) : null,
    };
  } catch {
    return null;
  }
}

async function ensurePasteCode(checkpoint) {
  if (checkpoint.pasteCode) return checkpoint;
  const crypto = require('crypto');
  checkpoint.pasteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  await checkpoint.save();
  return checkpoint;
}

/**
 * Resolve checkpoint from full station QR JSON or short paste code.
 */
async function resolveStationCheckpoint({ team, raw }) {
  const parsed = parseStationQr(raw);
  if (parsed?.checkpointId && parsed.secret) {
    const checkpoint = await CampusHuntCheckpoint.findById(parsed.checkpointId)
      .select('+qrSecret +pasteCode');
    if (!checkpoint) {
      const err = new Error('Checkpoint not found');
      err.status = 404;
      throw err;
    }
    if (String(checkpoint.eventId) !== String(team.eventId)) {
      const err = new Error('This QR is for a different event');
      err.status = 403;
      throw err;
    }
    if (checkpoint.qrSecret !== parsed.secret) {
      const err = new Error('Invalid or outdated station QR');
      err.status = 403;
      err.code = 'BAD_STATION_SECRET';
      throw err;
    }
    await ensurePasteCode(checkpoint);
    return checkpoint;
  }

  const pasteCode = normalizePasteCode(raw);
  if (!pasteCode || pasteCode.length < 6) {
    const err = new Error('Invalid station code. Scan the poster QR or paste the station code.');
    err.status = 400;
    err.code = 'INVALID_STATION_QR';
    throw err;
  }

  let checkpoint = await CampusHuntCheckpoint.findOne({
    eventId: team.eventId,
    routeId: team.routeId,
    pasteCode,
  }).select('+qrSecret +pasteCode');

  // Backfill: older checkpoints may lack pasteCode — match by qrSecret as last resort
  if (!checkpoint) {
    checkpoint = await CampusHuntCheckpoint.findOne({
      eventId: team.eventId,
      routeId: team.routeId,
      qrSecret: String(raw || '').trim().toLowerCase(),
    }).select('+qrSecret +pasteCode');
  }

  if (!checkpoint) {
    const err = new Error('Unknown station code for your route');
    err.status = 403;
    err.code = 'BAD_STATION_SECRET';
    throw err;
  }
  await ensurePasteCode(checkpoint);
  return checkpoint;
}

/**
 * Player scans station QR at the physical checkpoint.
 * All 4 members must scan before Clue 2 (or next stage) unlocks.
 * Production fallback: paste short station code from the poster / admin list.
 */
async function playerScanStation({ team, userId, raw, now = new Date() }) {
  const checkpoint = await resolveStationCheckpoint({ team, raw });

  assertTeamEligibleForCheckpoint(team, checkpoint);
  if (!team.includesUser(userId)) {
    const err = new Error('You are not on this team');
    err.status = 403;
    throw err;
  }
  assertOnlineRosterReady(team, 4);

  const verification = await getOrCreateVerification(team, checkpoint);
  if (verification.status === 'complete' || verification.status === 'manual_reconciled') {
    const freshTeam = await CampusHuntTeam.findById(team._id);
    return {
      alreadyComplete: true,
      verifiedCount: 4,
      requiredCount: 4,
      youScanned: true,
      teamStage: freshTeam?.currentStage,
      unlockedClue2: String(freshTeam?.currentStage || '').startsWith('CLUE_2'),
      checkpoint: {
        id: String(checkpoint._id),
        checkpointKey: checkpointProgressionKey(checkpoint),
        code: checkpoint.code || checkpoint.checkpointKey,
        locationName: checkpoint.locationName,
      },
    };
  }

  await CampusHuntCheckpointVerification.findOneAndUpdate(
    { _id: verification._id, status: 'in_progress' },
    {
      $addToSet: { verifiedMemberIds: userId },
      $set: { source: 'online', volunteerLabel: 'player_station_scan' },
    },
  );

  const fresh = await CampusHuntCheckpointVerification.findById(verification._id);
  const youScanned = fresh.verifiedMemberIds.some((id) => String(id) === String(userId));

  let teamStage = team.currentStage;
  let unlockedNext = false;

  const rosterUnique = uniqueIdStrings([
    team.leaderUserId,
    ...(team.memberUserIds || []),
  ]);
  const distinctVerified = uniqueIdStrings(fresh.verifiedMemberIds)
    .filter((id) => rosterUnique.includes(id)).length;

  if (distinctVerified >= 4) {
    const result = await completeCheckpoint({
      team,
      checkpoint,
      volunteer: {
        actorType: 'player',
        actorId: userId,
        label: 'player_station_scan',
      },
      source: 'online',
      now,
    });
    teamStage = result.teamStage;
    unlockedNext = true;

    // Soft anti-cheat: very fast CP clears after clue solve are logged for ops
    if (result.teamStage && !result.alreadyProcessed) {
      await writeAudit({
        eventId: team.eventId,
        actorType: 'system',
        actorId: 'anti_cheat',
        action: 'checkpoint_cleared',
        targetType: 'team',
        targetId: team._id,
        metadata: {
          checkpointKey: checkpointProgressionKey(checkpoint),
          verifiedCount: distinctVerified,
          fromStage: team.currentStage,
          toStage: result.teamStage,
        },
      });
    }
  }

  await writeAudit({
    eventId: team.eventId,
    actorType: 'player',
    actorId: userId,
    action: 'player_station_scan',
    targetType: 'checkpoint',
    targetId: checkpoint._id,
    after: { verifiedCount: distinctVerified, teamStage },
  });

  const stageStr = String(teamStage || '');
  let unlockLabel = 'Next step unlocked';
  if (stageStr.includes('CLUE_2')) unlockLabel = 'Clue 2 unlocked';
  else if (stageStr.includes('CLUE_3')) unlockLabel = 'Decode clue (Clue 3) unlocked';
  else if (stageStr.includes('CLUE_4')) unlockLabel = 'Final clue unlocked';
  else if (stageStr.includes('SCORE_LOCKED') || stageStr.includes('FINISH')) {
    unlockLabel = 'Finish complete';
  }

  return {
    alreadyComplete: false,
    verifiedCount: distinctVerified,
    requiredCount: 4,
    youScanned,
    teamStage,
    unlockedNext,
    unlockedClue2: unlockedNext && stageStr.includes('CLUE_2'),
    unlockedClue3: unlockedNext && stageStr.includes('CLUE_3'),
    message:
      distinctVerified >= 4
        ? `All 4 members scanned! ${unlockLabel}.`
        : `Scanned (${distinctVerified}/4). Waiting for teammates.`,
    checkpoint: {
      id: String(checkpoint._id),
      checkpointKey: checkpointProgressionKey(checkpoint),
      code: checkpoint.code || checkpoint.checkpointKey,
      locationName: checkpoint.locationName,
    },
  };
}

/**
 * Pending checkpoint status for player UI (after Clue 1 / between stages).
 */
async function getPendingCheckpointStatus(team, userId) {
  const stage = team.currentStage;
  let checkpointKey = null;
  if (stage === 'CLUE_1_COMPLETED') checkpointKey = '1';
  else if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(stage)) checkpointKey = '2';
  else if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(stage)) checkpointKey = '3';
  else if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(stage)) checkpointKey = 'FINISH';
  else return null;

  const checkpoint = checkpointKey === '1' && team.firstCheckpointId
    ? await CampusHuntCheckpoint.findOne({
      _id: team.firstCheckpointId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      progressionKey: '1',
      active: true,
    })
    : await CampusHuntCheckpoint.findOne({
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      progressionKey: checkpointKey,
      active: true,
    });
  if (!checkpoint) return null;

  const verification = await CampusHuntCheckpointVerification.findOne({
    teamId: team._id,
    checkpointId: checkpoint._id,
  });
  const roster = uniqueIdStrings([
    team.leaderUserId,
    ...(team.memberUserIds || []),
  ]);
  const verifiedIds = uniqueIdStrings(verification?.verifiedMemberIds || [])
    .filter((id) => roster.includes(id));

  return {
    checkpointId: String(checkpoint._id),
    checkpointKey: checkpointProgressionKey(checkpoint),
    code: checkpoint.code || checkpoint.checkpointKey,
    locationName: checkpoint.locationName,
    publicInstruction:
      checkpoint.publicInstruction
      || `Find the station QR at ${checkpoint.locationName}. All 4 members must scan it.`,
    verifiedCount: verifiedIds.length,
    requiredCount: 4,
    youScanned: verifiedIds.includes(String(userId)),
    status: verification?.status || 'in_progress',
    membersNeeded: Math.max(0, 4 - verifiedIds.length),
    rosterUniqueCount: roster.length,
  };
}

module.exports = {
  getCheckpoint,
  findTeamByCode,
  getOrCreateVerification,
  assertTeamEligibleForCheckpoint,
  scanTeamPreview,
  verifyMember,
  completeCheckpoint,
  canTransition,
  buildStationQrPayload,
  parseStationQr,
  ensurePasteCode,
  resolveStationCheckpoint,
  playerScanStation,
  getPendingCheckpointStatus,
};

