import test from 'node:test';
import assert from 'node:assert/strict';
import { isMindSparkFest, MINDSPARK_FEST_ID } from '../src/features/fests/mindspark/isMindSparkFest.js';

test('MindSpark matches ObjectId and name/slug objects', () => {
  assert.equal(isMindSparkFest(MINDSPARK_FEST_ID), true);
  assert.equal(isMindSparkFest({ _id: MINDSPARK_FEST_ID }), true);
  assert.equal(isMindSparkFest({ festName: 'MindSpark 2026' }), true);
  assert.equal(isMindSparkFest({ slug: 'mindspark-2026' }), true);
});

test('MindSpark matches register-route slugs before fest JSON loads', () => {
  assert.equal(isMindSparkFest('mindspark'), true);
  assert.equal(isMindSparkFest('mindspark-2026'), true);
  assert.equal(isMindSparkFest('other-college-fest'), false);
  assert.equal(isMindSparkFest(''), false);
});
