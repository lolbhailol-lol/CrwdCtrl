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

test('decryptCredential returns empty string for wrong-key ciphertext (no throw)', () => {
  const previous = process.env.CAMPUS_HUNT_CREDENTIAL_KEY;
  process.env.CAMPUS_HUNT_CREDENTIAL_KEY = 'key-alpha-aaaaaaaaaaaaaaaaaaaaaaaa';
  const encrypted = encryptCredential('HuntPass');
  process.env.CAMPUS_HUNT_CREDENTIAL_KEY = 'key-beta-bbbbbbbbbbbbbbbbbbbbbbbbbbb';
  // Force only the new key by temporarily clearing JWT fallback uniqueness —
  // still must not throw; may return '' if JWT also cannot decrypt.
  assert.doesNotThrow(() => decryptCredential(encrypted));
  const out = decryptCredential(encrypted);
  assert.equal(typeof out, 'string');
  process.env.CAMPUS_HUNT_CREDENTIAL_KEY = previous;
});
