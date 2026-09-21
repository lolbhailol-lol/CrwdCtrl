/** Campus Hunt domain constants — Round 1: THE HUNT */

/**
 * Round 1 play model: only the team leader carries a phone.
 * Teammates walk along; leader solves clues and scans posters (one scan unlocks).
 */
const LEADER_ONLY_PHONE = true;
/** Checkpoint scans needed before unlock (leader-only phone = 1). */
const CHECKPOINT_SCAN_REQUIRED = 1;
const LEADER_SCAN_INSTRUCTION =
  'Leader scans the shared QR once — next clue unlocks.';

const EVENT_STATUSES = [
  'draft',
  'registration_open',
  'registration_closed',
  'live',
  'round_1',
  'maut_ka_kuva',
  'danger_level',
  'finale',
  'completed',
];

const ROUND_STATUSES = ['scheduled', 'live', 'locked', 'finalized'];

const COMPETITION_PHASES = ['round1', 'finale'];

const FINALE_MISSION_IDS = [
  'intel_hunt',
  'lockbox',
  'field_terminal',
  'operation_blackout',
];

const FINALE_DEFAULTS = {
  startingScore: 500,
  durationMinutes: 45,
  maxFinalists: 12,
  directFromR1: 5,
  manualPick: 7,
  missionDurationMinutes: 10,
  blackoutDurationMinutes: 15,
  intelMaxAttemptsPerStep: 2,
  lockboxMaxAttemptsPerStep: 3,
  fieldTerminalMaxAttempts: 3,
  /** @deprecated use fieldTerminalMaxAttempts */
  borrowedDeviceMaxAttempts: 3,
};

const FINALE_MISSION_BOARD = [
  { id: 'intel_hunt', title: 'Intel Hunt', emoji: '🧠', points: 50, enabled: true },
  { id: 'lockbox', title: 'The Lockbox', emoji: '🔐', points: 75, enabled: true },
  { id: 'field_terminal', title: 'Field Terminal', emoji: '💻', points: 125, enabled: true },
  {
    id: 'operation_blackout',
    title: 'OPERATION: BLACKOUT',
    emoji: '⚡',
    points: 200,
    enabled: true,
  },
];

const BLACKOUT_ROLES = ['scout', 'cracker', 'navigator', 'controller'];

const DEFAULT_BLACKOUT_ROUTE_POOL = [
  'BLUE → RED → GREEN',
  'RED → GREEN → BLUE',
  'GREEN → BLUE → RED',
  'BLUE → GREEN → RED',
  'RED → BLUE → GREEN',
  'GREEN → RED → BLUE',
];

const DEFAULT_BLACKOUT_CONFIG = {
  durationMinutes: 15,
  maxPenaltyTotal: 100,
  scout: {
    clue: 'The target is:\n- not near the library\n- east of the auditorium\n- closer to the sports ground than the canteen.',
    locationHint: 'All 4 players travel together to the Scout Station marker.',
    acceptedAnswers: ['ORBIT'],
    maxAttempts: 3,
    penalty: 10,
  },
  cracker: {
    puzzlePrompt: 'Decode:\n12 — 15 — 3 — 11\n\nA = 1, B = 2, … Z = 26',
    acceptedAnswers: ['LOCK'],
    maxAttempts: 3,
    penalty: 15,
  },
  navigator: {
    challengePrompt:
      'Follow the unlocked route together (do not split up). At the final BLACKOUT marker, enter the frequency code.',
    acceptedAnswers: ['88.1', '881', '88.1 FM'],
    maxAttempts: 3,
    penalty: 15,
  },
  controller: {
    challengePrompt:
      'Build the activation code as: ACCESS TOKEN − ROUTE INITIALS − FREQUENCY DIGITS\nExample format: AB-BRG-881',
    acceptedAnswers: [],
    useDerivedActivation: true,
    maxAttempts: 3,
    penalty: 20,
  },
  routePool: DEFAULT_BLACKOUT_ROUTE_POOL,
};

/** 12 physical keys for Lockbox Task 1 (one per finalist team). */
const DEFAULT_LOCKBOX_KEY_POOL = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `key_${n}`,
    label: `CRWDCtrl KEY — ${n}`,
    acceptedAnswers: [n, `KEY-${n}`, `KEY ${n}`, `CRWDCTRL KEY — ${n}`, `CRWDCTRL KEY-${n}`],
  };
});

/** Default Task 2 pieces — each of 4 players sees only their own info. */
const DEFAULT_LOCKBOX_PLAYER_PIECES = [
  { seat: 0, label: 'Team Leader', info: 'The first digit is 9' },
  { seat: 1, label: 'Player 2', info: 'The second digit is 4' },
  { seat: 2, label: 'Player 3', info: 'The third digit is 0' },
  { seat: 3, label: 'Player 4', info: 'The fourth digit is 7' },
];

function makeLockboxCodeEntry(id, digits) {
  const code = String(digits);
  return {
    id,
    acceptedCodes: [code],
    playerPieces: [
      { seat: 0, label: 'Team Leader', info: `The first digit is ${code[0]}` },
      { seat: 1, label: 'Player 2', info: `The second digit is ${code[1]}` },
      { seat: 2, label: 'Player 3', info: `The third digit is ${code[2]}` },
      { seat: 3, label: 'Player 4', info: `The fourth digit is ${code[3]}` },
    ],
  };
}

/** 12 Task-2 code sets (one per finalist) so teams do not share a single answer. */
const DEFAULT_LOCKBOX_CODE_POOL = [
  makeLockboxCodeEntry('code_01', '9407'),
  makeLockboxCodeEntry('code_02', '3815'),
  makeLockboxCodeEntry('code_03', '7264'),
  makeLockboxCodeEntry('code_04', '1598'),
  makeLockboxCodeEntry('code_05', '6032'),
  makeLockboxCodeEntry('code_06', '8471'),
  makeLockboxCodeEntry('code_07', '2956'),
  makeLockboxCodeEntry('code_08', '4713'),
  makeLockboxCodeEntry('code_09', '5180'),
  makeLockboxCodeEntry('code_10', '0629'),
  makeLockboxCodeEntry('code_11', '7346'),
  makeLockboxCodeEntry('code_12', '1864'),
];

const DEFAULT_LOCKBOX_CONFIG = {
  clue: 'Thousands of stories live here,\nbut none can speak.',
  locationName: 'Library',
  locationHint: 'Go to this spot together. The physical key is waiting there.',
  keyPool: DEFAULT_LOCKBOX_KEY_POOL,
  codePool: DEFAULT_LOCKBOX_CODE_POOL,
  maxAttemptsKey: 3,
  maxAttemptsCode: 3,
  playerPieces: DEFAULT_LOCKBOX_PLAYER_PIECES,
  acceptedCodes: ['9407'],
  lockboxInstruction:
    'Each teammate sees a different piece of the Digital Lockbox. Talk it out. Only the Team Leader submits the final code.',
};

/** Pilot pool — 12 campus locations for dynamic Intel Hunt assignment (2 per team). */
const DEFAULT_INTEL_LOCATION_POOL = [
  { id: 'loc_01', name: 'Central Library', instruction: 'Find the blue notice board near the entrance. Take the fragment written on the gold sticker.', acceptedAnswers: ['ARC'], fragment: 'ARC' },
  { id: 'loc_02', name: 'Main Canteen', instruction: 'Check the menu board by the cash counter. Read the highlighted word on the left.', acceptedAnswers: ['ADE'], fragment: 'ADE' },
  { id: 'loc_03', name: 'Sports Complex', instruction: 'Look at the trophy case. The fragment is on the plaque for the newest sport.', acceptedAnswers: ['BOLT'], fragment: 'BOLT' },
  { id: 'loc_04', name: 'Admin Block', instruction: 'Find the campus map in the lobby. The fragment is the building code in red.', acceptedAnswers: ['GATE'], fragment: 'GATE' },
  { id: 'loc_05', name: 'Auditorium Steps', instruction: 'Read the event poster on the left pillar. Extract the bold keyword.', acceptedAnswers: ['ECHO'], fragment: 'ECHO' },
  { id: 'loc_06', name: 'North Garden', instruction: 'Locate the stone bench with the dedication plate. Use the first word engraved.', acceptedAnswers: ['FLUX'], fragment: 'FLUX' },
  { id: 'loc_07', name: 'Computer Lab Wing', instruction: 'Check the lab door schedule sheet. Find today\'s highlighted code word.', acceptedAnswers: ['GRID'], fragment: 'GRID' },
  { id: 'loc_08', name: 'Student Plaza', instruction: 'Look at the fest banner facing the fountain. Fragment is the middle word.', acceptedAnswers: ['HUNT'], fragment: 'HUNT' },
  { id: 'loc_09', name: 'Parking Gate B', instruction: 'Read the safety sign near the barrier. Fragment is the last word in caps.', acceptedAnswers: ['IRON'], fragment: 'IRON' },
  { id: 'loc_10', name: 'Science Block', instruction: 'Find the periodic table poster in the corridor. Use the element symbol marked in yellow.', acceptedAnswers: ['JADE'], fragment: 'JADE' },
  { id: 'loc_11', name: 'Hostel Courtyard', instruction: 'Check the notice on the bulletin board by the gate. Fragment is underlined.', acceptedAnswers: ['KEYS'], fragment: 'KEYS' },
  { id: 'loc_12', name: 'Open Amphitheatre', instruction: 'Look at the stage backdrop storage door. Sticker shows your fragment.', acceptedAnswers: ['LUX'], fragment: 'LUX' },
];

const FINALE_ENTRY_STATUS = ['eligible', 'playing', 'stopped', 'locked'];

const FINALE_RUN_STATUS = ['active', 'completed', 'abandoned', 'failed'];

const TEAM_STAGES = [
  'WAITING',
  'CLUE_1_ACTIVE',
  'CLUE_1_COMPLETED',
  'CHECKPOINT_1_COMPLETED',
  'CLUE_2_ACTIVE',
  'CLUE_2_COMPLETED',
  'CLUE_2_FAILED',
  'CLUE_2_TIMEOUT',
  'CHECKPOINT_2_COMPLETED',
  'CLUE_3_ACTIVE',
  'CLUE_3_COMPLETED',
  'CLUE_3_FAILED',
  'CHECKPOINT_3_COMPLETED',
  'CLUE_4_ACTIVE',
  'CLUE_4_COMPLETED',
  'CLUE_4_FAILED',
  'CLUE_4_TIMEOUT',
  'CHECKPOINT_4_COMPLETED',
  'CLUE_5_ACTIVE',
  'CLUE_5_COMPLETED',
  'CLUE_5_FAILED',
  'CHECKPOINT_5_COMPLETED',
  'CLUE_6_ACTIVE',
  'CLUE_6_COMPLETED',
  'CLUE_6_FAILED',
  'FINISH_COMPLETED',
  'SCORE_LOCKED',
];

const TEAM_STATUSES = ['registered', 'active', 'finished', 'disqualified'];

const CHALLENGE_TYPES = ['navigation', 'timed_search', 'decode', 'collaborative'];

const PROGRESS_STATES = [
  'LOCKED',
  'ACTIVE',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT',
  'VOIDED',
];

const ISSUE_CATEGORIES = [
  'team_verification',
  'qr_problem',
  'checkpoint_unavailable',
  'safety',
  'technical',
  'team_dispute',
  'other',
];

const DEFAULT_SCORING_CONFIG = {
  startingScore: 100,
  hintCost: 20,
  // Start 100. Harder physical clues pay more. Hints cost more on blue/red.
  clue1: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 15,
    attemptBands: [
      { attempt: 1, points: 50 },
      { attempt: 2, points: 50 },
      { attempt: 3, points: 50 },
    ],
  },
  // Clue 2: physical digit slips nearby · no timer · flat points.
  clue2: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    timerStartDelaySeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 20,
    speedBonusBands: [],
  },
  // Clue 3 — physical lockbox digits nearby. Harder · fewer tries · pricey hint.
  clue3: {
    basePoints: 65,
    maxAttempts: 2,
    timerSeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    hintCost: 25,
    speedBonusBands: [],
  },
  // Clue 4 — Field Terminal (Zip Grid).
  clue4: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    timerStartDelaySeconds: 0,
    awardMode: 'flat_base',
    allowLateSubmit: true,
    hintCost: 20,
    speedBonusBands: [],
  },
  // Clue 5 — physical word slips nearby. Speed bonus · expensive hints.
  clue5: {
    basePoints: 45,
    maxAttempts: 2,
    timerSeconds: 240,
    awardMode: 'base_plus_speed',
    allowLateSubmit: true,
    revealOnMaxAttempts: true,
    hintCost: 30,
    speedBonusBands: [
      { maxSeconds: 90, bonus: 30 },
      { maxSeconds: 150, bonus: 15 },
      { maxSeconds: 240, bonus: 5 },
    ],
  },
  // Clue 6: finish code.
  clue6: {
    basePoints: 30,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    hintCost: 15,
    speedBonusBands: [],
  },
};

/** Player-facing How-to copy per clue (safe to send to client). */
const CLUE_HOW_TO = {
  1: {
    title: 'Clue 1 · place',
    steps: [
      'Type the campus place (3 tries).',
      'Miss all 3 → answer shown (0 pts) — type it.',
      'Walk there · scan orange once.',
    ],
  },
  2: {
    title: 'Clue 2 · digits',
    steps: [
      'At green: find numbered digit slips (1, 2, 3…).',
      'Join digits in order · type the number (3 tries).',
      'Miss all 3 → answer shown (0 pts).',
      'Scan green once.',
    ],
  },
  3: {
    title: 'Clue 3 · lockbox',
    steps: [
      'Find the physical lockbox nearby.',
      'Type the code written on it.',
      'Scan blue once.',
    ],
  },
  4: {
    title: 'Clue 4 · Zip Grid',
    steps: [
      'Borrow a laptop with internet.',
      'Open Zip Grid · type the device key from this phone.',
      'Clear 4 rounds · type GRID-XXXX here · scan purple once.',
    ],
  },
  5: {
    title: 'Clue 5 · word',
    steps: [
      'At red: find numbered letter slips (letters — not digits).',
      'Join in order into one word.',
      'Scan red once · then Mindspark Lobby.',
    ],
  },
  6: {
    title: 'Finish · lobby',
    steps: [
      'Go to Mindspark Lobby together.',
      'Ask organizer for the finish code.',
      'Type it to lock your score.',
    ],
  },
};

/** Legal stage transitions for Round 1 */
const STAGE_TRANSITIONS = {
  WAITING: ['CLUE_1_ACTIVE'],
  CLUE_1_ACTIVE: ['CLUE_1_COMPLETED'],
  CLUE_1_COMPLETED: ['CHECKPOINT_1_COMPLETED'],
  CHECKPOINT_1_COMPLETED: ['CLUE_2_ACTIVE'],
  CLUE_2_ACTIVE: ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'],
  CLUE_2_COMPLETED: ['CHECKPOINT_2_COMPLETED'],
  CLUE_2_FAILED: ['CHECKPOINT_2_COMPLETED'],
  CLUE_2_TIMEOUT: ['CHECKPOINT_2_COMPLETED'],
  // After green SECOND SCAN → Clue 3 Lockbox (code → blue stop)
  CHECKPOINT_2_COMPLETED: ['CLUE_3_ACTIVE'],
  CLUE_3_ACTIVE: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  // After Clue 3 → go scan blue CP3
  CLUE_3_COMPLETED: ['CHECKPOINT_3_COMPLETED'],
  CLUE_3_FAILED: ['CHECKPOINT_3_COMPLETED'],
  // After blue → Field Terminal
  CHECKPOINT_3_COMPLETED: ['CLUE_4_ACTIVE'],
  CLUE_4_ACTIVE: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'],
  CLUE_4_COMPLETED: ['CHECKPOINT_4_COMPLETED'],
  CLUE_4_FAILED: ['CHECKPOINT_4_COMPLETED'],
  CLUE_4_TIMEOUT: ['CHECKPOINT_4_COMPLETED'],
  // After purple → Clue 5 (5th stop word)
  CHECKPOINT_4_COMPLETED: ['CLUE_5_ACTIVE'],
  CLUE_5_ACTIVE: ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'],
  CLUE_5_COMPLETED: ['CHECKPOINT_5_COMPLETED'],
  CLUE_5_FAILED: ['CHECKPOINT_5_COMPLETED'],
  // After 5th scan → destination clue
  CHECKPOINT_5_COMPLETED: ['CLUE_6_ACTIVE'],
  CLUE_6_ACTIVE: ['CLUE_6_COMPLETED', 'CLUE_6_FAILED'],
  CLUE_6_COMPLETED: ['FINISH_COMPLETED'],
  CLUE_6_FAILED: ['FINISH_COMPLETED'],
  FINISH_COMPLETED: ['SCORE_LOCKED'],
  SCORE_LOCKED: [],
};

const CHALLENGE_NUMBER_TO_ACTIVE_STAGE = {
  1: 'CLUE_1_ACTIVE',
  2: 'CLUE_2_ACTIVE',
  3: 'CLUE_3_ACTIVE',
  4: 'CLUE_4_ACTIVE',
  5: 'CLUE_5_ACTIVE',
  6: 'CLUE_6_ACTIVE',
};

const CHALLENGE_RESOLVED_STAGES = {
  // Clue 1 always advances to scan phase (even after max attempts reveal)
  1: { completed: 'CLUE_1_COMPLETED', failed: 'CLUE_1_COMPLETED' },
  2: {
    completed: 'CLUE_2_COMPLETED',
    failed: 'CLUE_2_FAILED',
    timeout: 'CLUE_2_TIMEOUT',
  },
  3: {
    completed: 'CLUE_3_COMPLETED',
    failed: 'CLUE_3_FAILED',
  },
  4: {
    completed: 'CLUE_4_COMPLETED',
    failed: 'CLUE_4_FAILED',
    timeout: 'CLUE_4_TIMEOUT',
  },
  5: {
    completed: 'CLUE_5_COMPLETED',
    failed: 'CLUE_5_FAILED',
  },
  6: {
    completed: 'CLUE_6_COMPLETED',
    failed: 'CLUE_6_FAILED',
  },
};

const CHECKPOINT_UNLOCK_STAGE = {
  1: 'CLUE_1_COMPLETED',
  2: ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'],
  3: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  4: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'],
  5: ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'],
  FINISH: ['CLUE_6_COMPLETED', 'CLUE_6_FAILED'],
};

const CHECKPOINT_NEXT_STAGE = {
  1: 'CHECKPOINT_1_COMPLETED',
  2: 'CHECKPOINT_2_COMPLETED',
  3: 'CHECKPOINT_3_COMPLETED',
  4: 'CHECKPOINT_4_COMPLETED',
  5: 'CHECKPOINT_5_COMPLETED',
  FINISH: 'FINISH_COMPLETED',
};

const AUTO_ADVANCE_AFTER_CHECKPOINT = {
  CHECKPOINT_1_COMPLETED: 'CLUE_2_ACTIVE',
  CHECKPOINT_2_COMPLETED: 'CLUE_3_ACTIVE',
  CHECKPOINT_3_COMPLETED: 'CLUE_4_ACTIVE',
  CHECKPOINT_4_COMPLETED: 'CLUE_5_ACTIVE',
  CHECKPOINT_5_COMPLETED: 'CLUE_6_ACTIVE',
  FINISH_COMPLETED: 'SCORE_LOCKED',
};

module.exports = {
  EVENT_STATUSES,
  ROUND_STATUSES,
  TEAM_STAGES,
  TEAM_STATUSES,
  CHALLENGE_TYPES,
  PROGRESS_STATES,
  ISSUE_CATEGORIES,
  DEFAULT_SCORING_CONFIG,
  LEADER_ONLY_PHONE,
  CHECKPOINT_SCAN_REQUIRED,
  LEADER_SCAN_INSTRUCTION,
  CLUE_HOW_TO,
  STAGE_TRANSITIONS,
  CHALLENGE_NUMBER_TO_ACTIVE_STAGE,
  CHALLENGE_RESOLVED_STAGES,
  CHECKPOINT_UNLOCK_STAGE,
  CHECKPOINT_NEXT_STAGE,
  AUTO_ADVANCE_AFTER_CHECKPOINT,
  COMPETITION_PHASES,
  FINALE_MISSION_IDS,
  FINALE_DEFAULTS,
  FINALE_ENTRY_STATUS,
  FINALE_RUN_STATUS,
  FINALE_MISSION_BOARD,
  DEFAULT_INTEL_LOCATION_POOL,
  DEFAULT_LOCKBOX_KEY_POOL,
  DEFAULT_LOCKBOX_PLAYER_PIECES,
  DEFAULT_LOCKBOX_CODE_POOL,
  DEFAULT_LOCKBOX_CONFIG,
  BLACKOUT_ROLES,
  DEFAULT_BLACKOUT_ROUTE_POOL,
  DEFAULT_BLACKOUT_CONFIG,
};
