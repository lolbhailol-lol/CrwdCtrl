import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

const dispatched = [];
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = {
  location: {
    hostname: 'www.crwdctrl.in',
    protocol: 'https:',
    origin: 'https://www.crwdctrl.in',
  },
  dispatchEvent(event) {
    dispatched.push(event);
  },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

let online = false;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    get onLine() {
      return online;
    },
    userAgent: 'node-test',
  },
});

const {
  clearOfflineProgressQueue,
  enqueueOfflineProgress,
  flushOfflineProgressQueue,
  offlineBoardPendingCount,
} = await import('../src/features/campus-hunt/offline/offlineBoardSync.js');

const bundle = {
  event: { id: 'event-1', apiBase: 'https://api.example.test/api' },
  team: { teamCode: 'TEAM1' },
};

function state(overrides = {}) {
  return {
    score: 250,
    currentStage: 'CLUE_4_ACTIVE',
    seq: 8,
    clueProgress: {},
    ...overrides,
  };
}

test.beforeEach(() => {
  clearOfflineProgressQueue();
  dispatched.length = 0;
  online = false;
  globalThis.fetch = async () => {
    throw new Error('fetch must not run while offline');
  };
});

test('keeps the latest score locally while offline, then syncs it on reconnect', async () => {
  const queued = await enqueueOfflineProgress(bundle, state());
  assert.equal(queued.queued, true);
  assert.equal(queued.syncedOk, false);
  assert.equal(offlineBoardPendingCount(), 1);

  online = true;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: { accepted: true, seq: 8, score: 250, rank: 3, fieldSize: 12 },
    }),
  });

  const result = await flushOfflineProgressQueue(bundle);
  assert.equal(result.syncedOk, true);
  assert.equal(result.rank, 3);
  assert.equal(result.fieldSize, 12);
  assert.equal(offlineBoardPendingCount(), 0);
  assert.equal(dispatched.at(-1)?.type, 'ch-offline-board-synced');
});

test('drops a completed-team snapshot when the server says SCORE_LOCKED', async () => {
  await enqueueOfflineProgress(bundle, state({
    score: 440,
    currentStage: 'SCORE_LOCKED',
    seq: 12,
  }));
  assert.equal(offlineBoardPendingCount(), 1);

  online = true;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { ignored: true, reason: 'SCORE_LOCKED', seq: 12 } }),
    };
  };

  const result = await flushOfflineProgressQueue(bundle);
  assert.equal(requests, 1);
  assert.equal(result.syncedOk, false);
  assert.equal(result.ignoredReason, 'SCORE_LOCKED');
  assert.equal(offlineBoardPendingCount(), 0);
});

test('keeps a recoverable stale-sequence snapshot queued', async () => {
  await enqueueOfflineProgress(bundle, state());
  online = true;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { ignored: true, reason: 'STALE_SEQ', seq: 20 } }),
  });

  const result = await flushOfflineProgressQueue(bundle);
  assert.equal(result.ignoredReason, 'STALE_SEQ');
  assert.equal(result.seq, 20);
  assert.equal(offlineBoardPendingCount(), 1);
});

test('keeps Grid and finish reconciliation snapshots queued until the server verifies them', async () => {
  for (const reason of ['GRID_RESULT_PENDING', 'FINISH_AWARD_PENDING']) {
    clearOfflineProgressQueue();
    online = false;
    await enqueueOfflineProgress(bundle, state());
    online = true;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { ignored: true, reason, seq: 8 } }),
    });

    const result = await flushOfflineProgressQueue(bundle);
    assert.equal(result.ignoredReason, reason);
    assert.equal(offlineBoardPendingCount(), 1);
  }
});
