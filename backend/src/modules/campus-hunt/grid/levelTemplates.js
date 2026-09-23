/** CrwdCtrl Grid (Zip-style) — 4 rounds: Easy → Medium → Difficult → Hard. */

const GRID_HINT_COST = 20;

/**
 * Round design — rising size, walls, numbers, tighter timers on later rounds.
 * Each cleared round awards its full points (missed timer = 0 for that round only).
 */
const LEVEL_TEMPLATES = [
  {
    level: 1,
    label: 'Easy',
    difficulty: 'easy',
    rows: 5,
    cols: 5,
    wallCount: 2,
    numberCount: 8,
    timeSeconds: 55,
    points: 20,
  },
  {
    level: 2,
    label: 'Medium',
    difficulty: 'medium',
    rows: 6,
    cols: 6,
    wallCount: 4,
    numberCount: 11,
    timeSeconds: 70,
    points: 30,
  },
  {
    level: 3,
    label: 'Difficult',
    difficulty: 'difficult',
    rows: 7,
    cols: 7,
    wallCount: 6,
    numberCount: 14,
    timeSeconds: 80,
    points: 40,
  },
  {
    level: 4,
    label: 'Hard',
    difficulty: 'hard',
    rows: 8,
    cols: 8,
    wallCount: 8,
    numberCount: 16,
    timeSeconds: 95,
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
