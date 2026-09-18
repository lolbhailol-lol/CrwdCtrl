'use strict';

const PaymentOrder = require('../model/payment_order_model');
const { phoneDigits } = require('./competitionDuplicateGuard');

const OPEN_TTL_MS = 30 * 60 * 1000;

function isFreshPending(order) {
  if (!order) return false;
  if (String(order.status || '').toUpperCase() !== 'PENDING') return false;
  if (order.orderTags?.retired) return false;
  const age = Date.now() - new Date(order.createdAt || 0).getTime();
  return age < OPEN_TTL_MS;
}

/**
 * One active Cashfree checkout per person on MindSpark.
 * Returns the open desk/bundle/website payment if any.
 */
async function findOpenMindSparkCheckout({
  festId,
  userId,
  phone,
  excludeOrderId = null,
} = {}) {
  const digits = phoneDigits(phone);
  const DeskEntry = require('../model/fest_day_assisted_registration_model');
  const Bundle = require('../model/mindspark_bundle_model');
  const Competition = require('../model/competition_model');

  const pendingEntries = await DeskEntry.find({
    fest: festId,
    status: 'pending',
    ...(userId ? { user: userId } : {}),
  }).select('+paymentToken competitionId paymentOrderId user').sort({ createdAt: -1 }).limit(20).lean();

  for (const entry of pendingEntries) {
    if (!entry.paymentOrderId) continue;
    const order = await PaymentOrder.findOne({ orderId: entry.paymentOrderId }).lean();
    if (!isFreshPending(order)) continue;
    if (excludeOrderId && String(order.orderId) === String(excludeOrderId)) continue;
    const competition = await Competition.findById(entry.competitionId).select('name').lean();
    return {
      kind: 'desk',
      competitionId: String(entry.competitionId || ''),
      competitionName: competition?.name || 'Competition',
      orderId: order.orderId,
      paymentUrl: null, // filled by caller with FRONTEND + token
      paymentToken: entry.paymentToken,
      amount: Number(order.totalAmount) || 0,
      entryId: String(entry._id),
      userId: String(entry.user || ''),
    };
  }

  // Fallback: phone match on desk responses when userId path missed
  if (digits.length === 10) {
    const byPhone = await DeskEntry.find({
      fest: festId,
      status: 'pending',
      $or: [
        { 'responses.phone': digits },
        { 'responses.mobile': digits },
      ],
    }).select('+paymentToken competitionId paymentOrderId user').sort({ createdAt: -1 }).limit(10).lean();
    for (const entry of byPhone) {
      if (!entry.paymentOrderId) continue;
      const order = await PaymentOrder.findOne({ orderId: entry.paymentOrderId }).lean();
      if (!isFreshPending(order)) continue;
      if (excludeOrderId && String(order.orderId) === String(excludeOrderId)) continue;
      const competition = await Competition.findById(entry.competitionId).select('name').lean();
      return {
        kind: 'desk',
        competitionId: String(entry.competitionId || ''),
        competitionName: competition?.name || 'Competition',
        orderId: order.orderId,
        paymentToken: entry.paymentToken,
        amount: Number(order.totalAmount) || 0,
        entryId: String(entry._id),
        userId: String(entry.user || ''),
      };
    }
  }

  const bundleFilter = {
    fest: festId,
    status: { $in: ['pending', 'confirming'] },
    ...(userId ? { user: userId } : {}),
  };
  const pendingBundle = await Bundle.findOne(bundleFilter)
    .select('+paymentToken activeOrderId status items competitionNames')
    .sort({ createdAt: -1 });
  if (pendingBundle?.activeOrderId) {
    const order = await PaymentOrder.findOne({ orderId: pendingBundle.activeOrderId }).lean();
    if (isFreshPending(order) && !(excludeOrderId && String(order.orderId) === String(excludeOrderId))) {
      return {
        kind: 'bundle',
        competitionId: '',
        competitionName: (pendingBundle.items || []).map((i) => i.competitionName).filter(Boolean).join(' + ') || 'MindSpark bundle',
        orderId: order.orderId,
        paymentToken: pendingBundle.paymentToken,
        amount: Number(order.totalAmount) || 0,
        bundleId: String(pendingBundle._id),
        userId: String(pendingBundle.user || ''),
      };
    }
  }

  if (userId) {
    const competitionIds = await Competition.find({ fest: festId }).select('_id name').lean();
    const byId = new Map(competitionIds.map((c) => [String(c._id), c.name]));
    const ids = competitionIds.map((c) => c._id);
    const websiteOrder = await PaymentOrder.findOne({
      entityType: 'competition',
      entityId: { $in: ids },
      userId,
      status: 'PENDING',
      'orderTags.retired': { $ne: true },
      createdAt: { $gt: new Date(Date.now() - OPEN_TTL_MS) },
    }).sort({ createdAt: -1 }).lean();
    if (websiteOrder && !(excludeOrderId && String(websiteOrder.orderId) === String(excludeOrderId))) {
      return {
        kind: 'website',
        competitionId: String(websiteOrder.entityId || ''),
        competitionName: byId.get(String(websiteOrder.entityId)) || websiteOrder.orderTags?.competitionName || 'Competition',
        orderId: websiteOrder.orderId,
        paymentSessionId: websiteOrder.paymentSessionId || null,
        amount: Number(websiteOrder.totalAmount) || 0,
        userId: String(userId),
      };
    }
  }

  return null;
}

module.exports = {
  OPEN_TTL_MS,
  isFreshPending,
  findOpenMindSparkCheckout,
};
