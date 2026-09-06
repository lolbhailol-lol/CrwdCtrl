const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeSportsFormDraft, mergeSportsFormResponses } = require('../src/utils/sportsBookingDraft');
const { canonicalRunClubId, pickOperationalResponses } = require('../src/utils/runClubPiiCrypto');

test('sports form draft keeps gender drink and level', () => {
  const draft = sanitizeSportsFormDraft({
    gender: 'Female',
    post_game_fuel_at_cafe_bok: 'Lemon Iced tea',
    badminton_level: 'Beginner – Learning the game',
    full_name: 'Ada',
    email: 'ada@example.com',
  }, { customerPhone: '9999999999' });

  assert.equal(draft.gender, 'Female');
  assert.equal(draft.post_game_fuel_at_cafe_bok, 'Lemon Iced tea');
  assert.equal(draft.badminton_level, 'Beginner – Learning the game');
  assert.equal(draft.contact_no, undefined);
});

test('sports form draft keeps a real customer phone', () => {
  const draft = sanitizeSportsFormDraft({
    gender: 'Female',
    full_name: 'Ada',
    email: 'ada@example.com',
  }, { customerPhone: '9370974074' });
  assert.equal(draft.contact_no, '9370974074');
});

test('client form answers win over stored payment draft', () => {
  const merged = mergeSportsFormResponses(
    { gender: 'Male' },
    { gender: 'Female', badminton_level: 'Amateur – Play casually with friends' },
  );
  assert.equal(merged.gender, 'Male');
  assert.equal(merged.badminton_level, 'Amateur – Play casually with friends');
});

test('canonical run club id is a 24-char hex', () => {
  assert.equal(canonicalRunClubId('6a8341b5be222d0e6b2a9dc4'), '6a8341b5be222d0e6b2a9dc4');
  assert.equal(
    canonicalRunClubId({ _id: '6a8341b5be222d0e6b2a9dc4' }),
    '6a8341b5be222d0e6b2a9dc4',
  );
});

test('plaintext responses keep cafe and badminton answers', () => {
  const kept = pickOperationalResponses({
    full_name: 'Ada',
    email: 'ada@example.com',
    contact_no: '9999999999',
    gender: 'Female',
    post_game_fuel_at_cafe_bok: 'Lemon Iced tea',
    badminton_level: 'Beginner – Learning the game',
    people: 1,
  });
  assert.equal(kept.full_name, undefined);
  assert.equal(kept.email, undefined);
  assert.equal(kept.gender, 'Female');
  assert.equal(kept.post_game_fuel_at_cafe_bok, 'Lemon Iced tea');
  assert.equal(kept.badminton_level, 'Beginner – Learning the game');
});
