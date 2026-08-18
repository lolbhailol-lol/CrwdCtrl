const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeFestCompetitionDraft,
  draftToResponses,
} = require('../src/utils/festCompetitionDraft');
const { shouldReuseMappedStatus } = require('../src/utils/paymentOrderIdempotency');
const { mapOrderStatus } = require('../src/services/cashfreeService');

test('mapOrderStatus treats user-dropped checkout as cancelled', () => {
  assert.equal(mapOrderStatus('USER_DROPPED'), 'cancelled');
  assert.equal(mapOrderStatus('CANCELLED'), 'cancelled');
  assert.equal(mapOrderStatus('EXPIRED'), 'cancelled');
  assert.equal(mapOrderStatus('ACTIVE'), 'pending');
  assert.equal(mapOrderStatus('PAID'), 'paid');
  assert.equal(mapOrderStatus('FAILED'), 'failed');
});

test('cancelled Cashfree sessions are not reused for a new Pay tap', () => {
  assert.equal(shouldReuseMappedStatus('cancelled'), false);
  assert.equal(shouldReuseMappedStatus('failed'), false);
  assert.equal(shouldReuseMappedStatus('pending'), true);
  assert.equal(shouldReuseMappedStatus('paid'), true);
});

test('sanitizeFestCompetitionDraft keeps MindSpark roster objects', () => {
  const draft = sanitizeFestCompetitionDraft({
    formData: {
      team_size: 2,
      team_name: 'Ctrl',
      team_members: [
        { name: 'Asha', email: 'a@example.com', phone: '9999999999' },
        { name: 'Bharat', email: 'b@example.com' },
      ],
      team_responses: { category: 'Open' },
      photo: { uploaded: true, fileName: 'id.png', ready: true },
      photo_file: {},
    },
    currentStep: 3,
    festId: 'fest1',
    competitionId: 'comp1',
    couponCode: 'spark',
  });

  assert.equal(draft.team_name, undefined);
  assert.equal(draft.formData.team_name, 'Ctrl');
  assert.equal(draft.formData.team_size, 2);
  assert.equal(draft.formData.team_members.length, 2);
  assert.equal(draft.formData.team_members[0].name, 'Asha');
  assert.equal(draft.formData.team_responses.category, 'Open');
  assert.equal(draft.formData.photo, undefined);
  assert.equal(draft.couponCode, 'SPARK');

  const responses = draftToResponses(draft);
  assert.equal(responses.team_name, 'Ctrl');
  assert.equal(responses.team_members[1].name, 'Bharat');
});

test('empty draft sanitizes to null', () => {
  assert.equal(sanitizeFestCompetitionDraft({ formData: { photo: { uploaded: true, fileName: 'id.png' } } }), null);
  assert.equal(sanitizeFestCompetitionDraft(null), null);
});
