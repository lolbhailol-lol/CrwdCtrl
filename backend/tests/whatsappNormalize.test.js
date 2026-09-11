const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeWhatsAppTo } = require('../src/services/whatsappService');

test('normalizeWhatsAppTo adds India country code for 10-digit numbers', () => {
  assert.equal(normalizeWhatsAppTo('7276276424'), '917276276424');
  assert.equal(normalizeWhatsAppTo('72762 76424'), '917276276424');
  assert.equal(normalizeWhatsAppTo('+91 7276276424'), '917276276424');
});

test('normalizeWhatsAppTo rejects empty or too-short values', () => {
  assert.equal(normalizeWhatsAppTo(''), null);
  assert.equal(normalizeWhatsAppTo('12345'), null);
  assert.equal(normalizeWhatsAppTo(null), null);
});
