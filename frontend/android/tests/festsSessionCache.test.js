import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FESTS_CACHE_KEY,
  readFestsCache,
  writeFestsCache,
  readFestsCacheByType,
} from '../src/utils/festsSessionCache.js';

function mockSessionStorage() {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  return store;
}

test('empty fest list is a cache miss, not a real catalog', () => {
  mockSessionStorage();
  writeFestsCache([]);
  assert.equal(readFestsCache(), null);

  writeFestsCache([{ _id: '1', festName: 'MindSpark 2026', festType: 'technical', status: 'ongoing' }]);
  assert.equal(readFestsCache()?.length, 1);
  assert.equal(readFestsCacheByType('technical')?.length, 1);
  assert.equal(readFestsCacheByType('cultural'), null);
});

test('poisoned empty JSON from the old cache key is ignored', () => {
  const store = mockSessionStorage();
  store.set(FESTS_CACHE_KEY, '[]');
  assert.equal(readFestsCache(), null);
});
