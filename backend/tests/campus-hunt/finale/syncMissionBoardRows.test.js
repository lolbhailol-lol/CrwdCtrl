const test = require('node:test');
const assert = require('node:assert/strict');

const { FINALE_MISSION_BOARD } = require('../../../src/modules/campus-hunt/constants');
const { syncMissionBoardRows } = require('../../../src/modules/campus-hunt/services/finale/finaleBootstrapService');

/** Mongoose subdocs expose schema paths via non-enumerable getters; `{ ...row }` is empty. */
function defineSubdoc(data, { withToObject = true } = {}) {
  const doc = {};
  const fields = ['id', 'title', 'emoji', 'points', 'enabled', 'comingSoon'];
  for (const key of fields) {
    Object.defineProperty(doc, key, {
      get: () => data[key],
      enumerable: false,
    });
  }
  if (withToObject) {
    Object.defineProperty(doc, 'toObject', {
      value: () => ({ ...data }),
      enumerable: false,
    });
  }
  return doc;
}

function mongooseLikeSubdoc(data) {
  return defineSubdoc(data, { withToObject: true });
}

function getterOnlySubdoc(data) {
  return defineSubdoc(data, { withToObject: false });
}

test('syncMissionBoardRows: already-canonical mongoose-like subdocs are not dirty', () => {
  const config = {
    missions: FINALE_MISSION_BOARD.map((m) => mongooseLikeSubdoc({ ...m })),
    markModified() {
      throw new Error('should not markModified when canonical');
    },
  };
  assert.equal(syncMissionBoardRows(config), false);
});

test('syncMissionBoardRows: getter-only fields matching the board are not dirty', () => {
  const config = {
    missions: FINALE_MISSION_BOARD.map((m) => getterOnlySubdoc({ ...m })),
  };
  assert.equal(syncMissionBoardRows(config), false);
});

test('syncMissionBoardRows: spread-empty subdocs still sync from toObject', () => {
  const config = {
    missions: FINALE_MISSION_BOARD.map((m) => mongooseLikeSubdoc({ ...m })),
  };
  // Reproducing the old bug: spreading a getter-only row looks empty
  for (const row of config.missions) {
    assert.equal(Object.keys({ ...row }).length, 0);
  }
  assert.equal(syncMissionBoardRows(config), false);
});

test('syncMissionBoardRows: borrowed_device + 100pts Field Terminal is dirty and canonicalized', () => {
  const config = {
    missions: [
      mongooseLikeSubdoc({ id: 'intel_hunt', title: 'Intel Hunt', emoji: '🧠', points: 50, enabled: true }),
      mongooseLikeSubdoc({ id: 'lockbox', title: 'The Lockbox', emoji: '🔐', points: 75, enabled: true }),
      mongooseLikeSubdoc({
        id: 'borrowed_device',
        title: 'Borrowed Device',
        emoji: '💻',
        points: 100,
        enabled: true,
      }),
      mongooseLikeSubdoc({
        id: 'operation_blackout',
        title: 'OPERATION: BLACKOUT',
        emoji: '⚡',
        points: 200,
        enabled: true,
      }),
    ],
  };
  assert.equal(syncMissionBoardRows(config), true);
  assert.deepEqual(config.missions.map((m) => m.id), [
    'intel_hunt',
    'lockbox',
    'field_terminal',
    'operation_blackout',
  ]);
  const ft = config.missions.find((m) => m.id === 'field_terminal');
  assert.equal(ft.title, 'Field Terminal');
  assert.equal(ft.points, 125);
});
