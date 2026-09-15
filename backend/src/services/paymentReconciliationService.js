'use strict';

const { Readable } = require('stream');
const csvParser = require('csv-parser');
const { round2 } = require('../utils/cashfreeGatewayFee');
const { normalizeSettlementPayload, normalizeRefundPayload, upsertSettlement, upsertRefund } = require('./cashfreeSettlementSync');

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[^a-z0-9]+/g, '_');
}

function pickField(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function parseAmount(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? round2(n) : null;
}

function mapCashfreeCsvRow(raw) {
  const row = {};
  for (const [key, value] of Object.entries(raw || {})) {
    row[normalizeHeader(key)] = value;
  }
  const orderId = pickField(row, ['order_id', 'cf_order_id', 'merchant_order_id', 'orderid']);
  const paymentId = pickField(row, ['cf_payment_id', 'payment_id', 'cfpaymentid', 'paymentid']);
  const amount = parseAmount(pickField(row, [
    'order_amount',
    'payment_amount',
    'amount',
    'transaction_amount',
    'orderamount',
  ]));
  return {
    orderId,
    paymentId,
    amount,
    paymentStatus: pickField(row, ['payment_status', 'order_status', 'status']),
    cfSettlementId: pickField(row, ['cf_settlement_id', 'settlement_id']),
    transferTime: pickField(row, ['transfer_time', 'settlement_date', 'settlement_time']),
    transferUtr: pickField(row, ['transfer_utr', 'utr']),
    refundId: pickField(row, ['cf_refund_id', 'refund_id']),
    refundAmount: parseAmount(pickField(row, ['refund_amount', 'refunded_amount'])),
    raw: row,
  };
}

function parseCsvBuffer(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(text)
      .pipe(csvParser({ mapHeaders: ({ header }) => normalizeHeader(header) }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows.map(mapCashfreeCsvRow)))
      .on('error', reject);
  });
}

function idKey(row) {
  const orderId = String(row.orderId || '').trim();
  const paymentId = String(row.paymentId || '').trim();
  if (orderId) return `order:${orderId}`;
  if (paymentId) return `pay:${paymentId}`;
  return '';
}

function findCrwdctrlMatch(cashfreeRow, byOrderId, byPaymentId) {
  if (cashfreeRow.orderId && byOrderId.has(cashfreeRow.orderId)) {
    return byOrderId.get(cashfreeRow.orderId);
  }
  if (cashfreeRow.paymentId && byPaymentId.has(cashfreeRow.paymentId)) {
    return byPaymentId.get(cashfreeRow.paymentId);
  }
  return null;
}

function amountsEqual(a, b) {
  if (a == null || b == null) return false;
  return round2(a) === round2(b);
}

/**
 * Match Cashfree CSV rows to CrwdCtrl payments by orderId / paymentId only.
 */
function reconcileCashfreeRows(crwdctrlPayments = [], cashfreeRows = []) {
  const byOrderId = new Map();
  const byPaymentId = new Map();
  const crwdctrlDupKeys = new Set();

  const indexPayment = (payment, map, key) => {
    const k = String(key || '').trim();
    if (!k) return;
    if (map.has(k)) crwdctrlDupKeys.add(k);
    const list = map.get(k) || [];
    list.push(payment);
    map.set(k, list);
  };

  for (const payment of crwdctrlPayments) {
    indexPayment(payment, byOrderId, payment.orderId);
    indexPayment(payment, byPaymentId, payment.paymentId);
  }

  const cashfreeSeen = new Map();
  const matchedKeys = new Set();
  const resultRows = [];

  const push = (kind, extra) => {
    resultRows.push({
      kind,
      orderId: extra.orderId || '',
      paymentId: extra.paymentId || '',
      cashfreeAmount: extra.cashfreeAmount ?? null,
      crwdctrlAmount: extra.crwdctrlAmount ?? null,
      paymentStatus: extra.paymentStatus || '',
      note: extra.note || '',
    });
  };

  cashfreeRows.forEach((row, idx) => {
    const key = idKey(row);
    if (!key) {
      push('unmatched_cashfree', {
        ...row,
        cashfreeAmount: row.amount,
        note: `CSV row ${idx + 1} has no order_id or payment_id`,
      });
      return;
    }
    const seen = cashfreeSeen.get(key) || [];
    seen.push(row);
    cashfreeSeen.set(key, seen);
  });

  for (const [key, group] of cashfreeSeen.entries()) {
    if (group.length > 1) {
      for (const row of group) {
        push('duplicate', {
          orderId: row.orderId,
          paymentId: row.paymentId,
          cashfreeAmount: row.amount,
          paymentStatus: row.paymentStatus,
          note: 'Duplicate Cashfree CSV row for the same order/payment id',
        });
      }
      continue;
    }
    const row = group[0];
    const matches = findCrwdctrlMatch(row, byOrderId, byPaymentId);
    if (!matches || !matches.length) {
      if (group.length === 1) {
        push('unmatched_cashfree', {
          orderId: row.orderId,
          paymentId: row.paymentId,
          cashfreeAmount: row.amount,
          paymentStatus: row.paymentStatus,
          note: 'No CrwdCtrl payment for this Cashfree id',
        });
      }
      continue;
    }
    const payment = matches[0];
    const crwdKey = idKey(payment);
    if (crwdKey) matchedKeys.add(crwdKey);
    if (matches.length > 1) {
      push('duplicate', {
        orderId: payment.orderId || row.orderId,
        paymentId: payment.paymentId || row.paymentId,
        cashfreeAmount: row.amount,
        crwdctrlAmount: round2(payment.netGross ?? payment.gross ?? payment.amountPaid),
        paymentStatus: payment.paymentStatus,
        note: 'Multiple CrwdCtrl registrations share this Cashfree id',
      });
      continue;
    }
    const crwdAmount = round2(payment.netGross ?? payment.gross ?? payment.amountPaid ?? payment.totalAmount);
    if (row.amount != null && !amountsEqual(row.amount, crwdAmount)) {
      push('amount_mismatch', {
        orderId: payment.orderId || row.orderId,
        paymentId: payment.paymentId || row.paymentId,
        cashfreeAmount: row.amount,
        crwdctrlAmount: crwdAmount,
        paymentStatus: row.paymentStatus || payment.paymentStatus,
        note: 'Order/payment id matched but amounts differ',
      });
      continue;
    }
    push('matched', {
      orderId: payment.orderId || row.orderId,
      paymentId: payment.paymentId || row.paymentId,
      cashfreeAmount: row.amount,
      crwdctrlAmount: crwdAmount,
      paymentStatus: row.paymentStatus || payment.paymentStatus,
    });
  }

  for (const payment of crwdctrlPayments) {
    const key = idKey(payment);
    if (key && matchedKeys.has(key)) continue;
    if (payment.paymentId && crwdctrlDupKeys.has(payment.paymentId) && matchedKeys.has(`pay:${payment.paymentId}`)) {
      continue;
    }
    push('unmatched_crwdctrl', {
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      crwdctrlAmount: round2(payment.netGross ?? payment.gross ?? payment.amountPaid ?? payment.totalAmount),
      paymentStatus: payment.paymentStatus,
      note: 'Successful CrwdCtrl Cashfree payment not present in this Cashfree file',
    });
  }

  const counts = {
    matchedCount: 0,
    unmatchedCashfreeCount: 0,
    unmatchedCrwdctrlCount: 0,
    amountMismatchCount: 0,
    duplicateCount: 0,
  };
  for (const row of resultRows) {
    if (row.kind === 'matched') counts.matchedCount += 1;
    else if (row.kind === 'unmatched_cashfree') counts.unmatchedCashfreeCount += 1;
    else if (row.kind === 'unmatched_crwdctrl') counts.unmatchedCrwdctrlCount += 1;
    else if (row.kind === 'amount_mismatch') counts.amountMismatchCount += 1;
    else if (row.kind === 'duplicate') counts.duplicateCount += 1;
  }

  return {
    rowCount: cashfreeRows.length,
    ...counts,
    rows: resultRows,
  };
}

async function persistCsvFinanceExtras(cashfreeRows, actor) {
  for (const row of cashfreeRows) {
    if (row.cfSettlementId || row.transferTime) {
      const normalized = normalizeSettlementPayload({
        order_id: row.orderId,
        cf_payment_id: row.paymentId,
        cf_settlement_id: row.cfSettlementId,
        transfer_time: row.transferTime,
        transfer_utr: row.transferUtr,
        settlement_amount: row.amount,
      }, { orderId: row.orderId });
      if (normalized && !normalized.empty) {
        await upsertSettlement({
          normalized,
          source: 'csv',
          raw: row.raw,
          actor,
        });
      }
    }
    if (row.refundId && row.refundAmount) {
      const normalized = normalizeRefundPayload({
        order_id: row.orderId,
        cf_refund_id: row.refundId,
        cf_payment_id: row.paymentId,
        refund_amount: row.refundAmount,
        refund_status: 'SUCCESS',
      }, { orderId: row.orderId });
      if (normalized) {
        await upsertRefund({
          normalized,
          source: 'csv',
          raw: row.raw,
          actor,
        });
      }
    }
  }
}

module.exports = {
  normalizeHeader,
  mapCashfreeCsvRow,
  parseCsvBuffer,
  reconcileCashfreeRows,
  persistCsvFinanceExtras,
  amountsEqual,
};
