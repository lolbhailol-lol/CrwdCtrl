const test = require('node:test');
const assert = require('node:assert/strict');

const { getHandler, missionMeta } = require('../../../src/modules/campus-hunt/finale/missions/registry');
const { FINALE_MISSION_BOARD } = require('../../../src/modules/campus-hunt/constants');

test('registry exposes all four finale mission handlers', () => {
  for (const id of ['intel_hunt', 'lockbox', 'field_terminal', 'operation_blackout']) {
    const handler = getHandler(id);
    assert.ok(handler?.startRun, id);
    assert.ok(handler?.submitStep, id);
  }
});

test('mission board order is Intel → Lockbox → Field Terminal → Blackout', () => {
  assert.equal(FINALE_MISSION_BOARD.length, 4);
  assert.deepEqual(
    FINALE_MISSION_BOARD.map((m) => m.id),
    ['intel_hunt', 'lockbox', 'field_terminal', 'operation_blackout'],
  );
  assert.equal(FINALE_MISSION_BOARD.find((m) => m.id === 'intel_hunt').points, 50);
  assert.equal(FINALE_MISSION_BOARD.find((m) => m.id === 'lockbox').points, 75);
  assert.equal(FINALE_MISSION_BOARD.find((m) => m.id === 'field_terminal').points, 125);
  assert.equal(FINALE_MISSION_BOARD.find((m) => m.id === 'operation_blackout').points, 200);
  assert.equal(FINALE_MISSION_BOARD.some((m) => m.comingSoon), false);
  assert.equal(FINALE_MISSION_BOARD.some((m) => /mission_5/i.test(m.id)), false);
});

test('12-team pools sized for full finale field', () => {
  const {
    FINALE_DEFAULTS,
    DEFAULT_INTEL_LOCATION_POOL,
    DEFAULT_LOCKBOX_KEY_POOL,
    DEFAULT_LOCKBOX_CODE_POOL,
  } = require('../../../src/modules/campus-hunt/constants');
  assert.equal(FINALE_DEFAULTS.maxFinalists, 12);
  assert.equal(FINALE_DEFAULTS.directFromR1 + FINALE_DEFAULTS.manualPick, 12);
  assert.equal(DEFAULT_INTEL_LOCATION_POOL.length, 12);
  assert.equal(DEFAULT_LOCKBOX_KEY_POOL.length, 12);
  assert.equal(DEFAULT_LOCKBOX_CODE_POOL.length, 12);
});

test('operation_blackout is available on board (not coming soon)', () => {
  const config = { missions: FINALE_MISSION_BOARD };
  const handler = getHandler('operation_blackout');
  const meta = missionMeta(config, 'operation_blackout');
  const card = handler.getBoardCard({ completedMissionIds: [], status: 'playing' }, config, meta);
  assert.equal(card.status, 'available');
  assert.equal(card.points, 200);
});

test('missionMeta merges config overrides', () => {
  const config = {
    missions: [{ id: 'intel_hunt', title: 'CUSTOM INTEL', points: 60 }],
  };
  const meta = missionMeta(config, 'intel_hunt');
  assert.equal(meta.title, 'CUSTOM INTEL');
  assert.equal(meta.points, 60);
});
