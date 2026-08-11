const test = require('node:test');
const assert = require('node:assert/strict');

const { getHandler, missionMeta } = require('../../../src/modules/campus-hunt/finale/missions/registry');
const { FINALE_MISSION_BOARD } = require('../../../src/modules/campus-hunt/constants');

test('registry exposes intel_hunt and field_terminal handlers', () => {
  const intel = getHandler('intel_hunt');
  const device = getHandler('field_terminal');
  assert.ok(intel?.startRun);
  assert.ok(intel?.submitStep);
  assert.ok(device?.startRun);
  assert.ok(device?.submitStep);
});

test('placeholder missions are coming soon on board', () => {
  const config = { missions: FINALE_MISSION_BOARD };
  for (const id of ['mission_3', 'mission_4']) {
    const handler = getHandler(id);
    assert.ok(handler, id);
    const meta = missionMeta(config, id);
    const card = handler.getBoardCard({ completedMissionIds: [], status: 'playing' }, config, meta);
    assert.equal(card.status, 'coming_soon');
  }
});

test('missionMeta merges config overrides', () => {
  const config = {
    missions: [{ id: 'intel_hunt', title: 'CUSTOM INTEL', points: 60 }],
  };
  const meta = missionMeta(config, 'intel_hunt');
  assert.equal(meta.title, 'CUSTOM INTEL');
  assert.equal(meta.points, 60);
});
