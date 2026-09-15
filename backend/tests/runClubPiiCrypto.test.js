const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-run-club-pii';

const {
  encryptRegistrationPii,
  decryptRegistrationPii,
  persistMergedRegistrationResponses,
} = require('../src/utils/runClubPiiCrypto');

const CLUB_ID = '6a8341b5be222d0e6b2a9dc4';

function asDoc(fields) {
  return {
    ...fields,
    set(next) {
      Object.assign(this, next);
    },
  };
}

test('failed decrypt does not replace responses cipher when saving form answers', () => {
  const originalCipher = 'not-a-valid-cipher';
  const screenshotCipher = 'keep-screenshot-cipher';
  const txCipher = 'keep-tx-cipher';
  const tokens = ['keep-search-token'];
  const reg = asDoc({
    piiEncrypted: true,
    responsesCipher: originalCipher,
    paymentScreenshotCipher: screenshotCipher,
    transactionIdCipher: txCipher,
    piiSearchTokens: tokens,
    paymentScreenshotUrl: '',
    transactionId: '',
    responses: { gender: 'Female', people: 1 },
  });

  const result = persistMergedRegistrationResponses(reg, {
    gender: 'Female',
    people: 1,
    cafe_drink: 'Iced Latte',
    badminton_level: 'Amateur – Play casually with friends',
    full_name: 'Should Not Be Ciphered',
  }, CLUB_ID);

  assert.equal(result.mode, 'plaintext-ops-only');
  assert.equal(result.responsesOk, false);
  assert.equal(reg.responsesCipher, originalCipher);
  assert.equal(reg.paymentScreenshotCipher, screenshotCipher);
  assert.equal(reg.transactionIdCipher, txCipher);
  assert.deepEqual(reg.piiSearchTokens, tokens);
  assert.equal(reg.responses.cafe_drink, 'Iced Latte');
  assert.equal(reg.responses.badminton_level, 'Amateur – Play casually with friends');
  assert.equal(reg.responses.full_name, undefined);
});

test('successful decrypt re-encrypts full payload including new form answers', () => {
  const seeded = encryptRegistrationPii({
    responses: {
      full_name: 'Ava Shah',
      email: 'ava@example.com',
      contact_no: '9876543210',
      gender: 'Female',
      people: 1,
    },
    paymentScreenshotUrl: 'https://cdn.example/proof.png',
    transactionId: 'UTR123',
    runClubId: CLUB_ID,
  });
  const originalCipher = seeded.responsesCipher;
  const reg = asDoc(seeded);

  const result = persistMergedRegistrationResponses(reg, {
    full_name: 'Ava Shah',
    email: 'ava@example.com',
    contact_no: '9876543210',
    gender: 'Female',
    people: 1,
    cafe_drink: 'Iced Latte',
  }, CLUB_ID);

  assert.equal(result.mode, 'reencrypt');
  assert.notEqual(reg.responsesCipher, originalCipher);
  const plain = decryptRegistrationPii(reg, CLUB_ID);
  assert.equal(plain.responses.full_name, 'Ava Shah');
  assert.equal(plain.responses.cafe_drink, 'Iced Latte');
  assert.equal(plain.paymentScreenshotUrl, 'https://cdn.example/proof.png');
  assert.equal(plain.transactionId, 'UTR123');
});
