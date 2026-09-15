import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAttemptStaleRecover, STALE_RECOVER_COOLDOWN_MS } from '../src/utils/chunkError.js';

test('stale-deploy recover waits out the cooldown', () => {
  assert.equal(shouldAttemptStaleRecover(1000, 0), true);
  assert.equal(shouldAttemptStaleRecover(1000, 999), false);
  assert.equal(shouldAttemptStaleRecover(1000 + STALE_RECOVER_COOLDOWN_MS, 1000), true);
});
