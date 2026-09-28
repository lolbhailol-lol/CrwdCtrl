'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmailBatcher, isRateLimitError } = require('../src/utils/emailBatcher');

test('email batcher groups a burst into provider batches of at most 100', async () => {
  const batches = [];
  const batcher = createEmailBatcher({
    sendBatch: async (messages) => {
      batches.push(messages);
      return { data: messages.map((_, index) => ({ id: `email-${index}` })) };
    },
    flushDelayMs: 0,
    minIntervalMs: 0,
  });

  const results = await Promise.all(
    Array.from({ length: 205 }, (_, index) => batcher.enqueue({ to: `student-${index}@example.com` })),
  );

  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 5]);
  assert.equal(results.length, 205);
  assert.ok(results.every((result) => result.success));
});

test('email batcher retries a rate-limited provider batch', async () => {
  let attempts = 0;
  const batcher = createEmailBatcher({
    sendBatch: async (messages) => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('Too many requests');
        error.statusCode = 429;
        throw error;
      }
      return { data: messages.map(() => ({ id: 'sent' })) };
    },
    flushDelayMs: 0,
    minIntervalMs: 0,
    retryBackoffMs: 0,
  });

  const result = await batcher.enqueue({ to: 'student@example.com' });
  assert.equal(attempts, 2);
  assert.equal(result.success, true);
});

test('rate-limit detection recognizes provider status and message', () => {
  assert.equal(isRateLimitError({ statusCode: 429 }), true);
  assert.equal(isRateLimitError(new Error('Rate limit exceeded')), true);
  assert.equal(isRateLimitError(new Error('Invalid recipient')), false);
});
