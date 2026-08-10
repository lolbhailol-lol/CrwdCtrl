/** Campus Hunt domain constants — Round 1: THE HUNT */

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
  hintCost: 15,
  // Each clue: 50 pts on time. Late still unlocks next clue at 0 pts. Hints −15.
  clue1: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    revealOnMaxAttempts: true,
    attemptBands: [
      { attempt: 1, points: 50 },
      { attempt: 2, points: 50 },
      { attempt: 3, points: 50 },
    ],
  },
  // Clue 2: 20s read, then 3:00. Faster = more (max 50). Late = 0 pts, still continue.
  clue2: {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 180,
    timerStartDelaySeconds: 20,
    awardMode: 'time_bands_total',
    allowLateSubmit: true,
    speedBonusBands: [
      { maxSeconds: 60, bonus: 50 },
      { maxSeconds: 120, bonus: 30 },
      { maxSeconds: 180, bonus: 10 },
    ],
  },
  clue3: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'flat_base',
    speedBonusBands: [],
  },
  // Clue 4: 50 base + speed bonus if fast. Late = 0 pts, still report to start.
  clue4: {
    basePoints: 50,
    maxAttempts: 3,
    timerSeconds: 300,
    awardMode: 'base_plus_speed',
    allowLateSubmit: true,
    speedBonusBands: [
      { maxSeconds: 120, bonus: 25 },
      { maxSeconds: 210, bonus: 15 },
      { maxSeconds: 300, bonus: 5 },
    ],
  },
};

/** Player-facing How-to copy per clue (safe to send to client). */
const CLUE_HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'Read the sentence and type the campus location.',
      'Correct answer = 50 points (any attempt). After 3 wrong tries the location is revealed (0 points).',
      'Go there — all 4 members scan your yellow card.',
      'Then pick up your card and take it — leave other teams’ cards for them.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'Read the instructions carefully (20 seconds).',
      'Then a 3-minute timer starts — find the hidden 3-digit number.',
      'Faster correct submit = more points. After 3:00 you can still submit for 0 pts.',
      'After the correct number: go straight to your next location.',
      'Find your green SECOND SCAN card — all 4 scan, then pick it up and take it.',
      'Next: find your blue Checkpoint 3 card at the following place (not Clue 3 yet).',
    ],
  },
  3: {
    title: 'How to play — Clue 3',
    steps: [
      'Your blue Checkpoint 3 card is already scanned — decode the riddle on your phone.',
      'Type the answer (leader submits). Limited attempts; hints cost points.',
      'Think before you submit.',
      'After this, the Final one-word puzzle unlocks.',
    ],
  },
  4: {
    title: 'How to play — Final clue',
    steps: [
      'Each teammate sees their own code fragment on their phone.',
      'Say the four codes in order 1→4 and rebuild the one word.',
      'Leader submits the word. Faster = bonus points; after the timer you still can submit for 0 pts.',
      'Then report to your start location and ask the organizer to mark your team reached.',
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
  // After green SECOND SCAN → Clue 3 Caesar riddle (tells where blue is)
  CHECKPOINT_2_COMPLETED: ['CLUE_3_ACTIVE'],
  CLUE_3_ACTIVE: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  // After Clue 3 → go scan blue CP3
  CLUE_3_COMPLETED: ['CHECKPOINT_3_COMPLETED'],
  CLUE_3_FAILED: ['CHECKPOINT_3_COMPLETED'],
  CHECKPOINT_3_COMPLETED: ['CLUE_4_ACTIVE'],
  CLUE_4_ACTIVE: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED'],
  CLUE_4_COMPLETED: ['FINISH_COMPLETED'],
  CLUE_4_FAILED: ['FINISH_COMPLETED'],
  FINISH_COMPLETED: ['SCORE_LOCKED'],
  SCORE_LOCKED: [],
};

const CHALLENGE_NUMBER_TO_ACTIVE_STAGE = {
  1: 'CLUE_1_ACTIVE',
  2: 'CLUE_2_ACTIVE',
  3: 'CLUE_3_ACTIVE',
  4: 'CLUE_4_ACTIVE',
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
  },
};

const CHECKPOINT_UNLOCK_STAGE = {
  1: 'CLUE_1_COMPLETED',
  2: ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'],
  // Blue CP3 cards unlock after Clue 3 Caesar riddle is solved
  3: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
  FINISH: ['CLUE_4_COMPLETED', 'CLUE_4_FAILED'],
};

const CHECKPOINT_NEXT_STAGE = {
  1: 'CHECKPOINT_1_COMPLETED',
  2: 'CHECKPOINT_2_COMPLETED',
  3: 'CHECKPOINT_3_COMPLETED',
  FINISH: 'FINISH_COMPLETED',
};

const AUTO_ADVANCE_AFTER_CHECKPOINT = {
  CHECKPOINT_1_COMPLETED: 'CLUE_2_ACTIVE',
  // Green 4/4 → open Clue 3 riddle immediately
  CHECKPOINT_2_COMPLETED: 'CLUE_3_ACTIVE',
  // Blue 4/4 → open Final
  CHECKPOINT_3_COMPLETED: 'CLUE_4_ACTIVE',
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
  CLUE_HOW_TO,
  STAGE_TRANSITIONS,
  CHALLENGE_NUMBER_TO_ACTIVE_STAGE,
  CHALLENGE_RESOLVED_STAGES,
  CHECKPOINT_UNLOCK_STAGE,
  CHECKPOINT_NEXT_STAGE,
  AUTO_ADVANCE_AFTER_CHECKPOINT,
};
