'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAuditoriumRushRequest } = require('../src/middleware/rateLimiter');

test('auditorium GET and POST requests bypass the shared campus-IP limiter', () => {
  assert.equal(isAuditoriumRushRequest({ method: 'GET', path: '/mindspark/auditorium/meta' }), true);
  assert.equal(isAuditoriumRushRequest({ method: 'POST', path: '/mindspark/auditorium/request-otp' }), true);
  assert.equal(isAuditoriumRushRequest({ method: 'POST', path: '/mindspark/auditorium/upload-signature' }), true);
  assert.equal(isAuditoriumRushRequest({ method: 'POST', path: '/mindspark/auditorium/register' }), true);
  assert.equal(isAuditoriumRushRequest({ method: 'POST', path: '/payment/order' }), false);
});
