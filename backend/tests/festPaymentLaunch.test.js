const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeFestCompetitionDraft,
  draftToResponses,
} = require('../src/utils/festCompetitionDraft');
const {
  shouldReuseMappedStatus,
  shouldInvalidateCashfreeLookupError,
} = require('../src/utils/paymentOrderIdempotency');
const {
  createCashfreeOrder,
  mapOrderStatus,
  firstValidCustomerPhone,
  normalizePhone,
  normalizeCashfreeReturnUrl,
  resetCashfreeAccountCircuitBreaker,
} = require('../src/services/cashfreeService');
const axios = require('axios');
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

test('missing Cashfree orders are invalidated but temporary gateway errors are reusable', () => {
  assert.equal(shouldInvalidateCashfreeLookupError({ response: { status: 404 } }), true);
  assert.equal(shouldInvalidateCashfreeLookupError({ response: { status: 503 } }), false);
  assert.equal(shouldInvalidateCashfreeLookupError(new Error('network')), false);
});

test('Cashfree returns directly to canonical www without an apex redirect', () => {
  assert.equal(
    normalizeCashfreeReturnUrl('https://crwdctrl.in/payment/return?order_id={order_id}'),
    'https://www.crwdctrl.in/payment/return?order_id={order_id}',
  );
  assert.equal(
    normalizeCashfreeReturnUrl('https://crwdctrl.in/mindspark/bundle-pay/abc?returned=1'),
    'https://www.crwdctrl.in/mindspark/bundle-pay/abc?returned=1',
  );
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
      referred_by: 'Tanvi Sharma',
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
  assert.equal(draft.formData.referred_by, 'Tanvi Sharma');
  assert.equal(draft.formData.photo, undefined);
  assert.equal(draft.couponCode, 'SPARK');

  const responses = draftToResponses(draft);
  assert.equal(responses.team_name, 'Ctrl');
  assert.equal(responses.team_members[1].name, 'Bharat');
  assert.equal(responses.referred_by, 'Tanvi Sharma');
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

  const solo = resolveCompetitionTicketPrice(
    { feeTiers: [{ id: 'ug', label: 'UG students', amount: 300 }] },
    '',
  );
  assert.equal(solo.ticketPrice, 300);
  assert.equal(solo.tier.id, 'ug');
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

test('Cashfree order creation retries one 400 with a compact customer payload', async () => {
  const originalPost = axios.post;
  const originalId = process.env.CASHFREE_CLIENT_ID;
  const originalSecret = process.env.CASHFREE_CLIENT_SECRET;
  const calls = [];
  process.env.CASHFREE_CLIENT_ID = 'test-client';
  process.env.CASHFREE_CLIENT_SECRET = 'test-secret';
  axios.post = async (_url, payload) => {
    calls.push(payload);
    if (calls.length === 1) {
      const error = new Error('bad request');
      error.response = { status: 400, data: { message: 'invalid optional field' } };
      throw error;
    }
    return { data: { order_id: payload.order_id, payment_session_id: 'session-ok' } };
  };
  try {
    resetCashfreeAccountCircuitBreaker();
    const order = await createCashfreeOrder({
      orderAmount: 174,
      customerDetails: {
        customerId: 'user-1',
        customerName: 'Test 🚀 User',
        customerEmail: 'TEST@example.com',
        customerPhone: '9876543210',
      },
      orderNote: 'optional note',
      orderTags: { bundleId: 'bundle-1' },
    });
    assert.equal(order.payment_session_id, 'session-ok');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].customer_details, {
      customer_id: 'user-1',
      customer_phone: '9876543210',
    });
    assert.equal(calls[1].order_meta, undefined);
    assert.equal(calls[1].order_note, undefined);
    assert.equal(calls[1].order_tags, undefined);
  } finally {
    resetCashfreeAccountCircuitBreaker();
    axios.post = originalPost;
    if (originalId === undefined) delete process.env.CASHFREE_CLIENT_ID;
    else process.env.CASHFREE_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.CASHFREE_CLIENT_SECRET;
    else process.env.CASHFREE_CLIENT_SECRET = originalSecret;
  }
});

test('Cashfree account-disabled response skips payload retry and opens a short circuit', async () => {
  const originalPost = axios.post;
  const originalId = process.env.CASHFREE_CLIENT_ID;
  const originalSecret = process.env.CASHFREE_CLIENT_SECRET;
  let calls = 0;
  process.env.CASHFREE_CLIENT_ID = 'test-client';
  process.env.CASHFREE_CLIENT_SECRET = 'test-secret';
  resetCashfreeAccountCircuitBreaker();
  axios.post = async () => {
    calls += 1;
    const error = new Error('disabled');
    error.response = {
      status: 400,
      data: { code: 'request_failed', message: 'transactions are not enabled for your payment gateway account' },
    };
    throw error;
  };
  try {
    await assert.rejects(
      createCashfreeOrder({
        orderAmount: 100,
        customerDetails: { customerId: 'user-1', customerPhone: '9876543210' },
      }),
      (error) => error.code === 'CASHFREE_ACCOUNT_DISABLED'
        && error.status === 503
        && /No money was charged/i.test(error.message),
    );
    assert.equal(calls, 1);

    await assert.rejects(
      createCashfreeOrder({
        orderAmount: 100,
        customerDetails: { customerId: 'user-2', customerPhone: '9876543210' },
      }),
      (error) => error.code === 'CASHFREE_ACCOUNT_DISABLED',
    );
    assert.equal(calls, 1);
  } finally {
    resetCashfreeAccountCircuitBreaker();
    axios.post = originalPost;
    if (originalId === undefined) delete process.env.CASHFREE_CLIENT_ID;
    else process.env.CASHFREE_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.CASHFREE_CLIENT_SECRET;
    else process.env.CASHFREE_CLIENT_SECRET = originalSecret;
  }
});
