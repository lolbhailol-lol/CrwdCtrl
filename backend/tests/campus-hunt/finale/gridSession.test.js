const test = require('node:test');
const assert = require('node:assert/strict');

const CampusHuntGridSession = require('../../../src/modules/campus-hunt/models/CampusHuntGridSession');
const { generateAllLevels } = require('../../../src/modules/campus-hunt/grid/puzzleGenerator');
const {
  randomAccessCode,
  validateCompletionCode,
  claimCompletionCode,
  sessionPublicView,
  isLevelTimedOut,
  levelTimeRemainingSeconds,
} = require('../../../src/modules/campus-hunt/services/grid/gridSessionService');

test('12 simulated access codes are all unique', () => {
  const codes = new Set();
  for (let i = 0; i < 12; i += 1) {
    codes.add(randomAccessCode());
  }
  assert.equal(codes.size, 12);
});

test('each grid session gets a distinct puzzle set', () => {
  const teamA = generateAllLevels();
  const teamB = generateAllLevels();
  const idsA = teamA.map((p) => p.puzzleId).join('|');
  const idsB = teamB.map((p) => p.puzzleId).join('|');
  assert.notEqual(idsA, idsB);
});

test('join view exposes team identity and scoring fields', () => {
  const session = {
    sessionToken: 'abc123',
    teamCode: 'CC007',
    teamLabel: 'Team Seven',
    currentLevelIndex: 0,
    puzzles: generateAllLevels(),
    levelProgress: [{ levelIndex: 0, completed: false, moves: 0, startedAt: new Date(), pointsAwarded: 0 }],
    scoreEarned: 0,
    hintsUsed: 0,
    score: 0,
    status: 'active',
    expiresAt: new Date(Date.now() + 60000),
  };
  const view = sessionPublicView(session);
  assert.equal(view.teamCode, 'CC007');
  assert.equal(view.teamLabel, 'Team Seven');
  assert.equal(view.puzzle.solutionPath, undefined);
  assert.ok(view.levelStartedAt);
  assert.equal(view.maxScore, 100);
  assert.equal(view.hintCost, 20);
  assert.equal(view.levelPoints, 20);
});

test('level timer detects expiry server-side', () => {
  const puzzles = generateAllLevels();
  const session = {
    currentLevelIndex: 0,
    puzzles,
    levelProgress: [{
      levelIndex: 0,
      completed: false,
      moves: 0,
      startedAt: new Date(Date.now() - (puzzles[0].timeSeconds + 5) * 1000),
    }],
    status: 'active',
    expiresAt: new Date(Date.now() + 60000),
  };
  assert.equal(isLevelTimedOut(session, puzzles[0]), true);
  assert.equal(levelTimeRemainingSeconds(session, puzzles[0]), 0);
});

test('validateCompletionCode is read-only', async () => {
  const originalFindOne = CampusHuntGridSession.findOne;
  let saved = false;
  CampusHuntGridSession.findOne = async () => ({
    teamId: 'team-a-id',
    missionRunId: 'run-a-id',
    status: 'completed',
    completionCodeUsed: false,
    save: async () => {
      saved = true;
    },
  });

  try {
    const result = await validateCompletionCode('GRID-ABCD', { teamId: 'team-a-id' });
    assert.equal(result.ok, true);
    assert.equal(saved, false);
  } finally {
    CampusHuntGridSession.findOne = originalFindOne;
  }
});

test('validateCompletionCode rejects wrong team', async () => {
  const originalFindOne = CampusHuntGridSession.findOne;
  CampusHuntGridSession.findOne = async () => ({
    teamId: 'team-a-id',
    missionRunId: 'run-a-id',
    status: 'completed',
    completionCodeUsed: false,
  });

  try {
    const result = await validateCompletionCode('GRID-ABCD', { teamId: 'team-b-id' });
    assert.equal(result.ok, false);
    assert.match(result.message, /another team/i);
  } finally {
    CampusHuntGridSession.findOne = originalFindOne;
  }
});

test('claimCompletionCode atomically marks used', async () => {
  const originalFindOneAndUpdate = CampusHuntGridSession.findOneAndUpdate;
  CampusHuntGridSession.findOneAndUpdate = async () => ({
    teamId: 'team-a-id',
    completionCodeUsed: true,
  });

  try {
    const result = await claimCompletionCode('GRID-WXYZ', {
      teamId: 'team-a-id',
      missionRunId: 'run-a-id',
    });
    assert.equal(result.ok, true);
  } finally {
    CampusHuntGridSession.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
