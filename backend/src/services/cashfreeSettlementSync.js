'use strict';

const CashfreeSettlement = require('../model/cashfree_settlement_model');
const PaymentRefund = require('../model/payment_refund_model');
const PaymentOrder = require('../model/payment_order_model');
const PaymentAuditLog = require('../model/payment_audit_log_model');
const { fetchOrderSettlements } = require('./cashfreeService');
const { isCashfreeGateway } = require('./paymentSettlementMath');

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function parseDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const str = String(value).trim();
  if (!str || !/\d{4}/.test(str)) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickSettlementObject(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.settlements) && data.settlements[0]) return pickSettlementObject(data.settlements[0]);
  if (Array.isArray(data.data) && data.data[0]) return pickSettlementObject(data.data[0]);

  const orderDetails = data.order_details && typeof data.order_details === 'object' ? data.order_details : {};
  const paymentDetails = data.payment_details && typeof data.payment_details === 'object' ? data.payment_details : {};
  const nestedOrder = data.order && typeof data.order === 'object' ? data.order : {};
  const nestedSettlement = (data.settlement_details && typeof data.settlement_details === 'object')
    ? data.settlement_details
    : (data.settlement && typeof data.settlement === 'object' ? data.settlement : {});

  const merged = {
    ...data,
    ...nestedSettlement,
    order_id: firstNonEmpty(
      nestedSettlement.order_id,
      orderDetails.order_id,
      nestedOrder.order_id,
      data.order_id,
      data.orderId,
    ),
    cf_payment_id: firstNonEmpty(
      nestedSettlement.cf_payment_id,
      paymentDetails.cf_payment_id,
      data.cf_payment_id,
      data.cfPaymentId,
    ),
    settlement_amount: nestedSettlement.settlement_amount
      ?? paymentDetails.settlement_amount
      ?? data.settlement_amount
      ?? data.settlementAmount,
    service_charge: paymentDetails.pg_service_charge
      ?? nestedSettlement.service_charge
      ?? data.service_charge
      ?? data.serviceCharge,
    service_tax: paymentDetails.pg_service_tax
      ?? nestedSettlement.service_tax
      ?? data.service_tax
      ?? data.serviceTax,
    transfer_utr: firstNonEmpty(
      nestedSettlement.settlement_utr,
      nestedSettlement.transfer_utr,
      data.transfer_utr,
      data.transferUtr,
    ),
    transfer_time: nestedSettlement.settlement_processed_on
      || nestedSettlement.settlement_initiated_on
      || nestedSettlement.transfer_time
      || data.transfer_time
      || data.transferTime
      || data.settlement_processed_on
      || data.settlement_initiated_on,
    status: firstNonEmpty(
      nestedSettlement.status,
      data.status,
      data.settlement_status,
      data.settlementStatus,
    ),
    status_description: firstNonEmpty(
      nestedSettlement.status_description,
      data.status_description,
      data.statusDescription,
    ),
  };

  if (
    merged.cf_settlement_id
    || merged.cfSettlementId
    || merged.settlement_id
    || merged.transfer_time
    || merged.status
    || (merged.settlement_amount != null && merged.settlement_amount !== '')
    || String(merged.entity || '').toLowerCase() === 'settlement'
  ) {
    return merged;
  }
  return null;
}

function normalizeSettlementPayload(raw, { orderId: fallbackOrderId, eventType } = {}) {
  const src = pickSettlementObject(raw);
  if (!src) return null;
  const orderId = firstNonEmpty(src.order_id, src.orderId, fallbackOrderId);
  if (!orderId) return null;
  const cfSettlementId = firstNonEmpty(
    src.cf_settlement_id,
    src.cfSettlementId,
    src.settlement_id,
    src.transfer_id,
  );
  const transferTime = parseDateOrNull(
    src.transfer_time
    || src.transferTime
    || src.settlement_processed_on
    || src.settlement_initiated_on
    || src.settlement_date
    || src.settlementDate,
  );
  let status = firstNonEmpty(src.status, src.settlement_status, src.settlementStatus).toUpperCase();
  if (!status && String(eventType || '').toUpperCase().includes('SETTLEMENT_SUCCESS') && cfSettlementId) {
    status = 'SUCCESS';
  }
  if (!status && (cfSettlementId || transferTime)) status = 'SUCCESS';
  if (!status) status = 'PENDING';

  if (!cfSettlementId && !transferTime && !status) {
    return {
      orderId,
      cfSettlementId: null,
      cfPaymentId: firstNonEmpty(src.cf_payment_id, src.cfPaymentId, src.payment_id) || null,
      settlementAmount: src.settlement_amount ?? src.settlementAmount ?? null,
      serviceCharge: src.service_charge ?? src.serviceCharge ?? null,
      serviceTax: src.service_tax ?? src.serviceTax ?? null,
      status: null,
      statusDescription: null,
      transferTime: null,
      transferUtr: firstNonEmpty(src.transfer_utr, src.transferUtr, src.settlement_utr) || null,
      empty: true,
    };
  }
  const amountRaw = src.settlement_amount ?? src.settlementAmount;
  return {
    orderId,
    cfSettlementId: cfSettlementId || null,
    cfPaymentId: firstNonEmpty(src.cf_payment_id, src.cfPaymentId, src.payment_id) || null,
    settlementAmount: amountRaw == null || amountRaw === '' ? null : Number(amountRaw),
    serviceCharge: src.service_charge ?? src.serviceCharge ?? null,
    serviceTax: src.service_tax ?? src.serviceTax ?? null,
    status: status || null,
    statusDescription: firstNonEmpty(src.status_description, src.statusDescription) || null,
    transferTime,
    transferUtr: firstNonEmpty(src.transfer_utr, src.transferUtr, src.settlement_utr) || null,
    empty: false,
  };
}

function normalizeRefundPayload(raw, { orderId: fallbackOrderId } = {}) {
  const src = raw?.refund && typeof raw.refund === 'object' ? raw.refund : raw;
  if (!src || typeof src !== 'object') return null;
  const orderId = firstNonEmpty(src.order_id, src.orderId, fallbackOrderId);
  const refundId = firstNonEmpty(src.cf_refund_id, src.refund_id, src.refundId);
  const amount = Number(src.refund_amount ?? src.refundAmount ?? src.amount ?? 0);
  if (!orderId || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    orderId,
    refundId: refundId || null,
    paymentId: firstNonEmpty(src.cf_payment_id, src.payment_id, src.paymentId) || null,
    amount,
    status: firstNonEmpty(src.refund_status, src.status) || 'SUCCESS',
  };
}

function isSettlementEventType(eventType) {
  const t = String(eventType || '').toUpperCase();
  return t.includes('SETTLEMENT') && !t.includes('PAYMENT_SUCCESS');
}

function isRefundEventType(eventType) {
  return String(eventType || '').toUpperCase().includes('REFUND');
}

function classifyFinanceWebhook(payload) {
  const eventType = payload?.type || payload?.event || '';
  const orderId = firstNonEmpty(
    payload?.data?.order?.order_id,
    payload?.data?.order?.orderId,
    payload?.order?.order_id,
    payload?.data?.order_id,
    payload?.data?.order_details?.order_id,
    payload?.data?.settlement_details?.order_id,
    payload?.data?.settlement?.order_id,
    payload?.data?.refund?.order_id,
  );
  if (isSettlementEventType(eventType)) {
    return {
      handled: true,
      kind: 'settlement',
      eventType,
      orderId,
      normalized: normalizeSettlementPayload(payload?.data || payload, { orderId, eventType }),
    };
  }
  if (isRefundEventType(eventType)) {
    return {
      handled: true,
      kind: 'refund',
      eventType,
      orderId,
      normalized: normalizeRefundPayload(payload?.data || payload, { orderId }),
    };
  }
  return { handled: false, kind: null, eventType, orderId };
}

async function upsertSettlement({ normalized, source, raw, actor = 'system' }) {
  if (!normalized?.orderId) return null;
  if (normalized.empty && !normalized.cfSettlementId && !normalized.transferTime && !normalized.status) {
    return null;
  }
  const before = await CashfreeSettlement.findOne({ orderId: normalized.orderId }).lean();
  const doc = await CashfreeSettlement.findOneAndUpdate(
    { orderId: normalized.orderId },
    {
      $set: {
        cfSettlementId: normalized.cfSettlementId || before?.cfSettlementId || null,
        cfPaymentId: normalized.cfPaymentId || before?.cfPaymentId || null,
        settlementAmount: normalized.settlementAmount ?? before?.settlementAmount ?? null,
        serviceCharge: normalized.serviceCharge ?? before?.serviceCharge ?? null,
        serviceTax: normalized.serviceTax ?? before?.serviceTax ?? null,
        status: normalized.status || before?.status || null,
        statusDescription: normalized.statusDescription || before?.statusDescription || null,
        transferTime: normalized.transferTime || before?.transferTime || null,
        transferUtr: normalized.transferUtr || before?.transferUtr || null,
        source,
        raw: raw || {},
        syncedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  await PaymentAuditLog.create({
    action: 'settlement_upsert',
    actor,
    orderId: normalized.orderId,
    source,
    before,
      after: {
      cfSettlementId: doc.cfSettlementId,
      status: doc.status,
      transferTime: doc.transferTime,
      transferUtr: doc.transferUtr,
    },
  });
  return doc;
}

async function upsertRefund({ normalized, source, raw, actor = 'system' }) {
  if (!normalized?.orderId) return null;
  const filter = normalized.refundId
    ? { refundId: normalized.refundId }
    : { orderId: normalized.orderId, amount: normalized.amount, source };
  const before = await PaymentRefund.findOne(filter).lean();
  const doc = await PaymentRefund.findOneAndUpdate(
    filter,
    {
      $set: {
        refundId: normalized.refundId,
        orderId: normalized.orderId,
        paymentId: normalized.paymentId,
        amount: normalized.amount,
        status: normalized.status,
        source,
        raw: raw || {},
      },
    },
    { upsert: true, new: true },
  );
  await PaymentAuditLog.create({
    action: 'refund_upsert',
    actor,
    orderId: normalized.orderId,
    source,
    before,
    after: { refundId: doc.refundId, amount: doc.amount, status: doc.status },
  });
  return doc;
}

async function applyWebhookFinanceEvent(payload) {
  const classified = classifyFinanceWebhook(payload);
  if (!classified.handled) return { handled: false };

  if (classified.kind === 'settlement') {
    if (!classified.normalized) return { handled: true, kind: 'settlement', skipped: true };
    const doc = await upsertSettlement({
      normalized: classified.normalized,
      source: 'webhook',
      raw: payload,
      actor: 'cashfree_webhook',
    });
    return { handled: true, kind: 'settlement', skipped: !doc, orderId: classified.normalized.orderId };
  }

  if (classified.kind === 'refund') {
    if (!classified.normalized) return { handled: true, kind: 'refund', skipped: true };
    const doc = await upsertRefund({
      normalized: classified.normalized,
      source: 'webhook',
      raw: payload,
      actor: 'cashfree_webhook',
    });
    return { handled: true, kind: 'refund', skipped: !doc, orderId: classified.normalized.orderId };
  }

  return { handled: false };
}

const DEFAULT_SYNC_LIMIT = 40;
const FAILED_RETRY_MS = 6 * 60 * 60 * 1000;
const PENDING_RETRY_MS = 10 * 60 * 1000;
const NOT_FOUND_RETRY_MS = 30 * 60 * 1000;
const AUTO_SYNC_GAP_MS = 90 * 1000;

function hasSettlementReference(doc) {
  return Boolean(
    String(doc?.transferUtr || '').trim()
    || String(doc?.cfSettlementId || '').trim(),
  );
}

function isTerminalSuccessDoc(doc) {
  const s = String(doc?.status || '').toUpperCase();
  if (s.includes('PENDING') || s === 'FAILED' || s === 'NOT_FOUND') return false;
  if ((s === 'SUCCESS' || s === 'SETTLED') && hasSettlementReference(doc)) return true;
  if (hasSettlementReference(doc) && (doc?.cfSettlementId || doc?.transferTime)) return true;
  return false;
}

function shouldRefreshSettlement(doc) {
  if (!doc) return true;
  const synced = doc.syncedAt ? new Date(doc.syncedAt).getTime() : 0;
  const age = synced ? Date.now() - synced : Number.POSITIVE_INFINITY;
  const s = String(doc.status || '').toUpperCase();
  const missingReference = (s === 'SUCCESS' || s === 'SETTLED' || doc.transferTime)
    && !hasSettlementReference(doc);
  if (missingReference && age >= PENDING_RETRY_MS) return true;
  if (isTerminalSuccessDoc(doc)) return false;
  if (s === 'NOT_FOUND' && age < NOT_FOUND_RETRY_MS) return false;
  if (s.includes('PENDING') && age < PENDING_RETRY_MS) return false;
  if (s === 'FAILED' && age < FAILED_RETRY_MS) return false;
  return true;
}

async function syncSettlements({ limit = DEFAULT_SYNC_LIMIT, actor = 'admin', orderIds } = {}) {
  const cap = Math.min(100, Math.max(1, Number(limit) || DEFAULT_SYNC_LIMIT));
  let candidateIds = [...new Set((orderIds || []).map((id) => String(id || '').trim()).filter(Boolean))];

  if (!candidateIds.length) {
    const orders = await PaymentOrder.find({
      status: 'PAID',
      $or: [{ gateway: 'cashfree' }, { gateway: { $exists: false } }, { gateway: null }],
    })
      .select('orderId gateway')
      .sort({ createdAt: -1 })
      .lean();
    candidateIds = orders
      .filter((order) => isCashfreeGateway(order.gateway) && order.orderId)
      .map((order) => String(order.orderId));
  }

  const existing = await CashfreeSettlement.find({ orderId: { $in: candidateIds } })
    .select('orderId status cfSettlementId transferTime syncedAt')
    .lean();
  const byOrder = new Map(existing.map((row) => [String(row.orderId), row]));
  const pending = candidateIds.filter((id) => shouldRefreshSettlement(byOrder.get(id))).slice(0, cap);

  const results = {
    attempted: pending.length,
    settled: 0,
    success: 0,
    pending: 0,
    missing: 0,
    failed: 0,
    errors: [],
  };

  for (const orderId of pending) {
    const fetched = await fetchOrderSettlements(orderId);
    if (fetched.missing || (fetched.ok && !fetched.data)) {
      await upsertSettlement({
        normalized: {
          orderId,
          cfSettlementId: null,
          cfPaymentId: null,
          settlementAmount: null,
          serviceCharge: null,
          serviceTax: null,
          status: 'NOT_FOUND',
          statusDescription: 'Cashfree has not created a settlement for this order yet',
          transferTime: null,
          transferUtr: null,
          empty: false,
        },
        source: 'api',
        raw: { missing: true, status: fetched.status },
        actor,
      });
      results.missing += 1;
      continue;
    }
    if (!fetched.ok) {
      results.failed += 1;
      if (results.errors.length < 8) {
        results.errors.push({ orderId, error: fetched.error || `HTTP ${fetched.status}` });
      }
      continue;
    }
    const normalized = normalizeSettlementPayload(fetched.data, { orderId });
    if (!normalized || normalized.empty) {
      results.missing += 1;
      continue;
    }
    await upsertSettlement({
      normalized,
      source: 'api',
      raw: fetched.data,
      actor,
    });
    results.settled += 1;
    const status = String(normalized.status || '').toUpperCase();
    if (status === 'SUCCESS' || status === 'SETTLED') {
      results.success += 1;
    } else {
      results.pending += 1;
    }
  }

  return results;
}

let autoSyncPromise = null;
let lastAutoSyncAt = 0;

async function autoSyncDashboardSettlements({ actor = 'auto', force = false, limit = 80 } = {}) {
  if (autoSyncPromise) return autoSyncPromise;
  if (!force && Date.now() - lastAutoSyncAt < AUTO_SYNC_GAP_MS) {
    return { skipped: true, reason: 'recent', attempted: 0, settled: 0, missing: 0, failed: 0 };
  }
  autoSyncPromise = (async () => {
    lastAutoSyncAt = Date.now();
    const { buildLinkedPaymentRows } = require('./paymentSettlementService');
    const { rows } = await buildLinkedPaymentRows();
    const orderIds = [...new Set(rows.map((row) => String(row.orderId || '')).filter(Boolean))];
    return syncSettlements({ orderIds, limit, actor });
  })()
    .catch((err) => {
      if (err.code === 'CASHFREE_CREDENTIALS_MISSING') {
        return {
          attempted: 0,
          settled: 0,
          success: 0,
          pending: 0,
          missing: 0,
          failed: 0,
          errors: [{ error: err.message }],
        };
      }
      throw err;
    })
    .finally(() => {
      autoSyncPromise = null;
    });
  return autoSyncPromise;
}

function initSettlementSyncCron() {
  if (process.env.NODE_ENV === 'test') return;
  const intervalMs = Number(process.env.CASHFREE_SETTLEMENT_SYNC_MS) || 15 * 60 * 1000;
  const { logger } = require('../utils/logger');
  logger.info('Cashfree settlement sync cron started', { intervalMs });
  const tick = () => {
    autoSyncDashboardSettlements({ actor: 'cron', force: true, limit: 80 }).catch((err) => {
      logger.warn('Cashfree settlement sync failed', { error: err.message });
    });
  };
  setTimeout(tick, 25000);
  setInterval(tick, intervalMs);
}

module.exports = {
  firstNonEmpty,
  parseDateOrNull,
  pickSettlementObject,
  normalizeSettlementPayload,
  normalizeRefundPayload,
  isSettlementEventType,
  isRefundEventType,
  classifyFinanceWebhook,
  upsertSettlement,
  upsertRefund,
  applyWebhookFinanceEvent,
  syncSettlements,
  autoSyncDashboardSettlements,
  initSettlementSyncCron,
};
