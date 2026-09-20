export const STAGE_LABELS = {
  WAITING: 'Waiting to start',
  CLUE_1_ACTIVE: 'Clue 1',
  CLUE_1_COMPLETED: 'Scan Orange',
  CHECKPOINT_1_COMPLETED: 'Checkpoint 1 done',
  CLUE_2_ACTIVE: 'Clue 2',
  CLUE_2_COMPLETED: 'Scan Green',
  CLUE_2_FAILED: 'Scan Green',
  CLUE_2_TIMEOUT: 'Scan Green',
  CHECKPOINT_2_COMPLETED: 'Clue 3 unlocking…',
  CLUE_3_ACTIVE: 'Clue 3 — Lockbox',
  CLUE_3_COMPLETED: 'Scan Blue',
  CLUE_3_FAILED: 'Scan Blue',
  CHECKPOINT_3_COMPLETED: 'Field Terminal unlocking…',
  CLUE_4_ACTIVE: 'Clue 4 — Field Terminal',
  CLUE_4_COMPLETED: 'Scan Purple',
  CLUE_4_FAILED: 'Scan Purple',
  CLUE_4_TIMEOUT: 'Scan Purple',
  CHECKPOINT_4_COMPLETED: 'Clue 5 unlocking…',
  CLUE_5_ACTIVE: 'Clue 5',
  CLUE_5_COMPLETED: 'Scan Red',
  CLUE_5_FAILED: 'Scan Red',
  CHECKPOINT_5_COMPLETED: 'Finish unlocking…',
  CLUE_6_ACTIVE: 'MindSpark Lobby',
  CLUE_6_COMPLETED: 'Finish code',
  CLUE_6_FAILED: 'Finish code',
  FINISH_COMPLETED: 'Finished',
  SCORE_LOCKED: 'Score locked',
};

/** Player progress: Start → clues 1–5 → Finish (lobby). No Dest/Desk step. */
export const HUNT_PROGRESS_STEPS = [
  { id: 'start', label: 'Start', short: 'S' },
  { id: 'clue1', label: 'Clue 1', short: '1' },
  { id: 'clue2', label: 'Clue 2', short: '2' },
  { id: 'clue3', label: 'Clue 3', short: '3' },
  { id: 'clue4', label: 'Clue 4', short: '4' },
  { id: 'clue5', label: 'Clue 5', short: '5' },
  { id: 'finish', label: 'Finish', short: 'F' },
];

/**
 * Map team stage → progress index (0–6) and status per step.
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
    || s === 'CLUE_4_TIMEOUT'
  ) index = 4;
  else if (
    s === 'CHECKPOINT_4_COMPLETED'
    || s === 'CLUE_5_ACTIVE'
    || s === 'CLUE_5_COMPLETED'
    || s === 'CLUE_5_FAILED'
  ) index = 5;
  else if (
    s === 'CHECKPOINT_5_COMPLETED'
    || s === 'CLUE_6_ACTIVE'
    || s === 'CLUE_6_COMPLETED'
    || s === 'CLUE_6_FAILED'
    || s === 'FINISH_COMPLETED'
    || s === 'SCORE_LOCKED'
  ) index = 6;
  else index = 0;

  const steps = HUNT_PROGRESS_STEPS.map((step, i) => {
    let status = 'locked';
    if (i < index) status = 'done';
    else if (i === index) {
      if (s === 'FINISH_COMPLETED' || s === 'SCORE_LOCKED') status = 'done';
      else if (s === 'WAITING') status = 'active';
      else if (s === 'CLUE_1_COMPLETED' && i === 1) status = 'done';
      else if (
        ['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(s)
        && i === 2
      ) status = 'done';
      else if (
        ['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(s)
        && i === 3
      ) status = 'done';
      else if (
        ['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'].includes(s)
        && i === 4
      ) status = 'done';
      else if (
        ['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(s)
        && i === 5
      ) status = 'done';
      else if (
        ['CLUE_6_COMPLETED', 'CLUE_6_FAILED'].includes(s)
        && i === 6
      ) status = 'active';
      else status = 'active';
    }
    return { ...step, status };
  });

  let currentLabel = STAGE_LABELS[s] || s;
  if (s === 'CLUE_1_COMPLETED') currentLabel = 'Scan Orange once';
  if (['CLUE_2_COMPLETED', 'CLUE_2_FAILED', 'CLUE_2_TIMEOUT'].includes(s)) {
    currentLabel = 'Scan Green once';
  }
  if (['CLUE_3_COMPLETED', 'CLUE_3_FAILED'].includes(s)) {
    currentLabel = 'Scan Blue once';
  }
  if (['CLUE_4_COMPLETED', 'CLUE_4_FAILED', 'CLUE_4_TIMEOUT'].includes(s)) {
    currentLabel = 'Scan Purple once';
  }
  if (['CLUE_5_COMPLETED', 'CLUE_5_FAILED'].includes(s)) {
    currentLabel = 'Scan Red once · then Finish';
  }
  if (['CLUE_6_ACTIVE', 'CLUE_6_COMPLETED', 'CLUE_6_FAILED'].includes(s)) {
    currentLabel = 'MindSpark Lobby — finish code';
  }

  return { index, steps, currentLabel };
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage || '—';
}
