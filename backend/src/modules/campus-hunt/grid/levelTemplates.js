/** CrwdCtrl Grid (Zip-style) — 3 rounds, rising difficulty + scoring. */

const GRID_HINT_COST = 20;

/**
 * Round design:
 * R1 warm-up · R2 mid · R3 hard
 * Timers are tight enough to feel urgent but finishable for a laptop team.
 */
const LEVEL_TEMPLATES = [
  {
    level: 1,
    label: 'Round 1 · Warm-up',
    rows: 5,
    cols: 5,
    wallCount: 1,
    numberCount: 6,
    timeSeconds: 70,
    points: 25,
  },
  {
    level: 2,
    label: 'Round 2 · Climb',
    rows: 6,
    cols: 6,
    wallCount: 3,
    numberCount: 8,
    timeSeconds: 95,
    points: 50,
  },
  {
    level: 3,
    label: 'Round 3 · Peak',
    rows: 8,
    cols: 8,
    wallCount: 6,
    numberCount: 11,
    timeSeconds: 130,
    points: 50,
  },
];

const MAX_GRID_POINTS = LEVEL_TEMPLATES.reduce((sum, l) => sum + l.points, 0);

module.exports = {
  LEVEL_TEMPLATES,
  TOTAL_LEVELS: LEVEL_TEMPLATES.length,
  GRID_HINT_COST,
  MAX_GRID_POINTS,
};
