export const STAGE_LABELS = {
  WAITING: 'Waiting to start',
  CLUE_1_ACTIVE: 'Clue 1',
  CLUE_1_COMPLETED: 'Scan station QR (all members)',
  CHECKPOINT_1_COMPLETED: 'Checkpoint 1 done',
  CLUE_2_ACTIVE: 'Clue 2',
  CLUE_2_COMPLETED: 'Go scan green SECOND SCAN',
  CLUE_2_FAILED: 'Go scan green SECOND SCAN',
  CLUE_2_TIMEOUT: 'Go scan green SECOND SCAN',
  CHECKPOINT_2_COMPLETED: 'Clue 3 unlocking…',
  CLUE_3_ACTIVE: 'Clue 3 — Decode',
  CLUE_3_COMPLETED: 'Find blue Checkpoint 3 card & scan',
  CLUE_3_FAILED: 'Find blue Checkpoint 3 card & scan',
  CHECKPOINT_3_COMPLETED: 'Checkpoint 3 done',
  CLUE_4_ACTIVE: 'Final clue — combine 4 codes',
  CLUE_4_COMPLETED: 'Report to your start · ask organizer',
  CLUE_4_FAILED: 'Report to your start · ask organizer',
  FINISH_COMPLETED: 'Finished',
  SCORE_LOCKED: 'Score locked',
};

/** Player dashboard progress steps (release → Clue 1 → Final → Done). */
export const HUNT_PROGRESS_STEPS = [
  { id: 'start', label: 'Start', short: 'S' },
  { id: 'clue1', label: 'Clue 1', short: '1' },
  { id: 'clue2', label: 'Clue 2', short: '2' },
  { id: 'clue3', label: 'Clue 3', short: '3' },
  { id: 'final', label: 'Final', short: 'F' },
  { id: 'done', label: 'Finish', short: '✓' },
];

/**
 * Map team stage → progress index (0–5) and status per step.
 * Index = current/highest unlocked step; earlier steps are complete.
 */
export function huntProgressFromStage(stage) {
  const s = String(stage || 'WAITING');

  let index = 0;
  if (s === 'WAITING') index = 0;
  else if (s === 'CLUE_1_ACTIVE' || s === 'CLUE_1_COMPLETED') index = 1;
  else if (
    s === 'CHECKPOINT_1_COMPLETED'
    || s === 'CLUE_2_ACTIVE'
    || s === 'CLUE_2_COMPLETED'
    || s === 'CLUE_2_FAILED'
    || s === 'CLUE_2_TIMEOUT'
  ) index = 2;
  else if (
    s === 'CHECKPOINT_2_COMPLETED'
    || s === 'CLUE_3_ACTIVE'
    || s === 'CLUE_3_COMPLETED'
    || s === 'CLUE_3_FAILED'
  ) index = 3;
  else if (
    s === 'CHECKPOINT_3_COMPLETED'
    || s === 'CLUE_4_ACTIVE'
    || s === 'CLUE_4_COMPLETED'
    || s === 'CLUE_4_FAILED'
  ) index = 4;
  else if (s === 'FINISH_COMPLETED' || s === 'SCORE_LOCKED') index = 5;
  else index = 0;

  const steps = HUNT_PROGRESS_STEPS.map((step, i) => {
    let status = 'locked';
    if (i < index) status = 'done';
    else if (i === index) {
      if (s === 'FINISH_COMPLETED' || s === 'SCORE_LOCKED') status = 'done';
      else if (s === 'WAITING') status = 'waiting';
      else if (s === 'CLUE_1_COMPLETED' && i === 1) status = 'done';
      else if (
        ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(s)
        && i === 2
      ) status = 'done';
      else status = 'active';
    }
    return { ...step, status };
  });

  let currentLabel = STAGE_LABELS[s] || s;
  if (s === 'CLUE_1_COMPLETED') currentLabel = 'Go scan yellow FIRST SCAN card (all members)';
  if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(s)) {
    currentLabel = 'Go to next place · find your green QR · all 4 scan → Clue 3';
  }
  if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(s)) {
    currentLabel = 'Go to next place · find blue Checkpoint 3 card & scan → Final';
  }
  if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED'].includes(s)) {
    currentLabel = 'Report to your start · ask organizer to mark reached';
  }

  return { index, steps, currentLabel };
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage || '—';
}
