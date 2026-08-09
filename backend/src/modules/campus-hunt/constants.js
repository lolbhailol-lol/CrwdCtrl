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
  // Clue 1: attempt bands — 1st=20, 2nd=10, 3rd=5; after 3 fails → reveal location, 0 pts
  clue1: {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 0,
    awardMode: 'attempt_bands',
    revealOnMaxAttempts: true,
    attemptBands: [
      { attempt: 1, points: 20 },
      { attempt: 2, points: 10 },
      { attempt: 3, points: 5 },
    ],
  },
  // Clue 2: time-band TOTAL awards (not base+bonus). Late submit after 5:00 = 0 pts.
  clue2: {
    basePoints: 0,
    maxAttempts: 3,
    timerSeconds: 300,
    awardMode: 'time_bands_total',
    allowLateSubmit: true,
    speedBonusBands: [
      { maxSeconds: 60, bonus: 50 },
      { maxSeconds: 120, bonus: 30 },
      { maxSeconds: 300, bonus: 10 },
    ],
  },
  clue3: {
    basePoints: 75,
    maxAttempts: 3,
    timerSeconds: 0,
    speedBonusBands: [],
  },
  clue4: {
    basePoints: 100,
    maxAttempts: 3,
    timerSeconds: 300,
    speedBonusBands: [
      { maxSeconds: 150, bonus: 20 },
      { maxSeconds: 240, bonus: 10 },
      { maxSeconds: 300, bonus: 0 },
    ],
  },
};

/** Player-facing How-to copy per clue (safe to send to client). */
const CLUE_HOW_TO = {
  1: {
    title: 'How to play — Clue 1',
    steps: [
      'Read the sentence and type the campus location.',
      'You have 3 attempts. Fewer tries = more points.',
      'After 3 wrong tries the location is revealed automatically (0 points).',
      'Then go there — all 4 members must scan the station QR.',
    ],
  },
  2: {
    title: 'How to play — Clue 2',
    steps: [
      'Find the hidden 3-digit number in the area.',
      'A 5-minute server timer starts when Clue 2 unlocks.',
      'Faster correct submit = more points. After 5:00 you can still submit for 0 pts.',
      'After the correct number, go to the next location — all 4 members scan again to unlock the decode clue.',
    ],
  },
  3: {
    title: 'How to play — Clue 3',
    steps: [
      'You unlocked a coded message — decode it.',
      'Type the decoded word (leader submits).',
      'You have limited attempts. Hints cost points if you use them.',
      'Think before you submit.',
    ],
  },
  4: {
    title: 'How to play — Final clue',
    steps: [
      'Each member may see a different piece of the puzzle.',
      'Combine all pieces as a team, then the leader submits.',
      'Timer and speed bonus may apply — watch the countdown.',
      'After this, head to the Finish Zone and scan.',
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
  CHECKPOINT_2_COMPLETED: ['CLUE_3_ACTIVE'],
  CLUE_3_ACTIVE: ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'],
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
  CHECKPOINT_2_COMPLETED: 'CLUE_3_ACTIVE',
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
