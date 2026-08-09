const test = require('node:test');
const assert = require('node:assert/strict');
const {
  encryptCredential,
  decryptCredential,
} = require('../../src/modules/campus-hunt/utils/credentialCipher');

test('Campus Hunt credentials are encrypted at rest and decrypt for admin reveal', () => {
  const plaintext = 'Leader-Secret-42';
  const encrypted = encryptCredential(plaintext);
  assert.match(encrypted, /^v1\./);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(decryptCredential(encrypted), plaintext);
});

test('credential cipher supports empty and legacy values during migration', () => {
  assert.equal(encryptCredential(''), '');
  assert.equal(decryptCredential(''), '');
  assert.equal(decryptCredential('legacy-plaintext'), 'legacy-plaintext');
});
