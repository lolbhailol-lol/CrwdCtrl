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
  const isFirstStop = key === '1';
  const isSecondStop = key === '2';
  const isThirdStop = key === '3';
  // Team-bound posters: reject other teams' QRs before route check.
  if (isFirstStop && String(team.firstCheckpointId || '') !== String(checkpoint._id)) {
    const err = new Error(
      'Wrong poster — this QR is for another team. Scan only your assigned station QR.',
    );
    err.status = 409;
    err.code = 'WRONG_FIRST_CHECKPOINT';
    throw err;
  }
  if (isSecondStop && String(team.secondCheckpointId || '') !== String(checkpoint._id)) {
    const err = new Error(
      'Wrong poster — this SECOND SCAN QR is for another team. Scan only your assigned poster.',
    );
    err.status = 409;
    err.code = 'WRONG_SECOND_CHECKPOINT';
    throw err;
  }
  if (isThirdStop && String(team.thirdCheckpointId || '') !== String(checkpoint._id)) {
    const err = new Error(
      'Wrong card — this Checkpoint 3 QR is for another team. Scan only your blue card.',
    );
    err.status = 409;
    err.code = 'WRONG_THIRD_CHECKPOINT';
    throw err;
  }
  if (
    checkpoint.allowedTeamIds?.length
    && !checkpoint.allowedTeamIds.some((id) => String(id) === String(team._id))
  ) {
    const err = new Error(
      (isFirstStop || isSecondStop || isThirdStop)
        ? 'Wrong poster — this QR is for another team. Scan only your assigned station QR.'
        : 'Team is not allowed at this checkpoint',
    );
    err.status = 409;
    err.code = 'TEAM_NOT_ALLOWED';
    throw err;
  }
  if (String(team.routeId) !== String(checkpoint.routeId)) {
    const err = new Error(
      (isFirstStop || isSecondStop || isThirdStop)
        ? 'Wrong poster — this QR is for another team. Scan only your assigned station QR.'
        : 'Team is on a different route',
    );
    err.status = 409;
    err.code = 'WRONG_ROUTE';
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
    const reason = round.status === 'locked' || round.status === 'finalized'
      ? `Round is ${round.status}`
      : (round.endsAt
        ? `Round ended at ${new Date(round.endsAt).toISOString()} — ask admin to extend duration / Start again`
        : 'Round is closed');
    const err = new Error(reason);
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
    const progressionKey = checkpointProgressionKey(checkpoint);
    const unlockStages = stagesAllowingCheckpoint(progressionKey);
    // Repair: verification already complete but stage cascade lost a race.
    if (
      again
      && ['complete', 'manual_reconciled'].includes(again.status)
      && freshTeam
      && unlockStages.includes(freshTeam.currentStage)
    ) {
      const teamDoc = freshTeam;
      const fromStage = teamDoc.currentStage;
      applyCheckpointCompletionCascade(teamDoc, progressionKey);
      if (progressionKey === '1') teamDoc.startStatus = 'ACTIVE';

      const extra = {
        currentStage: teamDoc.currentStage,
        startStatus: teamDoc.startStatus || freshTeam.startStatus,
        lastCheckpointNumber: checkpoint.checkpointNumber,
      };
      if (progressionKey === 'FINISH' || teamDoc.currentStage === 'SCORE_LOCKED') {
        extra.finishedAt = now;
        extra.scoreLockedAt = now;
        extra.finalScore = teamDoc.currentScore;
        extra.status = 'finished';
        extra.startStatus = 'COMPLETED';
        const startClock = teamDoc.actualStartAt || teamDoc.scheduledStartAt || round?.startsAt;
        if (startClock) {
          extra['stats.totalCompletionMs'] = completionMs(startClock, now);
        }
      }

      const repaired = await CampusHuntTeam.findOneAndUpdate(
        { _id: team._id, currentStage: fromStage },
        { $set: extra },
        { new: true },
      );
      if (repaired) {
        return {
          alreadyProcessed: false,
          status: again.status,
          teamStage: repaired.currentStage,
          currentScore: repaired.currentScore,
          message: 'CHECKPOINT VERIFIED',
        };
      }
    }
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
  if (progressionKey === 'FINISH' || teamDoc.currentStage === 'SCORE_LOCKED') {
    const startClock = teamDoc.actualStartAt || teamDoc.scheduledStartAt || round?.startsAt;
    if (startClock) {
      updateOps.$set['stats.totalCompletionMs'] = completionMs(startClock, now);
    }
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

  // Foreign poster paste (other team's QR at same campus spot): resolve then reject clearly
  if (!checkpoint) {
    checkpoint = await CampusHuntCheckpoint.findOne({
      eventId: team.eventId,
      pasteCode,
    }).select('+qrSecret +pasteCode');
  }

  // Backfill: older checkpoints may lack pasteCode — match by qrSecret as last resort
  if (!checkpoint) {
    checkpoint = await CampusHuntCheckpoint.findOne({
      eventId: team.eventId,
      routeId: team.routeId,
      qrSecret: String(raw || '').trim().toLowerCase(),
    }).select('+qrSecret +pasteCode');
  }

  if (!checkpoint) {
    const err = new Error('Unknown station code. Scan your assigned poster QR only.');
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
  const progressionKey = checkpointProgressionKey(checkpoint);

  // Finish is organizer-only (mark reached at start) — players cannot self-lock via FINISH QR.
  if (progressionKey === 'FINISH') {
    const err = new Error(
      'Report to your start location. Ask the organizer to mark your team reached — do not scan a finish QR.',
    );
    err.status = 409;
    err.code = 'ORGANIZER_FINISH_ONLY';
    throw err;
  }

  assertTeamEligibleForCheckpoint(team, checkpoint);
  if (!team.includesUser(userId)) {
    const err = new Error('You are not on this team');
    err.status = 403;
    throw err;
  }
  assertOnlineRosterReady(team, 4);

  const verification = await getOrCreateVerification(team, checkpoint);
  if (verification.status === 'complete' || verification.status === 'manual_reconciled') {
    // Repair stuck stage: 4/4 done but cascade lost a race.
    const freshTeam = await CampusHuntTeam.findById(team._id);
    const unlockStages = stagesAllowingCheckpoint(progressionKey);
    if (
      freshTeam
      && unlockStages.includes(freshTeam.currentStage)
    ) {
      const repaired = await completeCheckpoint({
        team: freshTeam,
        checkpoint,
        volunteer: {
          actorType: 'player',
          actorId: userId,
          label: 'player_station_scan_repair',
        },
        source: 'online',
        now,
      });
      return {
        alreadyComplete: true,
        verifiedCount: 4,
        requiredCount: 4,
        youScanned: true,
        teamStage: repaired.teamStage,
        unlockedNext: true,
        unlockedClue2: String(repaired.teamStage || '').startsWith('CLUE_2'),
        unlockedClue3: String(repaired.teamStage || '').includes('CLUE_3'),
        message: repaired.message || 'Checkpoint cleared',
        checkpoint: {
          id: String(checkpoint._id),
          checkpointKey: progressionKey,
          code: checkpoint.code || checkpoint.checkpointKey,
          locationName: checkpoint.locationName,
        },
      };
    }
    return {
      alreadyComplete: true,
      verifiedCount: 4,
      requiredCount: 4,
      youScanned: true,
      teamStage: freshTeam?.currentStage,
      unlockedClue2: String(freshTeam?.currentStage || '').startsWith('CLUE_2'),
      checkpoint: {
        id: String(checkpoint._id),
        checkpointKey: progressionKey,
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
  else if (stageStr.includes('CLUE_3')) unlockLabel = 'Clue 3 riddle unlocked';
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
        ? `All 4 members scanned! ${unlockLabel}. Pick up your card and take it with you.`
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
  else if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(stage)) {
    // Organizer marks reached at start — do not expose FINISH QR as pending player scan.
    return null;
  }
  else return null;

  if (checkpointKey === '2' && !team.secondCheckpointId) {
    return {
      checkpointId: null,
      checkpointKey: '2',
      code: null,
      locationName: null,
      assignmentMissing: true,
      publicInstruction:
        'Your green SECOND SCAN card is not assigned yet. Ask an organizer to resync Clue 2 bindings.',
      verifiedCount: 0,
      requiredCount: 4,
      youScanned: false,
      status: 'unassigned',
      membersNeeded: 4,
    };
  }
  if (checkpointKey === '3' && !team.thirdCheckpointId) {
    return {
      checkpointId: null,
      checkpointKey: '3',
      code: null,
      locationName: null,
      assignmentMissing: true,
      publicInstruction:
        'Your blue Checkpoint 3 card is not assigned yet. Ask an organizer to resync Clue 3 bindings.',
      verifiedCount: 0,
      requiredCount: 4,
      youScanned: false,
      status: 'unassigned',
      membersNeeded: 4,
    };
  }

  const checkpoint = checkpointKey === '1' && team.firstCheckpointId
    ? await CampusHuntCheckpoint.findOne({
      _id: team.firstCheckpointId,
      eventId: team.eventId,
      roundId: team.roundId,
      routeId: team.routeId,
      progressionKey: '1',
      active: true,
    })
    : checkpointKey === '2'
      ? await CampusHuntCheckpoint.findOne({
        _id: team.secondCheckpointId,
        eventId: team.eventId,
        roundId: team.roundId,
        routeId: team.routeId,
        progressionKey: '2',
        active: true,
      })
      : checkpointKey === '3'
        ? await CampusHuntCheckpoint.findOne({
          _id: team.thirdCheckpointId,
          eventId: team.eventId,
          roundId: team.roundId,
          routeId: team.routeId,
          progressionKey: '3',
          active: true,
        })
        : null;
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

  const rosterNames = [
    team.leaderName || team.accessPack?.leader?.name || 'Leader',
    ...(Array.isArray(team.memberNames) ? team.memberNames : []),
  ];
  while (rosterNames.length < roster.length) {
    rosterNames.push(`Player ${rosterNames.length}`);
  }
  const scanRoster = roster.map((id, idx) => ({
    userId: id,
    name: rosterNames[idx] || (idx === 0 ? 'Leader' : `Player ${idx}`),
    role: idx === 0 ? 'leader' : 'player',
    scanned: verifiedIds.includes(id),
  }));

  const teamBound = checkpointKey === '1' || checkpointKey === '2' || checkpointKey === '3';
  const scanKind = checkpointKey === '3'
    ? 'THIRD SCAN'
    : checkpointKey === '2'
      ? 'SECOND SCAN'
      : 'FIRST SCAN';
  return {
    checkpointId: String(checkpoint._id),
    checkpointKey: checkpointProgressionKey(checkpoint),
    code: checkpoint.code || checkpoint.checkpointKey,
    locationName: checkpoint.locationName,
    posterLabel: teamBound
      ? {
        teamCode: team.teamCode || null,
        teamName: team.teamName || null,
        scanKind,
      }
      : null,
    publicInstruction:
      checkpoint.publicInstruction
      || (checkpointKey === '1'
        ? (
          `At ${checkpoint.locationName}, find the yellow FIRST SCAN card labeled `
          + `"${team.teamCode || 'your team'}${team.teamName ? ` — ${team.teamName}` : ''}". `
          + 'Scan only that QR. All 4 members must scan to unlock Clue 2. '
          + 'Then pick up your card and take it with you so the next teams only find theirs.'
        )
        : checkpointKey === '2'
          ? (
            `At ${checkpoint.locationName}, find the green SECOND SCAN card labeled `
            + `"${team.teamCode || 'your team'}${team.teamName ? ` — ${team.teamName}` : ''}". `
            + 'All 4 members scan here to unlock Clue 3 (decode). '
            + 'Pick up this green card when you leave.'
          )
          : checkpointKey === '3'
            ? (
              `At ${checkpoint.locationName}, find the blue Checkpoint 3 card labeled `
              + `"${team.teamCode || 'your team'}${team.teamName ? ` — ${team.teamName}` : ''}". `
              + 'All 4 members scan to unlock the Final clue. '
              + 'Then pick up your blue card and take it so later teams only see their own.'
            )
            : `Find the station QR at ${checkpoint.locationName}. All 4 members must scan it.`),
    verifiedCount: verifiedIds.length,
    requiredCount: 4,
    youScanned: verifiedIds.includes(String(userId)),
    status: verification?.status || 'in_progress',
    membersNeeded: Math.max(0, 4 - verifiedIds.length),
    rosterUniqueCount: roster.length,
    scanRoster,
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

