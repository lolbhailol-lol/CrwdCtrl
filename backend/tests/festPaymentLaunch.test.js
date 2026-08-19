const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeFestCompetitionDraft,
  draftToResponses,
} = require('../src/utils/festCompetitionDraft');
const { shouldReuseMappedStatus } = require('../src/utils/paymentOrderIdempotency');
const { mapOrderStatus, firstValidCustomerPhone, normalizePhone } = require('../src/services/cashfreeService');
const { buildPaymentOrderNote } = require('../src/utils/paymentOrderNote');

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

const {
  GAME_OF_INNOVATION_FEE_TIERS,
  sanitizeCompetitionFeeTiers,
  resolveCompetitionTicketPrice,
  competitionRequiresPayment,
  formatCompetitionFeeFromLabel,
} = require('../src/utils/competitionFeeTiers');

test('Game of Innovation fee tiers resolve by selected category', () => {
  const competition = {
    feeAmount: 150,
    registrationFee: '₹150',
    feeTiers: GAME_OF_INNOVATION_FEE_TIERS,
  };
  assert.equal(competitionRequiresPayment(competition), true);
  assert.equal(formatCompetitionFeeFromLabel(competition.feeTiers), '₹150 · ₹300 · ₹500');

  const ug = resolveCompetitionTicketPrice(competition, 'ug');
  assert.equal(ug.ticketPrice, 300);
  assert.equal(ug.tier.label, 'UG students');

  const pg = resolveCompetitionTicketPrice(competition, 'pg_phd');
  assert.equal(pg.ticketPrice, 500);

  assert.throws(() => resolveCompetitionTicketPrice(competition, ''), /select a registration category/i);
  assert.throws(() => resolveCompetitionTicketPrice(competition, 'alumni'), /Invalid registration category/i);
});

test('competitions without feeTiers keep a single ticket price', () => {
  const priced = resolveCompetitionTicketPrice({ feeAmount: 199, registrationFee: '₹199' }, 'ug');
  assert.equal(priced.ticketPrice, 199);
  assert.equal(priced.tier, null);
  assert.deepEqual(sanitizeCompetitionFeeTiers(null), []);
});

test('Cashfree order note uses the competition name instead of a generic label', () => {
  assert.equal(
    buildPaymentOrderNote({ entityType: 'competition' }),
    'competition registration',
  );
  assert.equal(
    buildPaymentOrderNote({
      entityType: 'competition',
      notes: { competitionName: 'GAME OF INNOVATION' },
    }),
    'GAME OF INNOVATION registration',
  );
  assert.equal(
    buildPaymentOrderNote({
      entityType: 'competition',
      notes: { competitionName: 'GAME OF INNOVATION', tierName: 'UG students' },
    }),
    'GAME OF INNOVATION - UG students',
  );
  assert.equal(
    buildPaymentOrderNote({
      entityType: 'fest',
      notes: { festName: 'MindSpark' },
    }),
    'MindSpark registration',
  );
});

test('Cashfree customer phone uses the first real 10-digit number and dummies only as last resort', () => {
  assert.equal(firstValidCustomerPhone(['', '9876543210']), '9876543210');
  assert.equal(firstValidCustomerPhone(['+91 98765 43210']), '9876543210');
  assert.equal(firstValidCustomerPhone(['9999999999', '9876543210']), '9876543210');
  assert.equal(firstValidCustomerPhone(['123', null, undefined]), '');
  assert.equal(normalizePhone(''), '9999999999');
  assert.equal(normalizePhone('9876543210'), '9876543210');
  assert.equal(normalizePhone('9999999999'), '9999999999');
});
