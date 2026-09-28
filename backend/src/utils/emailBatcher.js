'use strict';

function isRateLimitError(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 429 || message.includes('rate limit') || message.includes('too many');
}

function createEmailBatcher({
  sendBatch,
  batchSize = 100,
  flushDelayMs = 25,
  minIntervalMs = 125,
  retryBackoffMs = 500,
  maxRetries = 3,
} = {}) {
  if (typeof sendBatch !== 'function') throw new TypeError('sendBatch is required');

  const queue = [];
  let flushTimer = null;
  let processing = false;
  let lastBatchStartedAt = 0;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

  async function processQueue() {
    if (processing) return;
    processing = true;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    try {
      while (queue.length > 0) {
        const entries = queue.splice(0, batchSize);
        const intervalWait = minIntervalMs - (Date.now() - lastBatchStartedAt);
        if (intervalWait > 0) await wait(intervalWait);

        try {
          lastBatchStartedAt = Date.now();
          const result = await sendBatch(entries.map((entry) => entry.payload));
          const ids = Array.isArray(result?.data) ? result.data : [];
          entries.forEach((entry, index) => entry.resolve({
            success: true,
            messageId: ids[index]?.id || null,
          }));
        } catch (error) {
          const retryable = isRateLimitError(error);
          const retryEntries = retryable
            ? entries.filter((entry) => entry.retries < maxRetries)
            : [];
          const failedEntries = retryable
            ? entries.filter((entry) => entry.retries >= maxRetries)
            : entries;

          failedEntries.forEach((entry) => entry.reject(error));
          if (retryEntries.length > 0) {
            retryEntries.forEach((entry) => { entry.retries += 1; });
            queue.unshift(...retryEntries);
            const retryNumber = Math.max(...retryEntries.map((entry) => entry.retries));
            await wait(retryBackoffMs * retryNumber);
          }
        }
      }
    } finally {
      processing = false;
      if (queue.length > 0 && !flushTimer) {
        flushTimer = setTimeout(processQueue, flushDelayMs);
      }
    }
  }

  function enqueue(payload) {
    return new Promise((resolve, reject) => {
      queue.push({ payload, resolve, reject, retries: 0 });
      if (queue.length >= batchSize) {
        void processQueue();
      } else if (!processing && !flushTimer) {
        flushTimer = setTimeout(processQueue, flushDelayMs);
      }
    });
  }

  return { enqueue };
}

module.exports = { createEmailBatcher, isRateLimitError };
