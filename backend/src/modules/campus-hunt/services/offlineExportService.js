/**
 * Export Offline Hunt Packs — one JSON bundle per team for airplane-mode play.
 */

const crypto = require('crypto');
const CampusHuntEvent = require('../models/CampusHuntEvent');
const CampusHuntTeam = require('../models/CampusHuntTeam');
const CampusHuntChallenge = require('../models/CampusHuntChallenge');
const CampusHuntCheckpoint = require('../models/CampusHuntCheckpoint');
const CampusHuntStartingPoint = require('../models/CampusHuntStartingPoint');
const CampusHuntOfflineInstall = require('../models/CampusHuntOfflineInstall');
const { decryptCredential } = require('../utils/credentialCipher');
const { selectCompetitionTeams } = require('./startScheduleService');
const { buildStationQrPayload } = require('./checkpointService');
const { CLUE_HOW_TO, DEFAULT_SCORING_CONFIG } = require('../constants');

/** Offline Round 1 — one phone, join-word at stops, then one scan. */
const OFFLINE_CLUE_HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'All teammates walk together. One phone (leader).',
      'Read the sentence and type the campus location.',
      'Go there. Find the written clues nearby, join them into one word, type it.',
      'Scan the place QR once → team code → Clue 2.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'Find the written clues at the stop, join the word, type it.',
      'Leader scans the place QR once → team code → Clue 3.',
    ],
  },
  3: {
    title: 'How to play — Clue 3',
    steps: [
      'Decode the Caesar riddle (leader submits).',
      'At that place: find written clues, join the word, type it.',
      'Scan the place QR once → team code.',
    ],
  },
  4: {
    title: 'How to play — Clue 4',
    steps: [
      'At the stop: find written clues / prop tags, join the word, type it.',
      'Scan the place QR once → team code → Final.',
    ],
  },
  5: {
    title: 'How to play — Final clue',
    steps: [
      'Fragments are on this phone — read aloud in order and rebuild the word.',
      'Leader types it. Report to your start desk.',
    ],
  },
};
const {
  OFFLINE_BUNDLE_VERSION,
  OFFLINE_BUNDLE_TYPE,
  OFFLINE_QR_TYPES,
} = require('../constants/offlineBundle');

function bundleSigningKey(eventId, teamCode) {
  const configured = process.env.OFFLINE_BUNDLE_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'OFFLINE_BUNDLE_KEY is required in production when Campus Hunt is enabled.',
      );
    }
    // Dev/staging: allow a distinct-from-JWT_SECRET local key so we never accidentally
    // sign offline bundles with the same secret that protects login tokens.
    const localFallback = process.env.OFFLINE_BUNDLE_KEY_DEV || 'campus-hunt-offline-dev-key';
    return crypto
      .createHmac('sha256', localFallback)
      .update(`${eventId}:${teamCode}`)
      .digest('hex');
  }
  return crypto
    .createHmac('sha256', configured)
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
    howTo: OFFLINE_CLUE_HOW_TO[ch.challengeNumber] || CLUE_HOW_TO[ch.challengeNumber] || null,
  };
}

const {
  resolveCampusStationsCatalog,
} = require('./stationCatalogService');

function stationPlantMap(event) {
  const map = new Map();
  for (const row of resolveCampusStationsCatalog(event) || []) {
    const code = String(row.code || '').toUpperCase();
    if (!code) continue;
    map.set(code, {
      plantFragments: Array.isArray(row.plantFragments) ? row.plantFragments : [],
      joinedWord: String(row.joinedWord || '').trim(),
    });
  }
  return map;
}

function serializeCheckpoint(cp, plantByStation = null) {
  if (!cp) return null;
  const payload = buildStationQrPayload(cp);
  const stationCode = String(cp.stationCode || '').toUpperCase();
  const fromCatalog = plantByStation?.get(stationCode) || {};
  const plantFragments = (Array.isArray(cp.plantFragments) && cp.plantFragments.length
    ? cp.plantFragments
    : fromCatalog.plantFragments) || [];
  const joinedWord = String(cp.joinedWord || fromCatalog.joinedWord || '').trim();
  return {
    id: String(cp._id),
    progressionKey: String(cp.progressionKey || cp.checkpointKey || '1'),
    checkpointKey: cp.checkpointKey,
    code: cp.code || cp.checkpointKey,
    stationCode: cp.stationCode || '',
    locationName: cp.locationName || '',
    publicInstruction: cp.publicInstruction || '',
    plantFragments: plantFragments.map((f) => String(f || '').trim()).filter(Boolean),
    joinedWord,
    qrSecret: cp.qrSecret,
    pasteCode: cp.pasteCode || '',
    qrPayload: payload,
    pasteHint: cp.pasteCode ? `CH-${cp.pasteCode}` : '',
  };
}

function routeStop(checkpointDoc, label, plantByStation) {
  if (!checkpointDoc) return null;
  const serialized = serializeCheckpoint(checkpointDoc, plantByStation);
  return serialized ? { label, ...serialized } : null;
}

/**
 * One physical poster per campus place (not per team, not per color).
 * Prefer progression-1 shared QR; phone already knows which stage the team is on.
 */
async function buildPlacePosters(eventId, event) {
  const {
    resolveCampusStationsCatalog,
    resolveStationCount,
  } = require('./stationCatalogService');
  const catalog = resolveCampusStationsCatalog(event) || [];
  const count = resolveStationCount(event);
  const codes = catalog.slice(0, count).map((r) => String(r.code || '').toUpperCase()).filter(Boolean);
  if (!codes.length) return [];

  const cps = await CampusHuntCheckpoint.find({
    eventId,
    stationCode: { $in: codes },
    progressionKey: { $in: ['1', 1, '2', 2, '3', 3, '4', 4] },
    active: { $ne: false },
  }).select('+qrSecret +pasteCode').lean();

  const byStation = new Map();
  for (const cp of cps) {
    const code = String(cp.stationCode || '').toUpperCase();
    if (!code) continue;
    const prog = String(cp.progressionKey || '9');
    const prev = byStation.get(code);
    if (!prev || prog === '1' || (prog < String(prev.progressionKey || '9'))) {
      byStation.set(code, cp);
    }
  }

  return codes.map((code) => {
    const cp = byStation.get(code);
    if (!cp) return null;
    const row = catalog.find((c) => String(c.code || '').toUpperCase() === code);
    return {
      ...serializeCheckpoint(cp),
      stationCode: code,
      locationName: row?.name || cp.locationName || code,
      placePoster: true,
    };
  }).filter(Boolean);
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
  const plantByStation = stationPlantMap(event);
  const placePosters = await buildPlacePosters(eventId, event);
  const exportBatchId = `exp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  await CampusHuntEvent.findByIdAndUpdate(eventId, { offlineExportBatchId: exportBatchId });

  const warnings = [];
  const incompleteTeams = [];
  const bundles = [];

  for (const team of teams) {
    const missing = [];
    if (!team.clue1ChallengeId) missing.push('clue1');
    if (!team.clue2ChallengeId) missing.push('clue2');
    if (!team.clue3ChallengeId) missing.push('clue3');
    if (!team.clue4ChallengeId) missing.push('clue4');
    if (!team.clue5ChallengeId) missing.push('clue5');
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
    const clue5 = challengeById.get(String(team.clue5ChallengeId));

    const cp1 = checkpointById.get(String(team.firstCheckpointId));
    const cp2 = checkpointById.get(String(team.secondCheckpointId));
    const cp3 = checkpointById.get(String(team.thirdCheckpointId));
    const cp4 = checkpointById.get(String(team.fourthCheckpointId));
    const start = startById.get(String(team.startingPointId || ''));

    const stops = [cp1, cp2, cp3, cp4].map((cp) => serializeCheckpoint(cp, plantByStation));
    for (const stop of stops) {
      if (stop && !stop.joinedWord) {
        warnings.push(
          `${team.teamCode}: stop ${stop.stationCode || stop.locationName} missing joinedWord — set plant fragments in Clues`,
        );
      }
    }

    const bundle = {
      bundleVersion: OFFLINE_BUNDLE_VERSION,
      bundleType: OFFLINE_BUNDLE_TYPE,
      exportBatchId,
      playMode: 'team_device',
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
        apiBase: process.env.PUBLIC_API_BASE
          || process.env.API_PUBLIC_URL
          || '',
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
        orange: routeStop(cp1, 'first', plantByStation),
        green: routeStop(cp2, 'second', plantByStation),
        blue: routeStop(cp3, 'third', plantByStation),
        purple: routeStop(cp4, 'fourth', plantByStation),
      },
      clues: {
        clue1: serializeChallenge(clue1),
        clue2: serializeChallenge(clue2),
        clue3: serializeChallenge(clue3),
        clue4: serializeChallenge(clue4),
        clue5: serializeChallenge(clue5),
      },
      checkpoints: stops.filter(Boolean),
      placePosters,
      opsNotes: {
        install: 'Leader opens one WhatsApp link on Wi‑Fi. Pack saves on this phone.',
        checkpointFlow: 'At each stop: find plant fragments → join word → type → scan place poster once → team code.',
        posters: 'ONE shared QR per campus place (not per team, not per color). Phone already knows the stage.',
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
    warnings.push('No complete team bundles — finish Clue 1–5 bindings and team passwords first.');
  }

  const installs = await publishInstallLinks(eventId, bundles, exportBatchId);

  return {
    event: {
      id: String(event._id),
      slug: event.slug,
      name: event.name,
    },
    exportedAt: new Date().toISOString(),
    exportBatchId,
    bundleVersion: OFFLINE_BUNDLE_VERSION,
    teamCount: bundles.length,
    bundles,
    installs,
    warnings,
    incompleteTeams,
  };
}

async function publishInstallLinks(eventId, bundles, exportBatchId = '') {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const installs = [];
  for (const entry of bundles) {
    await CampusHuntOfflineInstall.deleteMany({
      eventId,
      teamCode: entry.teamCode,
    });
    const token = crypto.randomBytes(18).toString('base64url');
    await CampusHuntOfflineInstall.create({
      token,
      eventId,
      teamCode: entry.teamCode,
      bundle: entry.bundle,
      expiresAt,
      exportBatchId: exportBatchId || entry.bundle?.exportBatchId || '',
      installedAt: null,
    });
    installs.push({
      teamCode: entry.teamCode,
      teamName: entry.teamName,
      token,
      password: entry.bundle?.team?.password || '',
      teamSize: Number(entry.bundle?.event?.teamSize) || 4,
      exportBatchId: exportBatchId || entry.bundle?.exportBatchId || '',
      installedAt: null,
      expiresAt: expiresAt.toISOString(),
    });
  }
  return installs;
}

async function getInstallBundle(token) {
  const row = await CampusHuntOfflineInstall.findOne({
    token: String(token || '').trim(),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!row) {
    const err = new Error('This install link is invalid or expired. Ask admin to export packs again.');
    err.status = 404;
    throw err;
  }
  return {
    teamCode: row.teamCode,
    expiresAt: row.expiresAt,
    exportBatchId: row.exportBatchId || row.bundle?.exportBatchId || '',
    installedAt: row.installedAt || null,
    bundle: row.bundle,
  };
}

async function ackOfflineInstall(token, deviceHint = '') {
  const row = await CampusHuntOfflineInstall.findOne({
    token: String(token || '').trim(),
    expiresAt: { $gt: new Date() },
  });
  if (!row) {
    const err = new Error('Install link invalid or expired');
    err.status = 404;
    throw err;
  }
  if (!row.installedAt) {
    row.installedAt = new Date();
    row.installDeviceHint = String(deviceHint || '').slice(0, 120);
    await row.save();
  }
  return {
    teamCode: row.teamCode,
    installedAt: row.installedAt,
    exportBatchId: row.exportBatchId || '',
  };
}

async function listOfflineInstallStatus(eventId) {
  const rows = await CampusHuntOfflineInstall.find({ eventId })
    .select('teamCode token installedAt installDeviceHint exportBatchId expiresAt createdAt')
    .lean();
  return rows.map((r) => ({
    teamCode: r.teamCode,
    token: r.token,
    installed: Boolean(r.installedAt),
    installedAt: r.installedAt || null,
    installDeviceHint: r.installDeviceHint || '',
    exportBatchId: r.exportBatchId || '',
    expiresAt: r.expiresAt,
  }));
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

function previewOfflineImport(eventId, payload) {
  const body = payload?.t ? payload : (payload?.data || payload);
  return {
    team: String(body?.team || '').toUpperCase(),
    event: String(body?.event || ''),
    score: Math.max(0, Number(body?.score) || 0),
    stage: body?.stage || 'SCORE_LOCKED',
    finishedAt: body?.finishedAt || null,
    seq: Number(body?.seq) || 0,
    validType: body?.t === OFFLINE_QR_TYPES.RESULTS_EXPORT,
    eventMatch: String(body?.event) === String(eventId),
    signatureOk: verifyResultsSignature(eventId, body),
  };
}

/**
 * Import a leader results JSON after an offline fest.
 * @param {{ force?: boolean }} opts — force overwrite when already SCORE_LOCKED
 */
async function importOfflineResults(eventId, payload, opts = {}) {
  const body = payload?.t ? payload : (payload?.data || payload);
  const preview = previewOfflineImport(eventId, body);
  if (!preview.validType) {
    const err = new Error('Not an offline results file');
    err.status = 400;
    throw err;
  }
  if (!preview.eventMatch) {
    const err = new Error('Results are for a different event');
    err.status = 403;
    throw err;
  }
  if (!preview.signatureOk) {
    const err = new Error('Results signature is invalid');
    err.status = 403;
    throw err;
  }

  const team = await CampusHuntTeam.findOne({
    eventId,
    teamCode: preview.team,
  });
  if (!team) {
    const err = new Error(`Team ${preview.team} not found`);
    err.status = 404;
    throw err;
  }

  const alreadyLocked = team.currentStage === 'SCORE_LOCKED' || Boolean(team.scoreLockedAt);
  if (alreadyLocked && !opts.force) {
    const err = new Error(
      `${team.teamCode} already has a locked score (${team.finalScore ?? team.currentScore}). `
      + 'Pass force=true to overwrite.',
    );
    err.status = 409;
    err.code = 'SCORE_LOCKED';
    err.preview = {
      ...preview,
      currentScore: team.currentScore,
      finalScore: team.finalScore,
      alreadyLocked: true,
    };
    throw err;
  }

  const score = preview.score;
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
    overwritten: alreadyLocked,
    preview,
  };
}

/**
 * Best-effort live board sync from leader phone (never required for play).
 */
async function ingestOfflineProgress(eventId, payload) {
  const body = payload?.t ? payload : (payload?.data || payload);
  if (body?.t !== 'campus_hunt_offline_progress') {
    const err = new Error('Not an offline progress payload');
    err.status = 400;
    throw err;
  }
  if (String(body.event) !== String(eventId)) {
    const err = new Error('Progress is for a different event');
    err.status = 403;
    throw err;
  }
  if (!verifyResultsSignature(eventId, body)) {
    const err = new Error('Progress signature is invalid');
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

  if (team.currentStage === 'SCORE_LOCKED') {
    return { teamCode: team.teamCode, ignored: true, reason: 'SCORE_LOCKED' };
  }

  const incomingDevice = String(body.deviceId || '').slice(0, 64);
  const bound = String(team.offlineDeviceId || '').slice(0, 64);
  if (bound && incomingDevice && bound !== incomingDevice && !body.takeover) {
    const err = new Error(
      'Another phone is bound to this team. Restore a backup on this phone, then tap Take over.',
    );
    err.status = 409;
    err.code = 'DEVICE_BOUND';
    err.preview = { boundDeviceHint: `${bound.slice(0, 8)}…` };
    throw err;
  }

  const incomingSeq = Number(body.seq) || 0;
  const storedSeq = Number(team.offlineProgressSeq) || 0;
  if (incomingSeq < storedSeq) {
    return { teamCode: team.teamCode, ignored: true, reason: 'STALE_SEQ' };
  }

  const score = Math.max(0, Number(body.score) || 0);
  const maxPlausible = 100 + (5 * 80);
  team.currentScore = Math.min(score, maxPlausible);
  if (body.stage) team.currentStage = String(body.stage);
  team.offlineProgressSeq = incomingSeq;
  if (incomingDevice) team.offlineDeviceId = incomingDevice;
  team.status = team.status === 'finished' ? team.status : 'active';
  await team.save();

  return {
    teamCode: team.teamCode,
    score: team.currentScore,
    stage: team.currentStage,
    seq: team.offlineProgressSeq,
    deviceId: team.offlineDeviceId,
  };
}

module.exports = {
  exportOfflinePacks,
  importOfflineResults,
  previewOfflineImport,
  getInstallBundle,
  ackOfflineInstall,
  listOfflineInstallStatus,
  ingestOfflineProgress,
  bundleSigningKey,
};
