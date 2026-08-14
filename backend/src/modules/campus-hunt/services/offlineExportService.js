/**
 * Export Offline Hunt Packs — one JSON bundle per team for airplane-mode play.
 */

const crypto = require('crypto');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const { decryptCredential } = require('../utils/credentialCipher');
const { selectCompetitionTeams } = require('./startScheduleService');
const { buildStationQrPayload } = require('./checkpointService');
const { CLUE_HOW_TO, DEFAULT_SCORING_CONFIG } = require('../constants');
const {
  OFFLINE_BUNDLE_VERSION,
  OFFLINE_BUNDLE_TYPE,
  OFFLINE_QR_TYPES,
} = require('../constants/offlineBundle');

function bundleSigningKey(eventId, teamCode) {
  const secret = process.env.OFFLINE_BUNDLE_KEY
    || process.env.JWT_SECRET
    || 'campus-hunt-offline-dev-key';
  return crypto
    .createHmac('sha256', secret)
    .update(`${eventId}:${teamCode}`)
    .digest('hex');
}

function teamPasswordFromAccessPack(team) {
  const pack = team.accessPack || {};
  const leader = pack.leader || {};
  const sharedScannerPassword = decryptCredential(
    pack.encryptedSharedScannerPassword || pack.sharedScannerPassword || '',
  );
  return decryptCredential(
    pack.encryptedTeamPassword
      || pack.encryptedSharedScannerPassword
      || pack.sharedScannerPassword
      || leader.encryptedPassword
      || leader.password
      || '',
  ) || sharedScannerPassword || '';
}

function buildRoster(team) {
  const pack = team.accessPack || {};
  const leader = pack.leader || {};
  const scanners = Array.isArray(pack.scanners) ? pack.scanners : [];
  const roster = [{
    slot: 0,
    role: 'leader',
    name: leader.name || team.leaderName || 'Leader',
    memberKey: 'leader',
  }];
  const memberNames = team.memberNames || [];
  for (let i = 0; i < Math.max(memberNames.length, scanners.length, 3); i += 1) {
    if (i >= 3) break;
    roster.push({
      slot: i + 1,
      role: 'member',
      name: scanners[i]?.name || memberNames[i] || `Player ${i + 1}`,
      memberKey: `member${i + 1}`,
    });
  }
  return roster.slice(0, 4);
}

function serializeChallenge(ch) {
  if (!ch) return null;
  return {
    id: String(ch._id),
    challengeNumber: ch.challengeNumber,
    type: ch.type,
    prompt: ch.prompt || '',
    memberPrompts: Array.isArray(ch.memberPrompts) ? ch.memberPrompts : [],
    answer: String(ch.answer || '').trim(),
    acceptedAnswers: Array.isArray(ch.acceptedAnswers)
      ? ch.acceptedAnswers.map((a) => String(a || '').trim()).filter(Boolean)
      : [],
    hintText: ch.hintText || '',
    hintCost: ch.hintCost ?? 15,
    maxAttempts: ch.maxAttempts ?? 3,
    timerSeconds: ch.timerSeconds ?? 0,
    basePoints: ch.basePoints ?? 0,
    speedBonusBands: ch.speedBonusBands || [],
    destinationInstruction: ch.destinationInstruction || '',
    howTo: CLUE_HOW_TO[ch.challengeNumber] || null,
  };
}

function serializeCheckpoint(cp) {
  if (!cp) return null;
  const payload = buildStationQrPayload(cp);
  return {
    id: String(cp._id),
    progressionKey: String(cp.progressionKey || cp.checkpointKey || '1'),
    checkpointKey: cp.checkpointKey,
    code: cp.code || cp.checkpointKey,
    stationCode: cp.stationCode || '',
    locationName: cp.locationName || '',
    publicInstruction: cp.publicInstruction || '',
    qrSecret: cp.qrSecret,
    pasteCode: cp.pasteCode || '',
    qrPayload: payload,
    pasteHint: cp.pasteCode ? `CH-${cp.pasteCode}` : '',
  };
}

function routeStop(checkpointDoc, label) {
  if (!checkpointDoc) return null;
  const serialized = serializeCheckpoint(checkpointDoc);
  return serialized ? { label, ...serialized } : null;
}

/**
 * @param {string} eventId
 * @returns {Promise<{ event, exportedAt, bundles, warnings, incompleteTeams }>}
 */
async function exportOfflinePacks(eventId) {
  const event = await CampusHuntEvent.findById(eventId).lean();
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const teamsRaw = await CampusHuntTeam.find({ eventId })
    .select('+accessPack.leader.encryptedPassword +accessPack.scanners.encryptedPassword '
      + '+accessPack.encryptedSharedScannerPassword +accessPack.encryptedTeamPassword')
    .lean();
  const teamCapacity = Math.max(1, Number(event.teamCapacity) || teamsRaw.length || 8);
  const teams = selectCompetitionTeams(teamsRaw, teamCapacity);

  const challengeIds = new Set();
  const checkpointIds = new Set();
  const startIds = new Set();

  for (const team of teams) {
    for (const field of [
      'clue1ChallengeId', 'clue2ChallengeId', 'clue3ChallengeId',
      'clue4ChallengeId', 'clue5ChallengeId',
      'firstCheckpointId', 'secondCheckpointId', 'thirdCheckpointId', 'fourthCheckpointId',
    ]) {
      if (team[field]) {
        if (field.startsWith('clue')) challengeIds.add(String(team[field]));
        else checkpointIds.add(String(team[field]));
      }
    }
    if (team.startingPointId) startIds.add(String(team.startingPointId));
  }

  const [challenges, checkpoints, starts] = await Promise.all([
    challengeIds.size
      ? CampusHuntChallenge.find({ _id: { $in: [...challengeIds] } }).select('+answer +acceptedAnswers +hintText').lean()
      : [],
    checkpointIds.size
      ? CampusHuntCheckpoint.find({ _id: { $in: [...checkpointIds] } }).select('+qrSecret +pasteCode').lean()
      : [],
    startIds.size
      ? CampusHuntStartingPoint.find({ _id: { $in: [...startIds] } }).lean()
      : [],
  ]);

  const challengeById = new Map(challenges.map((c) => [String(c._id), c]));
  const checkpointById = new Map(checkpoints.map((c) => [String(c._id), c]));
  const startById = new Map(starts.map((s) => [String(s._id), s]));

  const warnings = [];
  const incompleteTeams = [];
  const bundles = [];

  for (const team of teams) {
    const missing = [];
    if (!team.clue1ChallengeId) missing.push('clue1');
    if (!team.clue2ChallengeId) missing.push('clue2');
    if (!team.clue3ChallengeId) missing.push('clue3');
    if (!team.clue4ChallengeId) missing.push('clue4');
    if (!team.firstCheckpointId) missing.push('checkpoint1');
    if (!team.secondCheckpointId) missing.push('checkpoint2');
    if (!team.thirdCheckpointId) missing.push('checkpoint3');
    if (!team.fourthCheckpointId) missing.push('checkpoint4');
    if (missing.length) {
      incompleteTeams.push({ teamCode: team.teamCode, missing });
      continue;
    }

    const password = teamPasswordFromAccessPack(team);
    if (!password) {
      warnings.push(`${team.teamCode}: no team password — set passwords before export`);
    }

    const clue1 = challengeById.get(String(team.clue1ChallengeId));
    const clue2 = challengeById.get(String(team.clue2ChallengeId));
    const clue3 = challengeById.get(String(team.clue3ChallengeId));
    const clue4 = challengeById.get(String(team.clue4ChallengeId));
    const clue5Id = team.clue5ChallengeId || null;
    const clue5 = clue5Id ? challengeById.get(String(clue5Id)) : null;

    const cp1 = checkpointById.get(String(team.firstCheckpointId));
    const cp2 = checkpointById.get(String(team.secondCheckpointId));
    const cp3 = checkpointById.get(String(team.thirdCheckpointId));
    const cp4 = checkpointById.get(String(team.fourthCheckpointId));
    const start = startById.get(String(team.startingPointId || ''));

    const bundle = {
      bundleVersion: OFFLINE_BUNDLE_VERSION,
      bundleType: OFFLINE_BUNDLE_TYPE,
      exportedAt: new Date().toISOString(),
      signingKey: bundleSigningKey(String(event._id), team.teamCode),
      event: {
        id: String(event._id),
        slug: event.slug,
        name: event.name,
        college: event.college || '',
        teamSize: Math.max(2, Math.min(8, Number(event.teamSize) || 4)),
        startingScore: Number(event.startingScore) > 0 ? event.startingScore : 100,
        scoringConfig: event.scoringConfig || DEFAULT_SCORING_CONFIG,
      },
      team: {
        id: String(team._id),
        teamCode: team.teamCode,
        teamName: team.teamName,
        password,
        roster: buildRoster(team),
        scheduledStartAt: team.scheduledStartAt || null,
        startingPoint: start
          ? { code: start.code, name: start.name, description: start.description || '' }
          : null,
      },
      route: {
        orange: routeStop(cp1, 'first'),
        green: routeStop(cp2, 'second'),
        blue: routeStop(cp3, 'third'),
        purple: routeStop(cp4, 'fourth'),
      },
      clues: {
        clue1: serializeChallenge(clue1),
        clue2: serializeChallenge(clue2),
        clue3: serializeChallenge(clue3),
        clue4: serializeChallenge(clue4),
        clue5: clue5 ? serializeChallenge(clue5) : null,
      },
      checkpoints: [cp1, cp2, cp3, cp4]
        .filter(Boolean)
        .map((cp) => serializeCheckpoint(cp)),
      opsNotes: {
        install: 'Load this file on every phone for this team before fest. Airplane mode OK.',
        checkpointFlow: 'Each member scans poster → shows proof QR → leader collects → team sync QR.',
        posters: 'Use existing campus poster QRs — same JSON payload as online.',
      },
    };

    bundles.push({
      teamCode: team.teamCode,
      teamName: team.teamName,
      filename: `${team.teamCode}.offline.bundle.json`,
      bundle,
    });
  }

  if (!bundles.length) {
    warnings.push('No complete team bundles — finish Clue 1–4 bindings and team passwords first.');
  }

  return {
    event: {
      id: String(event._id),
      slug: event.slug,
      name: event.name,
    },
    exportedAt: new Date().toISOString(),
    bundleVersion: OFFLINE_BUNDLE_VERSION,
    teamCount: bundles.length,
    bundles,
    warnings,
    incompleteTeams,
  };
}

function canonicalPayload(payload) {
  const { sig: _sig, ...rest } = payload || {};
  return JSON.stringify(rest);
}

function verifyResultsSignature(eventId, payload) {
  const teamCode = String(payload?.team || '').trim().toUpperCase();
  if (!teamCode) return false;
  const key = bundleSigningKey(String(eventId), teamCode);
  const expected = crypto
    .createHmac('sha256', key)
    .update(canonicalPayload(payload))
    .digest('hex')
    .slice(0, 20);
  return Boolean(payload?.sig) && payload.sig === expected;
}

/**
 * Import a leader results JSON after an offline fest.
 */
async function importOfflineResults(eventId, payload) {
  const body = payload?.t ? payload : (payload?.data || payload);
  if (body?.t !== OFFLINE_QR_TYPES.RESULTS_EXPORT) {
    const err = new Error('Not an offline results file');
    err.status = 400;
    throw err;
  }
  if (String(body.event) !== String(eventId)) {
    const err = new Error('Results are for a different event');
    err.status = 403;
    throw err;
  }
  if (!verifyResultsSignature(eventId, body)) {
    const err = new Error('Results signature is invalid');
    err.status = 403;
    throw err;
  }

  const team = await CampusHuntTeam.findOne({
    eventId,
    teamCode: String(body.team || '').toUpperCase(),
  });
  if (!team) {
    const err = new Error(`Team ${body.team} not found`);
    err.status = 404;
    throw err;
  }

  const score = Math.max(0, Number(body.score) || 0);
  const now = new Date();
  team.currentScore = score;
  team.finalScore = score;
  team.currentStage = 'SCORE_LOCKED';
  team.status = 'finished';
  team.scoreLockedAt = now;
  team.finishedAt = body.finishedAt ? new Date(body.finishedAt) : now;
  await team.save();

  return {
    teamCode: team.teamCode,
    teamName: team.teamName,
    score,
    stage: team.currentStage,
  };
}

module.exports = {
  exportOfflinePacks,
  importOfflineResults,
  bundleSigningKey,
};
