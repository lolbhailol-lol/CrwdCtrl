const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * We reload the middleware inside each test so `RECAPTCHA_SECRET_KEY` and
 * `NODE_ENV` env changes propagate. axios is mocked so the middleware never
 * hits Google.
 */
function loadMiddleware({ secret, nodeEnv, axiosImpl } = {}) {
  delete require.cache[require.resolve('../src/middleware/recaptcha')];
  delete require.cache[require.resolve('axios')];

  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalNode = process.env.NODE_ENV;

  process.env.RECAPTCHA_SECRET_KEY = secret ?? '';
  process.env.NODE_ENV = nodeEnv ?? 'development';

  // Stub axios by planting a lightweight module in the require cache.
  const axiosStub = axiosImpl || { post: async () => ({ data: { success: true, score: 0.9 } }) };
  require.cache[require.resolve('axios')] = {
    id: require.resolve('axios'),
    filename: require.resolve('axios'),
    loaded: true,
    exports: axiosStub,
  };

  const { verifyRecaptcha } = require('../src/middleware/recaptcha');
  return {
    verifyRecaptcha,
    restore() {
      process.env.RECAPTCHA_SECRET_KEY = originalSecret;
      process.env.NODE_ENV = originalNode;
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeReq(body) {
  return { body: body || {}, headers: {}, ip: '127.0.0.1' };
}

test('reCAPTCHA is a no-op when the secret is not configured', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({ secret: '', nodeEnv: 'production' });
  try {
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(res.body, null);
  } finally {
    restore();
  }
});

test('reCAPTCHA fails closed in production when token is missing', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({ secret: 'test-secret', nodeEnv: 'production' });
  try {
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'CAPTCHA_TOKEN_REQUIRED');
  } finally {
    restore();
  }
});

test('reCAPTCHA skips missing tokens in development to preserve local dev flow', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({ secret: 'test-secret', nodeEnv: 'development' });
  try {
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, true);
  } finally {
    restore();
  }
});

test('reCAPTCHA rejects low-score tokens with 429', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({
    secret: 'test-secret',
    nodeEnv: 'production',
    axiosImpl: {
      post: async () => ({ data: { success: true, score: 0.1, action: 'login' } }),
    },
  });
  try {
    const req = makeReq({ recaptchaToken: 'abc' });
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.code, 'CAPTCHA_LOW_SCORE');
  } finally {
    restore();
  }
});

test('reCAPTCHA rejects mismatched actions', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({
    secret: 'test-secret',
    nodeEnv: 'production',
    axiosImpl: {
      post: async () => ({ data: { success: true, score: 0.9, action: 'social_auth' } }),
    },
  });
  try {
    const req = makeReq({ recaptchaToken: 'abc' });
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'CAPTCHA_ACTION_MISMATCH');
  } finally {
    restore();
  }
});

test('reCAPTCHA allows requests with a valid high-score token and strips the token', async () => {
  const { verifyRecaptcha, restore } = loadMiddleware({
    secret: 'test-secret',
    nodeEnv: 'production',
    axiosImpl: {
      post: async () => ({ data: { success: true, score: 0.9, action: 'login' } }),
    },
  });
  try {
    const req = makeReq({ recaptchaToken: 'abc', email: 'a@example.com' });
    const res = makeRes();
    let called = false;
    await verifyRecaptcha('login')(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.body.recaptchaToken, undefined);
    assert.equal(req.body.email, 'a@example.com');
  } finally {
    restore();
  }
});
