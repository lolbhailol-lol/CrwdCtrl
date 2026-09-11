/** CrwdCtrl Grid (Zip-style) — level definitions + scoring. */

const GRID_HINT_COST = 20;

const LEVEL_TEMPLATES = [
  {
    level: 1,
    label: 'Zip · Easy',
    rows: 5,
    cols: 5,
    wallCount: 0,
    numberCount: 5,
    timeSeconds: 90,
    points: 25,
  },
  {
    level: 2,
    label: 'Zip · Medium',
    rows: 6,
    cols: 6,
    wallCount: 2,
    numberCount: 7,
    timeSeconds: 120,
    points: 50,
  },
  {
    level: 3,
    label: 'Zip · Hard',
    rows: 7,
    cols: 7,
    wallCount: 4,
    numberCount: 9,
    timeSeconds: 150,
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
