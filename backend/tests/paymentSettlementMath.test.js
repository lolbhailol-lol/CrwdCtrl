const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyBucket,
  computeFinancials,
  derivePayoutStatus,
  settlementStatusOf,
  settlementDateOf,
  linkOrdersToRegistrations,
  summarizeRows,
  isCashfreeGateway,
  BUCKET_MINDSPARK,
  BUCKET_TOUCH_GRASS,
  BUCKET_OTHER,
} = require('../src/services/paymentSettlementMath');

test('classifies Mindspark by fest id, not amount', () => {
  assert.equal(classifyBucket({ festId: '6a7f1010ed26d983b34e55c2', entityType: 'fest' }), BUCKET_MINDSPARK);
  assert.equal(classifyBucket({
    festId: '6a7f1010ed26d983b34e55c2',
    entityType: 'sports',
    eventTitle: 'Touch Grass 05',
  }), BUCKET_MINDSPARK);
});

test('classifies Touch Grass by slug/title on sports entities', () => {
  assert.equal(classifyBucket({
    entityType: 'sports',
    eventTitle: 'Touch Grass 05',
    eventSlug: 'touch-grass-5',
  }), BUCKET_TOUCH_GRASS);
  assert.equal(classifyBucket({
    entityType: 'sports',
    clubName: 'TouchGrass',
  }), BUCKET_TOUCH_GRASS);
  assert.equal(classifyBucket({
    entityType: 'fest',
    eventTitle: 'Touch Grass 05',
  }), BUCKET_OTHER);
});

test('other events stay in the other bucket', () => {
  assert.equal(classifyBucket({ entityType: 'trek', eventTitle: 'Rajmachi' }), BUCKET_OTHER);
  assert.equal(classifyBucket({ entityType: 'fest', festId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }), BUCKET_OTHER);
});

test('1.6 percent fee and refund netting', () => {
  const full = computeFinancials(199, 0);
  assert.equal(full.fee, 3.18);
  assert.equal(full.organizerPayable, 195.82);
  const refunded = computeFinancials(199, 199);
  assert.equal(refunded.netGross, 0);
  assert.equal(refunded.fee, 0);
  assert.equal(refunded.organizerPayable, 0);
  const partial = computeFinancials(200, 50);
  assert.equal(partial.netGross, 150);
  assert.equal(partial.fee, 2.4);
  assert.equal(partial.organizerPayable, 147.6);
});

test('payout derivation: unknown settlement pending, settled ready, paid sticks', () => {
  assert.equal(derivePayoutStatus({}), 'pending');
  assert.equal(derivePayoutStatus({ settlement: null }), 'pending');
  assert.equal(derivePayoutStatus({ settlement: { cfSettlementId: 's1' } }), 'ready');
  assert.equal(derivePayoutStatus({
    settlement: { cfSettlementId: 's1' },
    payoutOverride: { status: 'paid' },
  }), 'paid');
  assert.equal(derivePayoutStatus({
    settlement: null,
    payoutOverride: { status: 'paid' },
  }), 'paid');
});

test('settlement status and date are unknown unless Cashfree provided them', () => {
  assert.equal(settlementStatusOf(null), 'pending');
  assert.equal(settlementDateOf(null), null);
  assert.equal(settlementDateOf({}), null);
  assert.equal(settlementDateOf({ transferTime: 'not-a-date' }), null);
  assert.equal(settlementStatusOf({ status: 'SUCCESS' }), 'success');
  assert.equal(settlementStatusOf({ status: 'PENDING' }), 'pending');
  assert.equal(settlementStatusOf({ cfSettlementId: '612' }), 'success');
  assert.ok(settlementDateOf({ transferTime: '2026-08-01T10:00:00+05:30' }));
});

test('links by order id / payment id and never by amount', () => {
  const orders = [
    { orderId: 'order_aaa', paymentId: 'pay_1', totalAmount: 199 },
    { orderId: 'order_bbb', paymentId: 'pay_2', totalAmount: 199 },
    { orderId: 'order_ccc', paymentId: 'pay_3', totalAmount: 150 },
  ];
  const registrations = [
    { id: 'r1', payment_order_id: 'order_aaa', payment_id: 'pay_1', amountPaid: 199 },
    { id: 'r2', payment_order_id: 'order_zzz', payment_id: 'pay_2', amountPaid: 199 },
    { id: 'r-unrelated', payment_order_id: 'order_other', payment_id: 'pay_9', amountPaid: 150 },
  ];
  const { rows } = linkOrdersToRegistrations(orders, registrations);
  const aaa = rows.filter((row) => row.order?.orderId === 'order_aaa');
  assert.equal(aaa.length, 1);
  assert.equal(aaa[0].registration.id, 'r1');
  const bbb = rows.find((row) => row.order?.orderId === 'order_bbb');
  assert.equal(bbb.registration.id, 'r2');
  const ccc = rows.find((row) => row.order?.orderId === 'order_ccc');
  assert.equal(ccc.unmatched, true);
  assert.equal(ccc.registration, null);
  const amountOnly = rows.filter((row) => row.registration?.id === 'r-unrelated' && row.order?.orderId === 'order_ccc');
  assert.equal(amountOnly.length, 0);
});

test('duplicate registrations for the same order id are flagged', () => {
  const { rows, duplicateOrderIds } = linkOrdersToRegistrations(
    [{ orderId: 'order_dup', paymentId: 'p1' }],
    [
      { id: 'a', payment_order_id: 'order_dup' },
      { id: 'b', payment_order_id: 'order_dup' },
    ],
  );
  assert.deepEqual(duplicateOrderIds, ['order_dup']);
  assert.equal(rows.filter((row) => row.duplicate).length, 2);
});

test('razorpay gateway is excluded from Cashfree dashboard', () => {
  assert.equal(isCashfreeGateway('razorpay'), false);
  assert.equal(isCashfreeGateway('organizer_qr'), false);
  assert.equal(isCashfreeGateway('cashfree'), true);
  assert.equal(isCashfreeGateway(null), true);
});

test('summary totals use backend-computed fee rows', () => {
  const money = computeFinancials(199, 0);
  const summary = summarizeRows([
    {
      bucket: BUCKET_MINDSPARK,
      eventId: 'fest1',
      eventName: 'Mindspark',
      organizerType: 'fest',
      organizerId: 'fest1',
      organizerName: 'Mindspark',
      unmatched: false,
      ...money,
      settlementStatus: 'unknown',
      payoutStatus: 'pending',
    },
  ], { paidPayoutAmount: 10 });
  assert.equal(summary.totals.totalCollected, 199);
  assert.equal(summary.totals.crwdctrlFee, 3.18);
  assert.equal(summary.totals.organizerPayable, 195.82);
  assert.equal(summary.totals.settlementPending, 195.82);
  assert.equal(summary.totals.alreadyPaid, 0);
  assert.equal(summary.totals.alreadyPaidCount, 0);

  const paidSummary = summarizeRows([
    {
      bucket: BUCKET_MINDSPARK,
      eventId: 'fest1',
      eventName: 'Mindspark',
      organizerType: 'fest',
      organizerId: 'fest1',
      organizerName: 'Mindspark',
      unmatched: false,
      ...money,
      settlementStatus: 'unknown',
      payoutStatus: 'paid',
      schedule: { stage: 'paid' },
    },
  ]);
  assert.equal(paidSummary.totals.alreadyPaidCount, 1);
  assert.equal(paidSummary.totals.alreadyPaid, 195.82);
  assert.equal(paidSummary.buckets[0].alreadyPaidCount, 1);
  assert.equal(paidSummary.buckets[0].alreadyPaid, 195.82);
  assert.equal(summary.buckets[0].registrations, 1);
  assert.equal(summary.buckets[1].registrations, 0);
  assert.equal(summary.buckets.length, 2);
  assert.equal(summary.buckets[0].id, BUCKET_MINDSPARK);
  assert.equal(summary.buckets[1].id, BUCKET_TOUCH_GRASS);
});

test('T+2 bank date and Mindspark Monday clear for last Mon-Sun', () => {
  const {
    expectedBankYmd,
    weekMondayYmd,
    weekSundayYmd,
    weekClearMondayYmd,
    mindsparkClearMondayYmd,
    scheduleForPayment,
    buildDashboardSchedule,
  } = require('../src/services/paymentSettlementMath');

  // Cashfree T+2 = bank working days (skip Sat/Sun + India bank holidays)
  assert.equal(expectedBankYmd('2026-08-19'), '2026-08-21'); // Wed → Fri
  assert.equal(expectedBankYmd('2026-08-21'), '2026-08-25'); // Fri → Tue
  assert.equal(expectedBankYmd('2026-08-22'), '2026-08-25'); // Sat → Tue
  assert.equal(expectedBankYmd('2026-08-23'), '2026-08-25'); // Sun → Tue
  assert.equal(expectedBankYmd('2026-08-24'), '2026-08-27'); // Mon → Thu (Wed 26 is Ganesh Chaturthi)
  assert.equal(weekMondayYmd('2026-08-19'), '2026-08-17');
  assert.equal(weekSundayYmd('2026-08-19'), '2026-08-23');
  assert.equal(weekClearMondayYmd('2026-08-19'), '2026-08-24');
  assert.equal(mindsparkClearMondayYmd('2026-08-19'), '2026-08-24');
  assert.equal(mindsparkClearMondayYmd('2026-08-23'), '2026-08-31');
  assert.equal(mindsparkClearMondayYmd('2026-08-24'), '2026-08-31');

  const wed = scheduleForPayment({
    createdAt: '2026-08-19T11:00:00+05:30',
    bucket: BUCKET_MINDSPARK,
  }, new Date('2026-08-24T10:00:00+05:30'));
  assert.equal(wed.expectedBankYmd, '2026-08-21');
  assert.equal(wed.clearMondayYmd, '2026-08-24');
  assert.equal(wed.stage, 'due_monday');

  const sunday = scheduleForPayment({
    createdAt: '2026-08-23T18:00:00+05:30',
    bucket: BUCKET_MINDSPARK,
  }, new Date('2026-08-24T10:00:00+05:30'));
  assert.equal(sunday.expectedBankYmd, '2026-08-25');
  assert.equal(sunday.clearMondayYmd, '2026-08-31');
  assert.equal(sunday.stage, 'waiting_t2');

  const friday = scheduleForPayment({
    createdAt: '2026-08-21T12:00:00+05:30',
    bucket: BUCKET_MINDSPARK,
  }, new Date('2026-08-24T10:00:00+05:30'));
  assert.equal(friday.expectedBankYmd, '2026-08-25');
  assert.equal(friday.clearMondayYmd, '2026-08-31');
  assert.equal(friday.stage, 'waiting_t2');

  const summary = buildDashboardSchedule([
    { bucket: BUCKET_MINDSPARK, netGross: 199, organizerPayable: 195.82, schedule: wed },
    { bucket: BUCKET_MINDSPARK, netGross: 119, organizerPayable: 117.1, schedule: sunday },
  ], new Date('2026-08-24T10:00:00+05:30'));
  assert.equal(summary.mindspark.thisMondayClear.payments, 1);
  assert.equal(summary.mindspark.nextMondayClear.payments, 1);
  assert.equal(summary.tPlusDays, 2);
});

test('T+2 skips India bank holidays as well as weekends', () => {
  const {
    expectedBankYmd,
    addWorkingDaysYmd,
    isNonWorkingBankDay,
  } = require('../src/services/paymentSettlementMath');
  const { isIndiaBankHoliday } = require('../src/utils/indiaBankHolidays');

  assert.equal(isIndiaBankHoliday('2026-01-26'), true); // Republic Day (Mon)
  assert.equal(isNonWorkingBankDay('2026-01-26'), true);
  assert.equal(isNonWorkingBankDay('2026-01-24'), true); // Sat
  assert.equal(isNonWorkingBankDay('2026-01-27'), false); // Tue

  // Fri 23 Jan 2026 → skip Sat/Sun + Mon holiday → Wed 28 Jan (T+2)
  assert.equal(expectedBankYmd('2026-01-23'), '2026-01-28');
  // Thu 14 Aug 2025 → skip Independence Day + Parsi New Year + Sun → Tue 19 Aug
  assert.equal(addWorkingDaysYmd('2025-08-14', 2), '2025-08-19');
});

test('dashboard scope is only Mindspark and Touch Grass', () => {
  const { isInScopeBucket, isDashboardRow } = require('../src/services/paymentSettlementMath');
  assert.equal(isInScopeBucket(BUCKET_MINDSPARK), true);
  assert.equal(isInScopeBucket(BUCKET_TOUCH_GRASS), true);
  assert.equal(isInScopeBucket(BUCKET_OTHER), false);
  assert.equal(isDashboardRow({
    bucket: BUCKET_OTHER,
    unmatched: false,
    amountPaid: 499,
    paymentStatus: 'paid',
  }), false);
});

test('dummy and test payments are excluded from the dashboard', () => {
  const { isDummyOrTestPayment, isDashboardRow } = require('../src/services/paymentSettlementMath');
  assert.equal(isDummyOrTestPayment({ amountPaid: 2, paymentStatus: 'paid' }), true);
  assert.equal(isDummyOrTestPayment({ amountPaid: 4, email: 'srishtipatil06@gmail.com' }), true);
  assert.equal(isDummyOrTestPayment({ amountPaid: 529, email: 'srishtipatil06@gmail.com' }), false);
  assert.equal(isDummyOrTestPayment({ amountPaid: 499, email: 'crwdctrl.testing@gmail.com' }), true);
  assert.equal(isDummyOrTestPayment({ amountPaid: 199, email: 'test@example.com' }), true);
  assert.equal(isDummyOrTestPayment({ amountPaid: 249, email: 'jadhavkaran911@gmail.com' }), false);
  assert.equal(isDummyOrTestPayment({ amountPaid: 499, registrationStatus: 'cancelled' }), true);
  assert.equal(isDummyOrTestPayment({ amountPaid: 199, manual: true }), true);
  assert.equal(isDashboardRow({
    bucket: BUCKET_TOUCH_GRASS,
    unmatched: false,
    amountPaid: 2,
    paymentStatus: 'paid',
  }), false);
  assert.equal(isDashboardRow({
    bucket: BUCKET_TOUCH_GRASS,
    unmatched: false,
    amountPaid: 529,
    paymentStatus: 'paid',
  }), true);
  assert.equal(isDashboardRow({
    bucket: BUCKET_MINDSPARK,
    unmatched: true,
    amountPaid: 199,
    paymentStatus: 'PAID',
  }), false);
});

test('batch mark-paid ledger marks matching transactions as paid', () => {
  const {
    buildBatchPaidLedger,
    findBatchPaidPayout,
    applyOrganizerPaidToSchedule,
    buildDashboardSchedule,
    scheduleForPayment,
  } = require('../src/services/paymentSettlementMath');

  const ledger = buildBatchPaidLedger([
    {
      status: 'paid',
      bucket: BUCKET_MINDSPARK,
      batchKind: 'monday_clear',
      clearMondayYmd: '2026-08-24',
      eventId: 'monday-clear-2026-08-24',
      orderIds: ['ord_ready_1'],
      paidAt: new Date('2026-08-24T10:00:00+05:30'),
    },
  ]);

  assert.equal(ledger.paidOrderIds.has('ord_ready_1'), true);
  assert.equal(ledger.paidClearMondays.has('2026-08-24'), true);

  const byOrder = findBatchPaidPayout(
    { orderId: 'ord_ready_1', bucket: BUCKET_MINDSPARK },
    ledger,
    { stage: 'due_monday', clearMondayYmd: '2026-08-24' },
  );
  assert.ok(byOrder);
  const paidSchedule = applyOrganizerPaidToSchedule(
    { stage: 'due_monday', stageLabel: 'Monday clear due', clearMondayYmd: '2026-08-24' },
    byOrder,
  );
  assert.equal(paidSchedule.stage, 'paid');
  assert.equal(paidSchedule.stageLabel, 'Paid successfully');

  const waiting = findBatchPaidPayout(
    { orderId: 'ord_waiting', bucket: BUCKET_MINDSPARK },
    buildBatchPaidLedger([{
      status: 'paid',
      bucket: BUCKET_MINDSPARK,
      eventId: 'monday-clear-2026-08-24',
      orderIds: [],
    }]),
    { stage: 'waiting_t2', clearMondayYmd: '2026-08-24' },
  );
  assert.equal(waiting, null);

  const rows = [
    {
      bucket: BUCKET_MINDSPARK,
      netGross: 100,
      organizerPayable: 98.4,
      payoutStatus: 'paid',
      schedule: {
        ...scheduleForPayment({
          createdAt: new Date('2026-08-20T12:00:00+05:30'),
          bucket: BUCKET_MINDSPARK,
          settlementStatus: 'success',
        }, new Date('2026-08-24T12:00:00+05:30')),
        stage: 'paid',
        stageLabel: 'Paid successfully',
        clearMondayYmd: '2026-08-24',
      },
    },
  ];
  const dash = buildDashboardSchedule(rows, new Date('2026-08-24T12:00:00+05:30'));
  const clear = dash.mindspark.thisMondayClear;
  assert.equal(clear.paidCount, 1);
  assert.equal(clear.readyCount, 0);
  assert.equal(clear.paidPayable, 98.4);
  assert.equal(clear.readyPayable, 0);
});
