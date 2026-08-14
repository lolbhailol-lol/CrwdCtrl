import {
  checkpointForKey,
  getClue,
  pendingCheckpointKey,
  teamSize,
} from './offlineEngine';
import { scoringForChallenge } from './scoring';

const HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'Read the sentence and type the campus location.',
      'Correct answer = 50 points. After 3 wrong tries the location is revealed (0 points).',
      'Go there — all members scan the shared orange QR.',
      'Show your proof QR to the leader, then scan the leader Team QR.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'Read the instructions (20 seconds), then a 3-minute timer starts.',
      'Find the 3-digit number on the back of the green QR poster.',
      'Leader types it. Then everyone scans the green poster.',
    ],
  },
  3: {
    title: 'How to play — Clue 3',
    steps: [
      'Decode the Caesar riddle (leader submits).',
      'Go to that place and scan the shared blue QR together.',
    ],
  },
  4: {
    title: 'How to play — Crazy prop hunt',
    steps: [
      'Find the planted prop next to the purple QR and type its sticker code.',
      'Then scan the purple poster — all members, proof QRs, team code.',
    ],
  },
  5: {
    title: 'How to play — Final clue',
    steps: [
      'Each teammate sees a fragment. Rebuild the word; leader submits.',
      'Report to your start desk. Leader exports results.',
    ],
  },
};

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
  let memberCode;
  let collaborative = false;
  if (n === 5 && Array.isArray(clue.memberPrompts) && clue.memberPrompts.length) {
    collaborative = true;
    memberCode = clue.memberPrompts[memberIndex] || '';
    prompt = clue.prompt || 'Combine all teammate codes in order into one word.';
  }

  const startedAt = row.startedAt || null;
  const expiresAt = row.expiresAt || null;
  const timerArmed = !startedAt || now.getTime() >= new Date(startedAt).getTime();
  const instructionPhase = (n === 2 || n === 4)
    && row.state === 'ACTIVE'
    && Boolean(startedAt)
    && !timerArmed;
  const revealed = row.failureReason === 'REVEALED_ZERO_POINTS';
  const showDestination = row.state === 'COMPLETED' || revealed;

  return {
    challengeNumber: n,
    type: clue.type,
    prompt,
    memberCode,
    collaborative,
    howTo: clue.howTo || HOW_TO[n] || null,
    destinationInstruction: showDestination ? (clue.destinationInstruction || '') : undefined,
    revealedLocation: revealed && n === 1 ? (clue.answer || null) : undefined,
    revealedAnswer: revealed && n !== 1 ? (clue.answer || null) : undefined,
    state: row.state,
    attempts: row.attempts || 0,
    maxAttempts: clue.maxAttempts || cfg.maxAttempts || 3,
    attemptsLeft: Math.max(0, (clue.maxAttempts || cfg.maxAttempts || 3) - (row.attempts || 0)),
    hintUsed: Boolean(row.hintUsed),
    hintText: isLeader && row.hintUsed ? (clue.hintText || '') : undefined,
    startedAt,
    expiresAt,
    timerStartsAt: startedAt,
    instructionPhase,
    timerArmed,
    timerSeconds: (n === 2 || n === 4) ? (cfg.timerSeconds || 180) : undefined,
    instructionDelaySeconds: n === 2 ? (cfg.timerStartDelaySeconds ?? 20) : undefined,
    awardedPoints: row.awardedPoints ?? null,
    failureReason: row.failureReason || null,
    timeExpired: Boolean(expiresAt && timerArmed && isExpired(expiresAt, now) && row.state === 'ACTIVE'),
    allowLateSubmit: Boolean(cfg.allowLateSubmit || n === 2 || n === 4 || n === 5),
    scoringBands: (n === 2 || n === 4) && row.state === 'ACTIVE' ? (cfg.speedBonusBands || null) : undefined,
    locked: false,
  };
}

function checkpointStatus(bundle, state, session, now) {
  const key = pendingCheckpointKey(state.currentStage);
  if (!key) return null;
  const expected = checkpointForKey(bundle, key);
  const required = teamSize(bundle);
  const cp = state.checkpoints?.[key] || { scans: {}, confirmed: false };
  const scans = cp.scans || {};
  const verifiedCount = Object.keys(scans).length;
  const youScanned = Boolean(
    scans[session.memberKey]
    || (session.localPosterScans || {})[String(key)],
  );
  const scanKind = key === 4 ? 'FOURTH SCAN' : key === 3 ? 'THIRD SCAN' : key === 2 ? 'SECOND SCAN' : 'FIRST SCAN';
  const awaiting = session.role === 'leader'
    && verifiedCount >= required
    && !cp.confirmed;
  const rosterRows = (bundle.team.roster || []).map((m) => ({
    userId: m.memberKey,
    name: m.name,
    role: m.role === 'leader' ? 'leader' : 'player',
    scanned: Boolean(scans[m.memberKey]),
  }));

  return {
    checkpointId: expected?.id || null,
    checkpointKey: String(key),
    code: expected?.code || expected?.checkpointKey,
    locationName: expected?.locationName,
    posterLabel: { scanKind, sharedStation: true },
    publicInstruction: expected?.publicInstruction
      || `Scan the shared ${scanKind.toLowerCase()} poster, then hand proof QRs to your leader.`,
    verifiedCount,
    requiredCount: required,
    youScanned,
    status: cp.confirmed ? 'complete' : awaiting ? 'awaiting_claim' : 'pending',
    awaitingTeamCodeConfirm: awaiting,
    membersNeeded: Math.max(0, required - verifiedCount),
    scanRoster: rosterRows,
    assignmentMissing: !expected,
  };
}

export function buildPlayData(bundle, session, state, now = new Date()) {
  const isLeader = session.role === 'leader';
  const size = teamSize(bundle);

  return {
    event: {
      teamCapacity: size,
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
    challenges: [1, 2, 3, 4, 5].map((n) => challengeView(bundle, state, session, n, now)),
    checkpointStatus: checkpointStatus(bundle, state, session, now),
    serverTime: now.toISOString(),
  };
}
