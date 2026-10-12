const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'intern-admin-test-secret';
const { getJwtSecret } = require('../src/config/jwtSecret');
const { collegePlatformAdminAuth } = require('../src/middleware/internAdminAccess');
const mainAdminAuth = require('../src/middleware/adminAuth');
const campusHuntAdminAuth = require('../src/modules/campus-hunt/middleware/adminAuth');
const { adminLogin, refreshAdminToken } = require('../src/controllers/adminAuthController');

const sign = (payload) => jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
const internToken = () => sign({ role: 'intern_admin', email: 'intern@crwdctrl.in' });

function run(middleware, { method = 'GET', path = '/', token } = {}) {
  return new Promise((resolve) => {
    const req = { method, path, params: {}, headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body, next: false }); return this; },
    };
    Promise.resolve(middleware(req, res, () => resolve({ status: 200, next: true, user: req.user }))).catch(() => {});
  });
}

function callController(handler, body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    handler({ body }, res);
  });
}

test('intern can run College Games admin but not move money', async () => {
  for (const [method, path] of [['GET', '/'], ['POST', '/games'], ['PUT', '/games/abc'], ['PUT', '/pre-registrations/abc'], ['POST', '/check-in'], ['POST', '/results']]) {
    assert.equal((await run(collegePlatformAdminAuth, { method, path, token: internToken() })).next, true, `${method} ${path}`);
  }
  for (const path of ['/hosted-games/g1/payout', '/hosted-games/g1/prizes', '/hosted-games/g1/emergency-stop', '/hosted-games/g1/clear-emergency-stop', '/hosted-games/g1/turnout-decision', '/refunds/r1/process', '/disputes/d1/resolve']) {
    const result = await run(collegePlatformAdminAuth, { method: 'POST', path, token: internToken() });
    assert.equal(result.status, 403, path);
  }
});

test('full admin keeps every College Games action; other roles are refused', async () => {
  assert.equal((await run(collegePlatformAdminAuth, { method: 'POST', path: '/hosted-games/g1/payout', token: sign({ role: 'admin', email: 'a@b.c' }) })).next, true);
  assert.equal((await run(collegePlatformAdminAuth, { token: sign({ role: 'campus_hunt_admin' }) })).status, 403);
  assert.equal((await run(collegePlatformAdminAuth, { token: sign({ role: 'intern_admin', type: 'refresh' }) })).status, 403);
  assert.equal((await run(collegePlatformAdminAuth, {})).status, 401);
});

test('intern token is refused by every other admin API', async () => {
  assert.equal((await run(mainAdminAuth, { token: internToken() })).status, 403);
});

test('intern operates Campus Hunt but cannot delete or reveal team credentials', async () => {
  assert.equal((await run(campusHuntAdminAuth, { method: 'POST', path: '/rounds/r1/start', token: internToken() })).next, true);
  assert.equal((await run(campusHuntAdminAuth, { method: 'GET', path: '/events', token: internToken() })).next, true);
  for (const [method, path] of [['DELETE', '/teams/t1'], ['POST', '/teams/t1/reveal-access'], ['GET', '/teams/t1/team-password'], ['POST', '/events/e1/prune-excess'], ['GET', '/users/lookup']]) {
    assert.equal((await run(campusHuntAdminAuth, { method, path, token: internToken() })).status, 403, `${method} ${path}`);
  }
});

test('intern login issues an intern token and refresh never upgrades it to admin', async () => {
  const saved = { ...process.env };
  process.env.ADMIN_EMAIL = 'owner@crwdctrl.in';
  process.env.INTERN_ADMIN_EMAIL = 'intern@crwdctrl.in';
  process.env.INTERN_ADMIN_PASSWORD_HASH = await bcrypt.hash('intern-pass', 4);
  try {
    const wrong = await callController(adminLogin, { email: 'intern@crwdctrl.in', password: 'nope' });
    assert.equal(wrong.status, 401);

    const login = await callController(adminLogin, { email: 'Intern@CrwdCtrl.in', password: 'intern-pass' });
    assert.equal(login.body.user.role, 'intern_admin');
    assert.equal(jwt.decode(login.body.accessToken).role, 'intern_admin');

    const refreshed = await callController(refreshAdminToken, { refreshToken: login.body.refreshToken });
    assert.equal(jwt.decode(refreshed.body.accessToken).role, 'intern_admin');

    const forged = jwt.sign({ role: 'admin', email: 'someone@else.com', type: 'refresh' }, getJwtSecret());
    assert.equal((await callController(refreshAdminToken, { refreshToken: forged })).status, 401);

    delete process.env.INTERN_ADMIN_EMAIL;
    assert.equal((await callController(refreshAdminToken, { refreshToken: login.body.refreshToken })).status, 401);
  } finally {
    process.env = saved;
  }
});
