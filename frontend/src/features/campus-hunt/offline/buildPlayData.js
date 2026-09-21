import {
  checkpointForKey,
  getClue,
  pendingCheckpointKey,
  teamSize,
} from './offlineEngine';
import { scoringForChallenge } from './scoring';
import { sanitizePlayerCopy } from '../player/sanitizePlayerCopy';
import { OFFLINE_CLUE_HOW_TO, OFFLINE_CLUE_PROMPTS } from './offlineHowTo';

function isExpired(expiresAt, now) {
  if (!expiresAt) return false;
  return now.getTime() >= new Date(expiresAt).getTime();
}

function challengeView(bundle, state, session, n, now) {
  const clue = getClue(bundle, n);
  const row = state.clueProgress?.[n] || { state: 'LOCKED', attempts: 0 };
  const stage = state.currentStage;
  const expose = ['COMPLETED', 'FAILED', 'TIMED_OUT'].includes(row.state)
    || stage === `CLUE_${n}_ACTIVE`;
  const cfg = scoringForChallenge(bundle.event, n);
  const isLeader = session.role === 'leader';

  if (!expose || !clue) {
    return {
      challengeNumber: n,
      type: clue?.type,
      prompt: null,
      howTo: null,
      state: row.state || 'LOCKED',
      attempts: row.attempts || 0,
      maxAttempts: clue?.maxAttempts || cfg.maxAttempts || 3,
      attemptsLeft: null,
      awardedPoints: null,
      locked: true,
    };
  }

  let prompt = clue.prompt || '';
  if (n === 1 && !isLeader) prompt = null;

  const memberIndex = Number(session.slot) || 0;
  // Clue 2 / 3 / 5: short prompt only — no phone “piece / digital lockbox” lists.
  if (n === 3) {
    prompt = OFFLINE_CLUE_PROMPTS[3] || prompt;
  }
  if (n === 2) {
    prompt = OFFLINE_CLUE_PROMPTS[2] || prompt;
  }
  if (n === 5) {
    prompt = OFFLINE_CLUE_PROMPTS[5];
  }
  void memberIndex;

  const startedAt = row.startedAt || null;
  const expiresAt = row.expiresAt || null;
  const timerArmed = !startedAt || now.getTime() >= new Date(startedAt).getTime();
  const instructionPhase = false;
  const revealed = row.failureReason === 'REVEALED_ZERO_POINTS'
    || row.failureReason === 'TIMEOUT';
  const showDestination = row.state === 'COMPLETED'
    || (n === 1 && revealed);

  // Prefer pack-patched answers (applyOfflinePlayerCopy), keep letters-only for Clue 5.
  let revealedAnswer = revealed ? (clue.answer || null) : undefined;
  if (n === 5 && revealedAnswer) {
    revealedAnswer = String(revealedAnswer).replace(/[^A-Za-z]/g, '').toUpperCase() || revealedAnswer;
  }

  const view = {
    challengeNumber: n,
    type: clue.type,
    prompt,
    memberCode: undefined,
    memberFragments: undefined,
    collaborative: false,
    // App HOW_TO wins over pack-frozen text (updates without re-export).
    howTo: OFFLINE_CLUE_HOW_TO[n] || clue.howTo || null,
    destinationInstruction: showDestination
      ? sanitizePlayerCopy(clue.destinationInstruction || '')
      : undefined,
    revealedLocation: revealed && n === 1 ? (clue.answer || null) : undefined,
    revealedAnswer: n === 5 ? revealedAnswer : (revealed ? (clue.answer || null) : undefined),
    state: row.state,
    attempts: row.attempts || 0,
    maxAttempts: clue.maxAttempts || cfg.maxAttempts || 3,
    attemptsLeft: Math.max(0, (clue.maxAttempts || cfg.maxAttempts || 3) - (row.attempts || 0)),
    hintUsed: Boolean(row.hintUsed),
    hintText: isLeader && row.hintUsed ? (clue.hintText || '') : undefined,
    hintCost: Number(clue.hintCost ?? cfg.hintCost) || 20,
    startedAt,
    expiresAt: [2, 3, 4, 5].includes(n) ? null : expiresAt,
    timerStartsAt: n === 2 ? startedAt : null,
    instructionPhase,
    timerArmed: n === 4 ? true : timerArmed,
    timerSeconds: undefined,
    instructionDelaySeconds: undefined,
    awardedPoints: row.awardedPoints ?? null,
    failureReason: row.failureReason || null,
    timeExpired: Boolean(
      n !== 4
      && expiresAt
      && timerArmed
      && isExpired(expiresAt, now)
      && row.state === 'ACTIVE',
    ),
    allowLateSubmit: Boolean(cfg.allowLateSubmit || n === 4 || n === 5),
    scoringBands: undefined,
    locked: false,
  };

  // Field Terminal — device key to play Zip Grid on a laptop.
  if (n === 4 && row.state === 'ACTIVE' && stage === 'CLUE_4_ACTIVE') {
    view.gridAccessCode = String(
      clue.gridAccessCode || bundle?.team?.gridAccessCode || '',
    ).toUpperCase() || null;
    view.gridGameUrl = clue.gridGameUrl || '/campus-hunt/grid';
    view.gridCompleted = false;
  }

  return view;
}

function checkpointStatus(bundle, state, session, _now) {
  const key = pendingCheckpointKey(state.currentStage);
  if (!key) return null;
  const expected = checkpointForKey(bundle, key);
  const required = 1;
  const cp = state.checkpoints?.[key] || { scans: {}, confirmed: false };
  const scans = cp.scans || {};
  const verifiedCount = Object.keys(scans).length;
  // One-phone: only real state scans count. localPosterScans sticks after Start over
  // and was hiding the Scan button / auto-camera after Clue 1.
  const youScanned = verifiedCount > 0 && Boolean(
    scans[session.memberKey]
    || scans.leader
    || (session.localPosterScans || {})[String(key)],
  );
  const scanKind = key === 5
    ? 'FIFTH SCAN'
    : key === 4
      ? 'FOURTH SCAN'
      : key === 3
        ? 'THIRD SCAN'
        : key === 2
          ? 'SECOND SCAN'
          : 'FIRST SCAN';
  const size = teamSize(bundle);
  const plantCount = Array.isArray(expected?.plantFragments) && expected.plantFragments.length
    ? expected.plantFragments.length
    : size;

  return {
    checkpointId: expected?.id || null,
    checkpointKey: String(key),
    code: expected?.code || expected?.checkpointKey,
    locationName: expected?.locationName,
    posterLabel: { scanKind, sharedStation: true },
    publicInstruction: sanitizePlayerCopy(
      expected?.publicInstruction
        || `At ${expected?.locationName || 'this stop'}, leader scans the ${scanKind} QR once.`,
    ),
    plantFragmentCount: plantCount,
    joinedWordHint: null,
    needJoinWord: false,
    joinWordOk: true,
    verifiedCount,
    requiredCount: required,
    youScanned,
    // One-phone: scan auto-confirms — never show team-code claim UI.
    status: cp.confirmed ? 'complete' : 'pending',
    awaitingTeamCodeConfirm: false,
    membersNeeded: 0,
    scanRoster: [],
    assignmentMissing: !expected,
    onePhoneMode: true,
  };
}

export function buildPlayData(bundle, session, state, now = new Date()) {
  const isLeader = session.role === 'leader';
  const size = teamSize(bundle);

  return {
    event: {
      id: bundle.event.id,
      teamCapacity: Number(bundle.event?.teamCapacity) || 20,
      finaleCapacity: 0,
      name: bundle.event.name,
    },
    team: {
      id: bundle.team.id,
      teamCode: bundle.team.teamCode,
      teamName: bundle.team.teamName,
      currentStage: state.currentStage,
      currentScore: state.score,
      finalScore: state.currentStage === 'SCORE_LOCKED' ? state.score : undefined,
      isLeader,
      myName: session.name,
      leaderName: (bundle.team.roster || []).find((m) => m.role === 'leader')?.name,
      teamSize: size,
      startStatus: state.currentStage === 'WAITING' ? 'WAITING' : 'ACTIVE',
      actualStartAt: state.currentStage === 'WAITING' ? null : (state.huntStartedAt || state.updatedAt),
      startingPoint: bundle.team.startingPoint || null,
    },
    challenges: [1, 2, 3, 4, 5, 6].map((n) => challengeView(bundle, state, session, n, now)),
    checkpointStatus: checkpointStatus(bundle, state, session, now),
    finishDestination: bundle.event?.destinationName || 'Mindspark Lobby',
    serverTime: now.toISOString(),
  };
}
