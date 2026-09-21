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

/** Offline — one phone; digit join-answer = Clue 2 only (not a scan gate). */
const OFFLINE_CLUE_HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'All teammates walk together. One phone (leader).',
      'Read the sentence and type the campus location.',
      'Go there. Leader scans the orange FIRST SCAN QR once → Clue 2.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'At green: find numbered digit slips (1, 2, 3…), join into one number, type it.',
      'Leader scans the green SECOND SCAN QR once → Clue 3.',
    ],
  },
  3: {
    title: 'How to play — Lockbox',
    steps: [
      'Find the physical lockbox nearby.',
      'Type the code written on it → scan blue THIRD SCAN once.',
    ],
  },
  4: {
    title: 'How to play — Field Terminal',
    steps: [
      'Borrow a laptop · Zip Grid · device key from this phone · 4 rounds.',
      'Type GRID-XXXX here → scan purple once.',
    ],
  },
  5: {
    title: 'How to play — Clue 5',
    steps: [
      'At red: find numbered letter slips (letters — not digits).',
      'Join in order into one word.',
      'Scan red FIFTH SCAN once → Clue 6 at Mindspark Lobby.',
    ],
  },
  6: {
    title: 'How to play — Mindspark Lobby',
    steps: [
      'Go to Mindspark Lobby as a full team.',
      'Ask the organizer for the finish code.',
      'Leader types it to lock your score, then export results for the desk.',
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
  const walkerCount = Math.max(memberNames.length, scanners.length);
  for (let i = 0; i < walkerCount; i += 1) {
    const name = scanners[i]?.name || memberNames[i];
    if (!name) continue;
    roster.push({
      slot: i + 1,
      role: 'walker',
      name,
      memberKey: `member${i + 1}`,
    });
  }
  return roster;
}

function serializeChallenge(ch, extra = {}) {
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
    ...(extra.gridAccessCode ? { gridAccessCode: extra.gridAccessCode } : {}),
    ...(extra.gridGameUrl ? { gridGameUrl: extra.gridGameUrl } : {}),
  };
}

const {
  resolveCampusStationsCatalog,
  DEFAULT_STATION_JOINED_WORDS,
  splitPlantFragments,
} = require('./stationCatalogService');

function stationPlantMap(event) {
  const map = new Map();
  const teamSize = Math.max(2, Math.min(12, Number(event?.teamSize) || 4));
  for (const row of resolveCampusStationsCatalog(event) || []) {
    const code = String(row.code || '').toUpperCase();
    if (!code) continue;
    let plantFragments = Array.isArray(row.plantFragments) ? row.plantFragments : [];
    let joinedWord = String(row.joinedWord || DEFAULT_STATION_JOINED_WORDS[code] || '').trim();
    if (joinedWord && plantFragments.length < teamSize) {
      plantFragments = splitPlantFragments(joinedWord, teamSize);
    }
    map.set(code, {
      plantFragments,
      joinedWord,
    });
  }
  return map;
}

function serializeCheckpoint(cp, plantByStation = null) {
  if (!cp) return null;
  const payload = buildStationQrPayload(cp);
  const stationCode = String(cp.stationCode || '').toUpperCase();
  const progressionKey = String(cp.progressionKey || cp.checkpointKey || '1');
  // Plant join-word only for second stop (Clue 2 / green). Other scans are QR-only.
  const isJoinStop = progressionKey === '2';
  const fromCatalog = isJoinStop ? (plantByStation?.get(stationCode) || {}) : {};
  const plantFragments = isJoinStop
    ? ((Array.isArray(cp.plantFragments) && cp.plantFragments.length
      ? cp.plantFragments
      : fromCatalog.plantFragments) || [])
    : [];
  const joinedWord = isJoinStop
    ? String(cp.joinedWord || fromCatalog.joinedWord || '').trim()
    : '';
  return {
    id: String(cp._id),
    progressionKey,
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
 * One place-poster entry per campus stop for offline packs (prefers stage-1 QR payload;
 * engine still routes by orange/green/blue/purple/red stops from the team bundle).
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
    progressionKey: { $in: ['1', 1, '2', 2, '3', 3, '4', 4, '5', 5] },
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
      'clue4ChallengeId', 'clue5ChallengeId', 'clue6ChallengeId',
      'firstCheckpointId', 'secondCheckpointId', 'thirdCheckpointId', 'fourthCheckpointId', 'fifthCheckpointId',
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
    if (!team.clue6ChallengeId) missing.push('clue6');
    if (!team.firstCheckpointId) missing.push('checkpoint1');
    if (!team.secondCheckpointId) missing.push('checkpoint2');
    if (!team.thirdCheckpointId) missing.push('checkpoint3');
    if (!team.fourthCheckpointId) missing.push('checkpoint4');
    if (!team.fifthCheckpointId) missing.push('checkpoint5');
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
    const clue6 = challengeById.get(String(team.clue6ChallengeId));

    let gridAccessCode = '';
    try {
      const { ensureRound1FieldTerminalGrid } = require('./grid/gridSessionService');
      // eslint-disable-next-line no-await-in-loop
      const gridSession = await ensureRound1FieldTerminalGrid(team, {
        preferredCompletionCode: String(clue4?.answer || '').trim().toUpperCase(),
      });
      gridAccessCode = String(gridSession?.accessCode || '').toUpperCase();
    } catch (err) {
      warnings.push(
        `${team.teamCode}: Field Terminal device key not created (${err.message || 'error'})`,
      );
    }

    const cp1 = checkpointById.get(String(team.firstCheckpointId));
    const cp2 = checkpointById.get(String(team.secondCheckpointId));
    const cp3 = checkpointById.get(String(team.thirdCheckpointId));
    const cp4 = checkpointById.get(String(team.fourthCheckpointId));
    const cp5 = checkpointById.get(String(team.fifthCheckpointId));
    const start = startById.get(String(team.startingPointId || ''));

    const stops = [cp1, cp2, cp3, cp4, cp5].map((cp) => serializeCheckpoint(cp, plantByStation));
    const secondStop = stops[1];
    if (secondStop && !secondStop.joinedWord) {
      warnings.push(
        `${team.teamCode}: second stop ${secondStop.stationCode || secondStop.locationName} missing joinedWord — set plant fragments in Places`,
      );
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
        teamSize: Math.max(2, Math.min(12, Number(event.teamSize) || 10)),
        startingScore: Number(event.startingScore) > 0 ? event.startingScore : 100,
        scoringConfig: event.scoringConfig || DEFAULT_SCORING_CONFIG,
        destinationName: event.destinationName || 'Mindspark Lobby',
        organizerFinishCode: String(event.organizerFinishCode || 'MSFINISH').toUpperCase(),
        organizerStartCode: String(event.organizerStartCode || 'GO').toUpperCase(),
        apiBase: process.env.PUBLIC_API_BASE
          || process.env.API_PUBLIC_URL
          || 'https://crwdctrl-production-9c58.up.railway.app/api',
      },
      team: {
        id: String(team._id),
        teamCode: team.teamCode,
        teamName: team.teamName,
        password,
        roster: buildRoster(team),
        startingPoint: start
          ? { code: start.code, name: start.name, description: start.description || '' }
          : null,
      },
      route: {
        orange: routeStop(cp1, 'first', plantByStation),
        green: routeStop(cp2, 'second', plantByStation),
        blue: routeStop(cp3, 'third', plantByStation),
        purple: routeStop(cp4, 'fourth', plantByStation),
        red: routeStop(cp5, 'fifth', plantByStation),
      },
      clues: {
        clue1: serializeChallenge(clue1),
        clue2: serializeChallenge(clue2),
        clue3: serializeChallenge(clue3),
        clue4: serializeChallenge(clue4, {
          gridAccessCode,
          gridGameUrl: '/campus-hunt/grid',
        }),
        clue5: serializeChallenge(clue5),
        clue6: serializeChallenge(clue6),
      },
      checkpoints: stops.filter(Boolean),
      placePosters,
        opsNotes: {
        install: 'Share install links ~1 day before. Leaders download Hunt + pack on Wi‑Fi at home, then arrive ready. Whole team walks with that one phone — play works with no campus network.',
        startGate: 'One start code for everyone. Organizer says it at the gather point; leaders type it; hunt starts. No release desk needed on phones.',
        checkpointFlow: 'At each of 5 stops: solve the clue on the leader phone → scan the shared place poster once (auto-unlocks next clue — no team-code step, no multi-member scan). Digit join-answer is Clue 2 only. Clue 6 → Mindspark Lobby finish code.',
        posters: 'ONE shared QR per campus place × scan stage 1–5. Phone already knows the stage. Leader scans once.',
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
    warnings.push('No complete team bundles — finish Clue 1–6 bindings (5 path stops + destination) and team passwords first.');
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
 * Full Start over for one team — live board + progress wipe + Zip Grid.
 * Used by admin Playtest desk and offline phone startOver sync.
 */
async function resetTeamHuntProgress(team, {
  score = null,
  stage = 'WAITING',
  bumpSeq = true,
  forceGridReset = true,
  deviceId = '',
} = {}) {
  const CampusHuntTeamProgress = require('../models/CampusHuntTeamProgress');
  const CampusHuntCheckpointVerification = require('../models/CampusHuntCheckpointVerification');
  const startScore = Number(team.startingScore) > 0
    ? Number(team.startingScore)
    : (Number(score) > 0 ? Number(score) : 100);
  const nextScore = score != null ? Number(score) : startScore;
  const storedSeq = Number(team.offlineProgressSeq) || 0;
  const nextSeq = bumpSeq ? Math.max(storedSeq + 1, 1) : storedSeq;
  const resetAt = new Date();

  await Promise.all([
    CampusHuntTeamProgress.deleteMany({ teamId: team._id }),
    CampusHuntCheckpointVerification.deleteMany({ teamId: team._id }),
  ]);

  const $set = {
    currentScore: nextScore,
    startingScore: startScore,
    currentStage: String(stage || 'WAITING'),
    status: 'registered',
    startStatus: 'WAITING',
    offlineProgressSeq: nextSeq,
    offlineResetAt: resetAt,
    stats: {
      hintsUsed: 0,
      failedAttempts: 0,
      manualPenalty: 0,
    },
  };
  if (deviceId) $set.offlineDeviceId = String(deviceId).slice(0, 64);

  await CampusHuntTeam.updateOne(
    { _id: team._id },
    {
      $set,
      $unset: {
        finalScore: 1,
        scoreLockedAt: 1,
        finishedAt: 1,
        suddenDeathRank: 1,
        lastCheckpointNumber: 1,
        actualStartAt: 1,
        'stats.totalCompletionMs': 1,
      },
    },
  );

  const freshTeam = await CampusHuntTeam.findById(team._id);
  if (!freshTeam) {
    const err = new Error('Team not found after reset');
    err.status = 404;
    throw err;
  }

  if (forceGridReset) {
    try {
      const { ensureRound1FieldTerminalGrid } = require('./grid/gridSessionService');
      const clue4 = freshTeam.clue4ChallengeId
        ? await CampusHuntChallenge.findById(freshTeam.clue4ChallengeId).select('answer').lean()
        : null;
      await ensureRound1FieldTerminalGrid(freshTeam, {
        preferredCompletionCode: clue4?.answer || '',
        forceReset: true,
      });
    } catch (_) { /* grid reset best-effort */ }
  }

  try {
    const { publishTeamProgress } = require('./teamProgressBus');
    publishTeamProgress(freshTeam._id);
  } catch (_) { /* live bus best-effort */ }

  return {
    team: freshTeam,
    score: freshTeam.currentScore,
    stage: freshTeam.currentStage,
    seq: freshTeam.offlineProgressSeq,
    offlineResetAt: freshTeam.offlineResetAt,
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

  const startOver = Boolean(body.startOver || body.reset);
  const incomingSeq = Number(body.seq) || 0;
  const storedSeq = Number(team.offlineProgressSeq) || 0;
  const incomingDevice = String(body.deviceId || '').slice(0, 64);
  const startScore = Number(team.startingScore) > 0 ? Number(team.startingScore) : 100;
  const maxPlausible = startScore + (6 * 120);

  // Start over from leader phone — reset live board + unlock score lock for retest.
  if (startOver) {
    const score = Math.min(Math.max(0, Number(body.score) || startScore), maxPlausible);
    const result = await resetTeamHuntProgress(team, {
      score,
      stage: String(body.stage || 'WAITING'),
      bumpSeq: true,
      forceGridReset: true,
      deviceId: incomingDevice,
    });
    // Prefer phone seq if higher than auto-bump (anti race with old pushes).
    if (incomingSeq > Number(result.seq || 0)) {
      await CampusHuntTeam.updateOne(
        { _id: team._id },
        { $set: { offlineProgressSeq: incomingSeq } },
      );
      result.seq = incomingSeq;
    }
    return {
      teamCode: result.team.teamCode,
      score: result.score,
      stage: result.stage,
      seq: result.seq,
      deviceId: result.team.offlineDeviceId,
      offlineResetAt: result.offlineResetAt,
      startOver: true,
      accepted: true,
    };
  }

  const incomingStage = String(body.stage || '');
  const playingAgain = Boolean(
    incomingStage
    && incomingStage !== 'SCORE_LOCKED'
    && incomingStage !== 'FINISH_COMPLETED',
  );

  // Phone re-started after a locked finish — unlock live board and accept score.
  if (team.currentStage === 'SCORE_LOCKED' && playingAgain) {
    const unlockScore = Math.min(Math.max(0, Number(body.score) || startScore), maxPlausible);
    await CampusHuntTeam.updateOne(
      { _id: team._id },
      {
        $set: {
          status: 'active',
          currentStage: incomingStage || 'WAITING',
          currentScore: unlockScore,
          offlineProgressSeq: Math.max(storedSeq, incomingSeq),
          ...(incomingDevice ? { offlineDeviceId: incomingDevice } : {}),
        },
        $unset: {
          finalScore: 1,
          scoreLockedAt: 1,
          finishedAt: 1,
        },
      },
    );
    const unlocked = await CampusHuntTeam.findById(team._id);
    try {
      const { publishTeamProgress } = require('./teamProgressBus');
      publishTeamProgress(unlocked._id);
    } catch (_) { /* best-effort */ }
    return {
      teamCode: unlocked.teamCode,
      score: unlocked.currentScore,
      stage: unlocked.currentStage,
      seq: unlocked.offlineProgressSeq,
      deviceId: unlocked.offlineDeviceId,
      offlineResetAt: unlocked.offlineResetAt || null,
      unlocked: true,
      accepted: true,
    };
  }

  if (team.currentStage === 'SCORE_LOCKED') {
    return {
      teamCode: team.teamCode,
      ignored: true,
      reason: 'SCORE_LOCKED',
      accepted: false,
      seq: storedSeq,
    };
  }

  if (incomingSeq < storedSeq) {
    return {
      teamCode: team.teamCode,
      ignored: true,
      reason: 'STALE_SEQ',
      accepted: false,
      seq: storedSeq,
    };
  }

  const bound = String(team.offlineDeviceId || '').slice(0, 64);
  // Soft bind: allow takeover when score/stage advanced, or explicit takeover flag.
  const advancing = incomingSeq > storedSeq
    || Number(body.score) > Number(team.currentScore || 0);
  if (bound && incomingDevice && bound !== incomingDevice && !body.takeover && !advancing) {
    const err = new Error(
      'Another phone is bound to this team. Restore a backup on this phone, then tap Take over.',
    );
    err.status = 409;
    err.code = 'DEVICE_BOUND';
    err.preview = { boundDeviceHint: `${bound.slice(0, 8)}…` };
    throw err;
  }

  const score = Math.max(0, Number(body.score) || 0);
  const nextScore = Math.min(score, maxPlausible);
  const nextStage = body.stage ? String(body.stage) : team.currentStage;
  const nextSeq = Math.max(storedSeq, incomingSeq);
  const $set = {
    currentScore: nextScore,
    currentStage: nextStage,
    offlineProgressSeq: nextSeq,
    status: 'active',
  };
  if (incomingDevice) $set.offlineDeviceId = incomingDevice;

  await CampusHuntTeam.updateOne(
    { _id: team._id },
    {
      $set,
      ...(playingAgain
        ? { $unset: { finalScore: 1, scoreLockedAt: 1 } }
        : {}),
    },
  );

  const fresh = await CampusHuntTeam.findById(team._id);
  try {
    const { publishTeamProgress } = require('./teamProgressBus');
    publishTeamProgress(fresh._id);
  } catch (_) { /* best-effort */ }

  let standing = null;
  try {
    const { standingForTeam } = require('./leaderboardService');
    standing = await standingForTeam(eventId, fresh._id);
  } catch (_) { /* best-effort */ }

  return {
    teamCode: fresh.teamCode,
    score: fresh.currentScore,
    stage: fresh.currentStage,
    seq: fresh.offlineProgressSeq,
    deviceId: fresh.offlineDeviceId,
    offlineResetAt: fresh.offlineResetAt || null,
    accepted: true,
    rank: standing?.rank || null,
    fieldSize: standing?.size || null,
  };
}

/**
 * Phone pulls live board + admin Start over signal (signed).
 */
async function pullOfflineBoardState(eventId, payload) {
  const body = payload?.t ? payload : (payload?.data || payload);
  if (body?.t !== 'campus_hunt_offline_pull') {
    const err = new Error('Not an offline pull payload');
    err.status = 400;
    throw err;
  }
  if (String(body.event) !== String(eventId)) {
    const err = new Error('Pull is for a different event');
    err.status = 403;
    throw err;
  }
  if (!verifyResultsSignature(eventId, body)) {
    const err = new Error('Pull signature is invalid');
    err.status = 403;
    throw err;
  }

  const team = await CampusHuntTeam.findOne({
    eventId,
    teamCode: String(body.team || '').toUpperCase(),
  }).select(
    'teamCode currentStage currentScore startingScore finalScore offlineProgressSeq offlineResetAt scoreLockedAt',
  );
  if (!team) {
    const err = new Error(`Team ${body.team} not found`);
    err.status = 404;
    throw err;
  }

  let rank = null;
  let fieldSize = null;
  let top10 = [];
  try {
    const { buildLeaderboard, standingForTeam } = require('./leaderboardService');
    const standing = await standingForTeam(eventId, team._id);
    rank = standing?.rank || null;
    fieldSize = standing?.size || null;
    const rows = await buildLeaderboard(eventId, { includeUnfinished: true });
    top10 = (rows || []).slice(0, 10).map((row) => ({
      rank: row.rank,
      teamCode: row.teamCode,
      teamId: row.teamId,
    }));
  } catch (_) { /* best-effort */ }

  return {
    teamCode: team.teamCode,
    stage: team.currentStage,
    score: team.currentScore,
    startingScore: team.startingScore,
    finalScore: team.finalScore ?? null,
    seq: Number(team.offlineProgressSeq) || 0,
    offlineResetAt: team.offlineResetAt || null,
    scoreLocked: team.currentStage === 'SCORE_LOCKED' || Boolean(team.scoreLockedAt),
    rank,
    fieldSize,
    top10,
  };
}

/**
 * Best-effort: mint / return Field Terminal device key for an offline pack.
 */
async function ensureOfflineGridAccess(eventId, payload) {
  const body = payload?.t ? payload : (payload?.data || payload);
  if (body?.t !== 'campus_hunt_offline_grid') {
    const err = new Error('Not an offline grid request');
    err.status = 400;
    throw err;
  }
  if (String(body.event) !== String(eventId)) {
    const err = new Error('Grid request is for a different event');
    err.status = 403;
    throw err;
  }
  if (!verifyResultsSignature(eventId, body)) {
    const err = new Error('Grid request signature is invalid');
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

  const clue4 = team.clue4ChallengeId
    ? await CampusHuntChallenge.findById(team.clue4ChallengeId).select('answer').lean()
    : null;
  const { ensureRound1FieldTerminalGrid } = require('./grid/gridSessionService');
  const gridSession = await ensureRound1FieldTerminalGrid(team, {
    preferredCompletionCode: clue4?.answer || body.preferredCompletionCode || '',
    forceReset: Boolean(body.reset || body.startOver || body.forceReset),
  });

  return {
    teamCode: team.teamCode,
    gridAccessCode: gridSession.accessCode,
    gridGameUrl: '/campus-hunt/grid',
    gridStatus: gridSession.status,
    gridCompleted: gridSession.status === 'completed',
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
  pullOfflineBoardState,
  resetTeamHuntProgress,
  ensureOfflineGridAccess,
  bundleSigningKey,
};
