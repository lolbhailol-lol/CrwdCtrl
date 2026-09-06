/**
 * In-process pub/sub for Campus Hunt team progress (SSE).
 * Single-instance fanout; clients fall back to HTTP poll if the channel drops.
 */
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

const HEARTBEAT_MS = 15000;

function teamKey(teamId) {
  return `team:${String(teamId || '')}`;
}

function publishTeamProgress(teamId, payload = {}) {
  const id = String(teamId || '');
  if (!id) return;
  bus.emit(teamKey(id), {
    type: 'progress',
    at: new Date().toISOString(),
    ...payload,
  });
}

function publishManyTeamProgress(teamIds, payload = {}) {
  (teamIds || []).forEach((id) => publishTeamProgress(id, payload));
}

/**
 * Attach an SSE client for a team. Returns a cleanup function.
 * @param {import('express').Response} res
 */
function subscribeTeamProgress(teamId, res) {
  const id = String(teamId || '');
  const key = teamKey(id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const writeEvent = (event, data) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* client gone */
    }
  };

  writeEvent('connected', { teamId: id, at: new Date().toISOString() });

  const onProgress = (payload) => writeEvent('progress', payload);
  bus.on(key, onProgress);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, HEARTBEAT_MS);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    bus.off(key, onProgress);
    try {
      res.end();
    } catch {
      /* already closed */
    }
  };

  res.on('close', cleanup);
  reqSafeOnClose(res, cleanup);

  return cleanup;
}

function reqSafeOnClose(res, cleanup) {
  const req = res.req;
  if (req && typeof req.on === 'function') {
    req.on('close', cleanup);
  }
}

module.exports = {
  publishTeamProgress,
  publishManyTeamProgress,
  subscribeTeamProgress,
};
