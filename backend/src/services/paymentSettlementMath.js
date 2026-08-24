'use strict';

const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');
const { cashfreeGatewayFee, round2 } = require('../utils/cashfreeGatewayFee');
const { isIndiaBankHoliday } = require('../utils/indiaBankHolidays');

const BUCKET_MINDSPARK = 'mindspark';
const BUCKET_TOUCH_GRASS = 'touch_grass';
const BUCKET_OTHER = 'other';

const DASHBOARD_BUCKETS = [BUCKET_MINDSPARK, BUCKET_TOUCH_GRASS];

const TOUCH_GRASS_RE = /touch[-]?grass/i;
/** Live ticket prices start at ₹59+. Sub-₹20 Cashfree charges are checkout tests. */
const TEST_PAYMENT_AMOUNT_MAX = 20;

const BUCKET_LABELS = {
  [BUCKET_MINDSPARK]: 'Mindspark',
  [BUCKET_TOUCH_GRASS]: 'Touch Grass',
  [BUCKET_OTHER]: 'Other events',
};

/**
 * Settlement cadence per dashboard event.
 * Add a new bucket here (+ DASHBOARD_BUCKETS + classifyBucket) for future events.
 * - monday_clear: Mindspark only — weekly Mon–Sun collection, clear on following Monday (after T+2)
 * - t_plus: Touch Grass (and similar) — Cashfree T+2 only, NO weekly Monday clear
 */
const EVENT_POLICIES = {
  [BUCKET_MINDSPARK]: {
    id: BUCKET_MINDSPARK,
    label: BUCKET_LABELS[BUCKET_MINDSPARK],
    cadence: 'monday_clear',
  },
  [BUCKET_TOUCH_GRASS]: {
    id: BUCKET_TOUCH_GRASS,
    label: BUCKET_LABELS[BUCKET_TOUCH_GRASS],
    cadence: 't_plus', // never monday_clear
  },
};

function getEventPolicy(bucket) {
  return EVENT_POLICIES[bucket] || null;
}

/** Weekly Monday clear is Mindspark-only. Touch Grass never uses this. */
function usesMondayClear(bucket) {
  return bucket === BUCKET_MINDSPARK && getEventPolicy(bucket)?.cadence === 'monday_clear';
}

function usesTPlusOnly(bucket) {
  return getEventPolicy(bucket)?.cadence === 't_plus';
}

function isDashboardBucket(bucket) {
  return DASHBOARD_BUCKETS.includes(bucket);
}

function isCashfreeGateway(gateway) {
  const g = String(gateway || 'cashfree').trim().toLowerCase();
  if (g === 'razorpay' || g === 'organizer_qr' || g === 'manual_organizer') return false;
  return g === 'cashfree' || g === '';
}

function isTouchGrassText(...parts) {
  return parts.some((part) => TOUCH_GRASS_RE.test(String(part || '')));
}

function isInScopeBucket(bucket) {
  return isDashboardBucket(bucket);
}

function isInternalTestEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  if (/@(crwdctrl\.com|example\.com)$/i.test(e)) return true;
  if (/@crwdctrl\./i.test(e)) return true;
  if (/^(test|dummy|fake|demo)([+._-]|$)/i.test(e.split('@')[0] || '')) return true;
  if (/crwdctrl\.(testing|in)@/i.test(e)) return true;
  return false;
}

function isManualFlag(responses) {
  const raw = responses && typeof responses === 'object'
    ? (responses instanceof Map ? Object.fromEntries(responses) : responses)
    : {};
  return /^(yes|true|1)$/i.test(String(raw.manual_entry || raw.added_by_organizer || ''));
}

function isDummyOrTestPayment(row = {}) {
  if (row.manual || row.isManual) return true;
  const regStatus = String(row.registrationStatus || row.status || '').toLowerCase();
  if (['cancelled', 'canceled', 'failed', 'rejected'].includes(regStatus)) return true;
  const payStatus = String(row.paymentStatus || '').toLowerCase();
  if (payStatus === 'failed' || payStatus === 'free') return true;
  if (isInternalTestEmail(row.email || row.customerEmail || row.guestEmail)) return true;
  const amount = Number(row.amountPaid ?? row.netGross ?? row.gross ?? row.totalAmount ?? 0);
  if (amount > 0 && amount < TEST_PAYMENT_AMOUNT_MAX) return true;
  return false;
}

function isDashboardRow(row = {}) {
  if (!isInScopeBucket(row.bucket)) return false;
  if (row.unmatched) return false;
  if (isDummyOrTestPayment(row)) return false;
  return true;
}

function classifyBucket({
  festId,
  entityType,
  eventTitle,
  eventSlug,
  clubName,
  clubSlug,
} = {}) {
  if (isMindSparkFestId(festId)) return BUCKET_MINDSPARK;
  const sportsLike = ['sports', 'event'].includes(String(entityType || ''));
  if (sportsLike && isTouchGrassText(eventTitle, eventSlug, clubName, clubSlug)) {
    return BUCKET_TOUCH_GRASS;
  }
  return BUCKET_OTHER;
}

function computeFinancials(gross, refunded = 0) {
  const g = round2(gross);
  const r = round2(refunded);
  const netGross = round2(Math.max(0, g - r));
  const fee = cashfreeGatewayFee(netGross);
  const organizerPayable = round2(netGross - fee);
  return { gross: g, refunded: r, netGross, fee, organizerPayable };
}

function cashfreeSettlementRawStatus(settlement) {
  if (!settlement || typeof settlement !== 'object') return '';
  return String(settlement.status || settlement.settlementStatus || '').trim().toUpperCase();
}

function settlementStatusOf(settlement) {
  const raw = cashfreeSettlementRawStatus(settlement);
  if (raw === 'SUCCESS' || raw === 'SETTLED') return 'success';
  if (raw === 'FAILED') return 'failed';
  if (raw.includes('PENDING') || raw === 'NOT_FOUND') return 'pending';
  if (!settlement || typeof settlement !== 'object') return 'pending';
  const id = String(settlement.cfSettlementId || settlement.cf_settlement_id || '').trim();
  const transfer = settlement.transferTime || settlement.transfer_time || null;
  if (id || transfer) return 'success';
  return 'pending';
}

function hasCashfreeSettlement(settlement) {
  return settlementStatusOf(settlement) === 'success';
}

function settlementDateOf(settlement) {
  const raw = settlement?.transferTime
    || settlement?.transfer_time
    || settlement?.settlement_processed_on
    || settlement?.settlementProcessedOn
    || null;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const T_PLUS_DAYS = 2;
const IST_TZ = 'Asia/Kolkata';

function istDateString(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ }).format(d);
}

function addDaysYmd(ymd, days) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return next.toISOString().slice(0, 10);
}

function ymdWeekdayUtc(ymd) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 Sun … 6 Sat
}

function isWeekendYmd(ymd) {
  const day = ymdWeekdayUtc(ymd);
  return day === 0 || day === 6;
}

function isNonWorkingBankDay(ymd) {
  return isWeekendYmd(ymd) || isIndiaBankHoliday(ymd);
}

/**
 * Cashfree standard settlement: T+N bank working days.
 * Sat/Sun and listed India bank holidays are skipped.
 */
function addWorkingDaysYmd(ymd, workingDays) {
  let cursor = String(ymd || '');
  let left = Math.max(0, Number(workingDays) || 0);
  if (!cursor || !left) return cursor;
  while (left > 0) {
    cursor = addDaysYmd(cursor, 1);
    if (!isNonWorkingBankDay(cursor)) left -= 1;
  }
  return cursor;
}

function ymdToIstIso(ymd) {
  if (!ymd) return null;
  return `${ymd}T00:00:00+05:30`;
}

function mondayIndex(ymd) {
  const utcDay = ymdWeekdayUtc(ymd);
  return utcDay === 0 ? 6 : utcDay - 1;
}

function weekMondayYmd(ymd) {
  return addDaysYmd(ymd, -mondayIndex(ymd));
}

function weekSundayYmd(ymd) {
  return addDaysYmd(weekMondayYmd(ymd), 6);
}

/** Expected CrwdCtrl bank credit per Cashfree T+2 working days. */
function expectedBankYmd(paidYmd) {
  return addWorkingDaysYmd(paidYmd, T_PLUS_DAYS);
}

/** Monday after that payment's Mon–Sun week. */
function weekClearMondayYmd(paidYmd) {
  return addDaysYmd(weekSundayYmd(paidYmd), 1);
}

/**
 * Mindspark clears last Mon–Sun every Monday, but only after T+2 is in the bank.
 * Sunday payments therefore slip to the following Monday.
 */
function mindsparkClearMondayYmd(paidYmd) {
  let clear = weekClearMondayYmd(paidYmd);
  const bank = expectedBankYmd(paidYmd);
  while (clear && bank && clear < bank) {
    clear = addDaysYmd(clear, 7);
  }
  return clear;
}

function compareYmd(a, b) {
  if (!a || !b) return 0;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function scheduleForPayment({ createdAt, bucket, settlementStatus } = {}, now = new Date()) {
  const paidYmd = istDateString(createdAt);
  if (!paidYmd) {
    return {
      paidOn: null,
      expectedBankOn: null,
      weekStart: null,
      weekEnd: null,
      clearMonday: null,
      stage: 'pending',
      stageLabel: 'Pending',
      cashfreeConfirmed: settlementStatus === 'success',
    };
  }
  const nowYmd = istDateString(now);
  const bankYmd = expectedBankYmd(paidYmd);
  const weekStart = weekMondayYmd(paidYmd);
  const weekEnd = weekSundayYmd(paidYmd);
  const mondayClear = usesMondayClear(bucket);
  const clearMonday = mondayClear ? mindsparkClearMondayYmd(paidYmd) : null;
  const confirmed = settlementStatus === 'success';
  const bankReached = compareYmd(nowYmd, bankYmd) >= 0;

  let stage = 'waiting_t2';
  let stageLabel = 'Waiting T+2';
  if (mondayClear) {
    if (!bankReached && !confirmed) {
      stage = 'waiting_t2';
      stageLabel = 'Waiting T+2';
    } else if (clearMonday && compareYmd(nowYmd, clearMonday) < 0) {
      stage = 'waiting_monday';
      stageLabel = 'Expected in bank · Monday clear';
    } else {
      stage = 'due_monday';
      stageLabel = 'Monday clear due';
    }
  } else if (confirmed || bankReached) {
    stage = confirmed ? 'in_bank' : 'expected_in_bank';
    stageLabel = confirmed ? 'In bank' : 'Expected in bank';
  }

  return {
    paidOn: ymdToIstIso(paidYmd),
    expectedBankOn: ymdToIstIso(bankYmd),
    weekStart: ymdToIstIso(weekStart),
    weekEnd: ymdToIstIso(weekEnd),
    clearMonday: clearMonday ? ymdToIstIso(clearMonday) : null,
    paidYmd,
    expectedBankYmd: bankYmd,
    weekStartYmd: weekStart,
    weekEndYmd: weekEnd,
    clearMondayYmd: clearMonday,
    stage,
    stageLabel,
    cashfreeConfirmed: confirmed,
    tPlusDays: T_PLUS_DAYS,
    tPlusNote: 'Cashfree T+2 bank working days (Sat/Sun + India bank holidays skipped)',
  };
}

function emptyClearBucket(clearMondayYmd, weekStartYmd, weekEndYmd) {
  return {
    clearMonday: ymdToIstIso(clearMondayYmd),
    clearMondayYmd,
    weekStart: ymdToIstIso(weekStartYmd),
    weekEnd: ymdToIstIso(weekEndYmd),
    weekStartYmd,
    weekEndYmd,
    payments: 0,
    gross: 0,
    payable: 0,
    waitingT2Payable: 0,
    waitingT2Count: 0,
    readyPayable: 0,
    readyCount: 0,
    paidPayable: 0,
    paidCount: 0,
  };
}

function emptyTPlusBucket() {
  return {
    payments: 0,
    payable: 0,
    waitingT2Payable: 0,
    waitingT2Count: 0,
    expectedInBankPayable: 0,
    expectedInBankCount: 0,
    paidPayable: 0,
    paidCount: 0,
  };
}

function parseMondayClearEventId(eventId) {
  const m = String(eventId || '').trim().match(/^monday-clear-(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : '';
}

/**
 * Batch "Mark paid" ledger → which payment rows should show Paid successfully.
 * Prefer explicit orderIds; fall back to Monday-clear date for older ledger docs.
 */
function buildBatchPaidLedger(payouts = []) {
  const paidOrderIds = new Map(); // orderId -> payout
  const paidClearMondays = new Map(); // clearYmd -> payout
  const paidTPlusBuckets = new Set(); // bucket marked via legacy tplus-ready-* without orderIds

  for (const payout of payouts) {
    if (String(payout?.status || '').toLowerCase() !== 'paid') continue;
    const orderIds = Array.isArray(payout.orderIds) ? payout.orderIds : [];
    for (const orderId of orderIds) {
      const id = String(orderId || '').trim();
      if (id) paidOrderIds.set(id, payout);
    }

    const clearYmd = String(payout.clearMondayYmd || parseMondayClearEventId(payout.eventId) || '').trim();
    if (clearYmd && (payout.bucket === BUCKET_MINDSPARK || payout.batchKind === 'monday_clear')) {
      paidClearMondays.set(clearYmd, payout);
    }

    const eventId = String(payout.eventId || '');
    if (
      !orderIds.length
      && !clearYmd
      && payout.bucket === BUCKET_TOUCH_GRASS
      && /^tplus-ready-/.test(eventId)
    ) {
      paidTPlusBuckets.add(BUCKET_TOUCH_GRASS);
    }
  }

  return { paidOrderIds, paidClearMondays, paidTPlusBuckets };
}

function findBatchPaidPayout(row, ledger, schedule) {
  if (!ledger || !row) return null;
  const orderId = String(row.orderId || '').trim();
  if (orderId && ledger.paidOrderIds?.has(orderId)) {
    return ledger.paidOrderIds.get(orderId);
  }

  const clearYmd = String(schedule?.clearMondayYmd || row.schedule?.clearMondayYmd || '').trim();
  const stage = String(schedule?.stage || row.schedule?.stage || '');
  if (
    clearYmd
    && ledger.paidClearMondays?.has(clearYmd)
    && stage
    && stage !== 'waiting_t2'
    && stage !== 'paid'
  ) {
    return ledger.paidClearMondays.get(clearYmd);
  }
  // Legacy TG mark-paid without stored orderIds: treat all non-waiting rows as paid.
  if (
    row.bucket === BUCKET_TOUCH_GRASS
    && ledger.paidTPlusBuckets?.has(BUCKET_TOUCH_GRASS)
    && stage
    && stage !== 'waiting_t2'
  ) {
    return { status: 'paid', batchKind: 'tplus_ready' };
  }
  return null;
}

function applyOrganizerPaidToSchedule(schedule, payout) {
  if (!schedule) return schedule;
  const paidAt = payout?.paidAt || null;
  return {
    ...schedule,
    stage: 'paid',
    stageLabel: 'Paid successfully',
    organizerPaid: true,
    organizerPaidAt: paidAt || null,
  };
}

function buildDashboardSchedule(rows = [], now = new Date()) {
  const nowYmd = istDateString(now);
  const thisMonday = weekMondayYmd(nowYmd);
  const lastMonday = addDaysYmd(thisMonday, -7);
  const lastSunday = addDaysYmd(thisMonday, -1);
  const thisSunday = addDaysYmd(thisMonday, 6);
  const nextMonday = addDaysYmd(thisMonday, 7);

  const mondayClearsByBucket = new Map();
  const tPlusByBucket = new Map();

  for (const id of DASHBOARD_BUCKETS) {
    const policy = EVENT_POLICIES[id];
    if (!policy) continue;
    if (policy.cadence === 'monday_clear') mondayClearsByBucket.set(id, new Map());
    if (policy.cadence === 't_plus') tPlusByBucket.set(id, emptyTPlusBucket());
  }

  for (const row of rows) {
    const schedule = row.schedule || scheduleForPayment(row, now);
    const bucketId = row.bucket;
    if (!isDashboardBucket(bucketId)) continue;

    if (usesMondayClear(bucketId) && schedule.clearMondayYmd) {
      const clears = mondayClearsByBucket.get(bucketId);
      if (!clears.has(schedule.clearMondayYmd)) {
        clears.set(
          schedule.clearMondayYmd,
          emptyClearBucket(schedule.clearMondayYmd, schedule.weekStartYmd, schedule.weekEndYmd),
        );
      }
      const clear = clears.get(schedule.clearMondayYmd);
      clear.payments += 1;
      clear.gross = round2(clear.gross + (Number(row.netGross) || 0));
      clear.payable = round2(clear.payable + (Number(row.organizerPayable) || 0));
      if (schedule.stage === 'waiting_t2') {
        clear.waitingT2Payable = round2(clear.waitingT2Payable + (Number(row.organizerPayable) || 0));
        clear.waitingT2Count += 1;
      } else if (schedule.stage === 'paid' || row.payoutStatus === 'paid') {
        clear.paidPayable = round2(clear.paidPayable + (Number(row.organizerPayable) || 0));
        clear.paidCount += 1;
      } else {
        clear.readyPayable = round2(clear.readyPayable + (Number(row.organizerPayable) || 0));
        clear.readyCount += 1;
      }
    } else if (usesTPlusOnly(bucketId)) {
      const tg = tPlusByBucket.get(bucketId);
      tg.payments += 1;
      tg.payable = round2(tg.payable + (Number(row.organizerPayable) || 0));
      if (schedule.stage === 'waiting_t2') {
        tg.waitingT2Payable = round2(tg.waitingT2Payable + (Number(row.organizerPayable) || 0));
        tg.waitingT2Count += 1;
      } else if (schedule.stage === 'paid' || row.payoutStatus === 'paid') {
        tg.paidPayable = round2(tg.paidPayable + (Number(row.organizerPayable) || 0));
        tg.paidCount += 1;
      } else {
        tg.expectedInBankPayable = round2(tg.expectedInBankPayable + (Number(row.organizerPayable) || 0));
        tg.expectedInBankCount += 1;
      }
    }
  }

  const events = DASHBOARD_BUCKETS.map((id) => {
    const policy = EVENT_POLICIES[id];
    if (policy.cadence === 'monday_clear') {
      const clears = mondayClearsByBucket.get(id) || new Map();
      const thisMondayClear = {
        ...(clears.get(thisMonday) || emptyClearBucket(thisMonday, lastMonday, lastSunday)),
        weekStart: ymdToIstIso(lastMonday),
        weekEnd: ymdToIstIso(lastSunday),
        weekStartYmd: lastMonday,
        weekEndYmd: lastSunday,
        clearMonday: ymdToIstIso(thisMonday),
        clearMondayYmd: thisMonday,
      };
      const nextMondayClear = {
        ...(clears.get(nextMonday) || emptyClearBucket(nextMonday, thisMonday, thisSunday)),
        weekStart: ymdToIstIso(thisMonday),
        weekEnd: ymdToIstIso(thisSunday),
        weekStartYmd: thisMonday,
        weekEndYmd: thisSunday,
        clearMonday: ymdToIstIso(nextMonday),
        clearMondayYmd: nextMonday,
      };
      return {
        id,
        label: policy.label,
        cadence: policy.cadence,
        thisMondayClear,
        nextMondayClear,
        upcoming: [...clears.values()]
          .filter((row) => compareYmd(row.clearMondayYmd, thisMonday) >= 0)
          .sort((a, b) => compareYmd(a.clearMondayYmd, b.clearMondayYmd)),
      };
    }
    return {
      id,
      label: policy.label,
      cadence: policy.cadence,
      ...(tPlusByBucket.get(id) || emptyTPlusBucket()),
    };
  });

  const mindspark = events.find((row) => row.id === BUCKET_MINDSPARK) || null;
  const touchGrass = events.find((row) => row.id === BUCKET_TOUCH_GRASS) || emptyTPlusBucket();

  return {
    today: ymdToIstIso(nowYmd),
    todayYmd: nowYmd,
    tPlusDays: T_PLUS_DAYS,
    timezone: IST_TZ,
    tPlusNote: 'Cashfree T+2 bank working days (Sat/Sun + India bank holidays skipped)',
    events,
    policies: DASHBOARD_BUCKETS.map((id) => EVENT_POLICIES[id]),
    // Legacy keys kept for older clients / tests
    mindspark: mindspark
      ? {
        thisMondayClear: mindspark.thisMondayClear,
        nextMondayClear: mindspark.nextMondayClear,
        upcoming: mindspark.upcoming,
      }
      : null,
    touchGrass,
  };
}

function payoutOverrideKey({ organizerType, organizerId, eventId, bucket }) {
  return `${organizerType || 'unknown'}|${organizerId || ''}|${eventId || ''}|${bucket || BUCKET_OTHER}`;
}

function derivePayoutStatus({ settlement, payoutOverride } = {}) {
  const overrideStatus = typeof payoutOverride === 'string'
    ? payoutOverride
    : payoutOverride?.status;
  if (overrideStatus === 'paid') return 'paid';
  if (overrideStatus === 'ready') return 'ready';
  if (hasCashfreeSettlement(settlement)) return 'ready';
  return 'pending';
}

function addToIndex(map, key, value) {
  const k = String(key || '').trim();
  if (!k) return;
  const list = map.get(k) || [];
  list.push(value);
  map.set(k, list);
}

function buildPaymentIndex(registrations = []) {
  const byOrderId = new Map();
  const byPaymentId = new Map();
  for (const reg of registrations) {
    addToIndex(byOrderId, reg.payment_order_id || reg.orderId, reg);
    addToIndex(byPaymentId, reg.payment_id || reg.paymentId, reg);
  }
  return { byOrderId, byPaymentId };
}

/**
 * Link a Cashfree order to registrations by orderId / paymentId only.
 * Amount is never used as a match key.
 */
function linkOrderToRegistrations(order, index) {
  const seen = new Set();
  const matches = [];
  const push = (reg) => {
    const id = String(reg.id || reg._id || `${reg.payment_order_id}:${reg.kind}`);
    if (seen.has(id)) return;
    seen.add(id);
    matches.push(reg);
  };

  const orderId = String(order?.orderId || '').trim();
  const paymentId = String(order?.paymentId || '').trim();
  if (orderId) {
    for (const reg of index.byOrderId.get(orderId) || []) push(reg);
  }
  if (paymentId) {
    for (const reg of index.byPaymentId.get(paymentId) || []) push(reg);
  }
  return matches;
}

function linkOrdersToRegistrations(orders = [], registrations = []) {
  const index = buildPaymentIndex(registrations);
  const linkedOrderIds = new Set();
  const linkedRegIds = new Set();
  const rows = [];
  const duplicateOrderIds = new Set();

  for (const order of orders) {
    const matches = linkOrderToRegistrations(order, index);
    if (matches.length > 1) duplicateOrderIds.add(String(order.orderId || ''));
    if (matches.length === 0) {
      rows.push({
        order,
        registration: null,
        unmatched: true,
        duplicate: false,
      });
      continue;
    }
    linkedOrderIds.add(String(order.orderId || ''));
    for (const registration of matches) {
      linkedRegIds.add(String(registration.id || registration._id || ''));
      rows.push({
        order,
        registration,
        unmatched: false,
        duplicate: matches.length > 1,
      });
    }
  }

  for (const registration of registrations) {
    const id = String(registration.id || registration._id || '');
    if (id && linkedRegIds.has(id)) continue;
    const paid = String(registration.paymentStatus || '').toLowerCase() === 'paid'
      || Number(registration.amountPaid) > 0;
    if (!paid) continue;
    const orderId = String(registration.payment_order_id || registration.orderId || '').trim();
    const paymentId = String(registration.payment_id || registration.paymentId || '').trim();
    if (!orderId && !paymentId) continue;
    rows.push({
      order: null,
      registration,
      unmatched: false,
      orphanRegistration: true,
      duplicate: false,
    });
  }

  return { rows, duplicateOrderIds: [...duplicateOrderIds].filter(Boolean) };
}

function emptyBucket(id) {
  return {
    id,
    name: BUCKET_LABELS[id],
    registrations: 0,
    successfulPayments: 0,
    unmatchedPayments: 0,
    gross: 0,
    refunded: 0,
    fee: 0,
    organizerPayable: 0,
    settlementPending: 0,
    readyForPayout: 0,
    alreadyPaid: 0,
    alreadyPaidCount: 0,
    settlementSuccess: 0,
    settlement: 'pending',
    payout: 'pending',
  };
}

function summarizeRows(rows = [], { paidPayoutAmount = 0, buckets: bucketIds = DASHBOARD_BUCKETS } = {}) {
  const totals = {
    totalCollected: 0,
    crwdctrlFee: 0,
    organizerPayable: 0,
    refunds: 0,
    successfulPayments: 0,
    unmatchedPayments: 0,
    settlementSuccess: 0,
    settlementPendingCount: 0,
    settlementFailed: 0,
    settlementPending: 0,
    readyForPayout: 0,
    alreadyPaid: 0,
    alreadyPaidCount: 0,
  };
  const buckets = {};
  for (const id of bucketIds) buckets[id] = emptyBucket(id);
  const events = new Map();
  const organizers = new Map();

  const bumpGroup = (map, key, seed, row) => {
    if (!map.has(key)) map.set(key, seed());
    const g = map.get(key);
    g.registrations += 1;
    g.gross = round2(g.gross + row.netGross);
    g.fee = round2(g.fee + row.fee);
    g.organizerPayable = round2(g.organizerPayable + row.organizerPayable);
    g.refunded = round2(g.refunded + row.refunded);
    g.settlementSuccess = (g.settlementSuccess || 0) + (row.settlementStatus === 'success' ? 1 : 0);
    const cleared = row.payoutStatus === 'paid' || row.schedule?.stage === 'paid';
    if (cleared) {
      g.alreadyPaid = round2(g.alreadyPaid + row.organizerPayable);
      g.alreadyPaidCount = (g.alreadyPaidCount || 0) + 1;
    } else if (row.payoutStatus === 'pending') {
      g.settlementPending = round2(g.settlementPending + row.organizerPayable);
    } else if (row.payoutStatus === 'ready') {
      g.readyForPayout = round2(g.readyForPayout + row.organizerPayable);
    }
    if (cleared) g.payout = 'paid';
    else if (row.payoutStatus === 'ready' && g.payout !== 'paid') g.payout = 'ready';
    else if (g.payout !== 'paid' && g.payout !== 'ready') g.payout = 'pending';
  };

  const finalizeSettlementLabel = (group) => {
    const total = Number(group.registrations) || 0;
    const success = Number(group.settlementSuccess) || 0;
    if (!total) group.settlement = 'pending';
    else if (success === total) group.settlement = 'success';
    else if (success > 0) group.settlement = 'partial';
    else group.settlement = 'pending';
  };

  for (const row of rows) {
    const bucketId = row.bucket || BUCKET_OTHER;
    const bucket = buckets[bucketId];
    if (!bucket) continue;
    totals.totalCollected = round2(totals.totalCollected + row.netGross);
    totals.crwdctrlFee = round2(totals.crwdctrlFee + row.fee);
    totals.organizerPayable = round2(totals.organizerPayable + row.organizerPayable);
    totals.refunds = round2(totals.refunds + row.refunded);
    totals.successfulPayments += 1;
    if (row.unmatched) totals.unmatchedPayments += 1;
    if (row.settlementStatus === 'success') totals.settlementSuccess += 1;
    else if (row.settlementStatus === 'failed') totals.settlementFailed += 1;
    else totals.settlementPendingCount += 1;

    bucket.registrations += 1;
    bucket.successfulPayments += 1;
    if (row.unmatched) bucket.unmatchedPayments += 1;
    if (row.settlementStatus === 'success') bucket.settlementSuccess += 1;
    bucket.gross = round2(bucket.gross + row.netGross);
    bucket.refunded = round2(bucket.refunded + row.refunded);
    bucket.fee = round2(bucket.fee + row.fee);
    bucket.organizerPayable = round2(bucket.organizerPayable + row.organizerPayable);

    const cleared = row.payoutStatus === 'paid' || row.schedule?.stage === 'paid';
    if (cleared) {
      bucket.alreadyPaid = round2(bucket.alreadyPaid + row.organizerPayable);
      bucket.alreadyPaidCount += 1;
      totals.alreadyPaid = round2(totals.alreadyPaid + row.organizerPayable);
      totals.alreadyPaidCount += 1;
    } else if (row.payoutStatus === 'pending') {
      totals.settlementPending = round2(totals.settlementPending + row.organizerPayable);
      bucket.settlementPending = round2(bucket.settlementPending + row.organizerPayable);
    } else if (row.payoutStatus === 'ready') {
      totals.readyForPayout = round2(totals.readyForPayout + row.organizerPayable);
      bucket.readyForPayout = round2(bucket.readyForPayout + row.organizerPayable);
    }

    if (cleared) bucket.payout = 'paid';
    else if (row.payoutStatus === 'ready' && bucket.payout !== 'paid') bucket.payout = 'ready';
    else if (bucket.payout !== 'paid' && bucket.payout !== 'ready') bucket.payout = 'pending';

    const eventKey = `${row.eventId || 'unknown'}|${row.eventName || 'Unknown event'}`;
    bumpGroup(events, eventKey, () => ({
      eventId: row.eventId || '',
      eventName: row.eventName || 'Unknown event',
      bucket: bucketId,
      organizerId: row.organizerId || '',
      organizerName: row.organizerName || '',
      registrations: 0,
      gross: 0,
      refunded: 0,
      fee: 0,
      organizerPayable: 0,
      settlementPending: 0,
      readyForPayout: 0,
      alreadyPaid: 0,
      alreadyPaidCount: 0,
      settlementSuccess: 0,
      settlement: 'pending',
      payout: 'pending',
    }), row);

    const orgKey = payoutOverrideKey(row);
    bumpGroup(organizers, orgKey, () => ({
      organizerType: row.organizerType || 'unknown',
      organizerId: row.organizerId || '',
      organizerName: row.organizerName || 'Unknown organizer',
      eventId: row.eventId || '',
      eventName: row.eventName || '',
      bucket: bucketId,
      registrations: 0,
      gross: 0,
      refunded: 0,
      fee: 0,
      organizerPayable: 0,
      settlementPending: 0,
      readyForPayout: 0,
      alreadyPaid: 0,
      alreadyPaidCount: 0,
      settlementSuccess: 0,
      settlement: 'pending',
      payout: 'pending',
    }), row);
  }

  for (const id of bucketIds) finalizeSettlementLabel(buckets[id]);
  for (const group of events.values()) finalizeSettlementLabel(group);
  for (const group of organizers.values()) finalizeSettlementLabel(group);

  return {
    totals,
    buckets: bucketIds.map((id) => buckets[id]),
    events: [...events.values()].sort((a, b) => b.gross - a.gross || a.eventName.localeCompare(b.eventName)),
    organizers: [...organizers.values()].sort((a, b) => b.organizerPayable - a.organizerPayable
      || a.organizerName.localeCompare(b.organizerName)),
  };
}

function idStr(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

module.exports = {
  BUCKET_MINDSPARK,
  BUCKET_TOUCH_GRASS,
  BUCKET_OTHER,
  DASHBOARD_BUCKETS,
  BUCKET_LABELS,
  EVENT_POLICIES,
  getEventPolicy,
  usesMondayClear,
  usesTPlusOnly,
  isDashboardBucket,
  TOUCH_GRASS_RE,
  TEST_PAYMENT_AMOUNT_MAX,
  isCashfreeGateway,
  isTouchGrassText,
  isInScopeBucket,
  isInternalTestEmail,
  isManualFlag,
  isDummyOrTestPayment,
  isDashboardRow,
  classifyBucket,
  computeFinancials,
  cashfreeSettlementRawStatus,
  hasCashfreeSettlement,
  settlementStatusOf,
  settlementDateOf,
  payoutOverrideKey,
  derivePayoutStatus,
  parseMondayClearEventId,
  buildBatchPaidLedger,
  findBatchPaidPayout,
  applyOrganizerPaidToSchedule,
  buildPaymentIndex,
  linkOrderToRegistrations,
  linkOrdersToRegistrations,
  emptyBucket,
  summarizeRows,
  idStr,
  T_PLUS_DAYS,
  istDateString,
  addDaysYmd,
  addWorkingDaysYmd,
  isWeekendYmd,
  isNonWorkingBankDay,
  weekMondayYmd,
  weekSundayYmd,
  expectedBankYmd,
  weekClearMondayYmd,
  mindsparkClearMondayYmd,
  scheduleForPayment,
  buildDashboardSchedule,
};
