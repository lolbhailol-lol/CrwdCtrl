const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validatePath,
  generatePuzzle,
  publicPuzzleView,
} = require('../../../src/modules/campus-hunt/grid/puzzleGenerator');
const {
  LEVEL_TEMPLATES,
  TOTAL_LEVELS,
  MAX_GRID_POINTS,
  GRID_HINT_COST,
} = require('../../../src/modules/campus-hunt/grid/levelTemplates');

test('generates 3 Zip levels with 20/40/40 points', () => {
  assert.equal(TOTAL_LEVELS, 3);
  assert.equal(LEVEL_TEMPLATES[0].points, 20);
  assert.equal(LEVEL_TEMPLATES[1].points, 40);
  assert.equal(LEVEL_TEMPLATES[2].points, 40);
  assert.equal(MAX_GRID_POINTS, 100);
  assert.equal(GRID_HINT_COST, 20);
  assert.equal(LEVEL_TEMPLATES[0].rows, 5);
  assert.equal(LEVEL_TEMPLATES[1].rows, 6);
  assert.equal(LEVEL_TEMPLATES[2].rows, 7);
});

test('valid Zip solution path passes validation', () => {
  const puzzle = generatePuzzle(0, 42);
  assert.ok(puzzle.numbers?.length >= 2);
  assert.equal(puzzle.fillAll, true);
  const result = validatePath(puzzle, puzzle.solutionPath);
  assert.equal(result.ok, true);
  assert.equal(result.points, 20);
});

test('diagonal step rejected', () => {
  const puzzle = generatePuzzle(0, 99);
  const bad = [puzzle.start, { r: puzzle.start.r + 1, c: puzzle.start.c + 1 }];
  const result = validatePath(puzzle, bad);
  assert.equal(result.ok, false);
});

test('reused cell rejected', () => {
  const puzzle = generatePuzzle(0, 100);
  const path = [puzzle.start, { r: puzzle.start.r, c: puzzle.start.c + 1 }, puzzle.start];
  const result = validatePath(puzzle, path);
  assert.equal(result.ok, false);
});

test('incomplete fill rejected', () => {
  const puzzle = generatePuzzle(0, 101);
  const short = puzzle.solutionPath.slice(0, Math.max(2, puzzle.solutionPath.length - 3));
  // Ensure starts at 1 and maybe ends wrong
  const result = validatePath(puzzle, short);
  assert.equal(result.ok, false);
});

test('public puzzle view hides solution', () => {
  const puzzle = generatePuzzle(2, 102);
  const pub = publicPuzzleView(puzzle);
  assert.equal(pub.puzzleId, puzzle.puzzleId);
  assert.equal(pub.solutionPath, undefined);
  assert.ok(Array.isArray(pub.numbers));
  assert.equal(pub.points, 40);
});
