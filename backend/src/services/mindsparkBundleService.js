const mongoose = require('mongoose');
const crypto = require('crypto');
const Registration = require('../model/registration_model');
const Bundle = require('../model/mindspark_bundle_model');
const User = require('../model/usermodel');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const CompetitionSlotReservation = require('../model/competition_slot_reservation_model');
const { acquireCompetitionSlot, releaseCompetitionSlot } = require('./competitionSlotReservationService');
const { cashfreeSettlementFields } = require('../utils/cashfreeGatewayFee');

const LOCK_TIMEOUT_MS = 2 * 60 * 1000;

function allocate(total, items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.originalAmount || 0), 0);
  if (subtotal <= 0) return items.map(() => 0);
  let used = 0;
  return items.map((item, i) => {
    const amount = i === items.length - 1
      ? total - used
      : Math.round(total * Number(item.originalAmount || 0) / subtotal);
    used += amount;
    return amount;
  });
}

async function markReview(bundleId, message) {
  await Bundle.updateOne(
    { _id: bundleId },
    { $set: { status: 'paid_review', fulfillmentState: 'review', fulfillmentStartedAt: null } },
  );
  return { ok: false, error: message, paidReview: true };
}

async function buildMindSparkBundleEmailItems(bundle) {
  const competitionIds = bundle.items.map((item) => item.competitionId).filter(Boolean);
  const [fest, competitions] = await Promise.all([
    FestOrganizer.findById(bundle.fest).select('registration.whatsappCommunityLink').lean(),
    Competition.find({ _id: { $in: competitionIds } })
      .select('registration.whatsappGroupLink')
      .lean(),
  ]);
  const festWhatsApp = String(fest?.registration?.whatsappCommunityLink || '').trim();
  const whatsAppByCompetitionId = new Map(
    competitions.map((row) => [
      String(row._id),
      String(row.registration?.whatsappGroupLink || '').trim(),
    ]),
  );
  return bundle.items.map((item) => ({
    competitionName: item.competitionName,
    roster: item.roster,
    registrationId: String(item.registrationId),
    whatsappGroupLink: whatsAppByCompetitionId.get(String(item.competitionId)) || festWhatsApp,
  }));
}

async function deliverMindSparkBundleConfirmationEmail(bundle, user, { resend = false } = {}) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email || email.endsWith('@crwdctrl.local')) {
    return { sent: false, reason: 'no_email' };
  }
  if (!bundle.items?.every((item) => item.registrationId)) {
    return { sent: false, reason: 'incomplete_registrations' };
  }
  const { sendMindSparkBundleConfirmationEmail } = require('./emailService');
  await sendMindSparkBundleConfirmationEmail({
    email,
    name: user?.name,
    bundleId: String(bundle._id),
    paymentToken: bundle.paymentToken,
    items: await buildMindSparkBundleEmailItems(bundle),
    resend,
  });
  return { sent: true, email };
}

async function sendBundleEmailOnce(bundleId) {
  const claimed = await Bundle.findOneAndUpdate(
    { _id: bundleId, status: 'paid', confirmationEmailSentAt: null },
    { $set: { confirmationEmailSentAt: new Date() } },
    { new: true },
  ).select('+paymentToken').populate('user', 'name email');
  if (!claimed) return { sent: false, reason: 'already_sent_or_not_paid' };
  try {
    const result = await deliverMindSparkBundleConfirmationEmail(claimed, claimed.user);
    if (!result.sent) {
      await Bundle.updateOne({ _id: bundleId }, { $set: { confirmationEmailSentAt: null } }).catch(() => {});
    }
    return result;
  } catch (error) {
    await Bundle.updateOne({ _id: bundleId }, { $set: { confirmationEmailSentAt: null } }).catch(() => {});
    throw error;
  }
}

/** Resend bundle confirmation (e.g. after template fix). Does not require confirmationEmailSentAt to be null. */
async function resendMindSparkBundleConfirmationEmail(bundleId) {
  const bundle = await Bundle.findById(bundleId)
    .select('+paymentToken')
    .populate('user', 'name email');
  if (!bundle) return { sent: false, reason: 'not_found' };
  if (!['paid', 'paid_review'].includes(bundle.status)) {
    return { sent: false, reason: 'not_paid' };
  }
  return deliverMindSparkBundleConfirmationEmail(bundle, bundle.user, { resend: true });
}

async function fulfillMindSparkBundle(paymentOrder) {
  const current = await Bundle.findById(paymentOrder.entityId).lean();
  if (!current) return { ok: false, error: 'Bundle not found' };
  if (current.activeOrderId && current.activeOrderId !== paymentOrder.orderId) {
    return { ok: false, error: 'Retired bundle payment order', retired: true };
  }
  if (current.status === 'paid' && current.items.every((item) => item.registrationId)) {
    sendBundleEmailOnce(current._id).catch(() => {});
    return { ok: true, issued: true, registrationIds: current.items.map((item) => item.registrationId) };
  }

  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const claimed = await Bundle.findOneAndUpdate(
    {
      _id: current._id,
      activeOrderId: paymentOrder.orderId,
      status: { $nin: ['paid', 'paid_review', 'refunded'] },
      $or: [
        { fulfillmentState: { $exists: false } },
        { fulfillmentState: 'idle' },
        { fulfillmentState: 'processing', fulfillmentStartedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { fulfillmentState: 'processing', fulfillmentStartedAt: new Date(), status: 'confirming' } },
    { new: true },
  );
  if (!claimed) {
    const latest = await Bundle.findById(current._id).lean();
    return {
      ok: latest?.status === 'paid',
      issued: latest?.status === 'paid',
      inProgress: latest?.fulfillmentState === 'processing',
      paidReview: latest?.status === 'paid_review',
      registrationIds: (latest?.items || []).map((item) => item.registrationId).filter(Boolean),
    };
  }

  const user = await User.findById(claimed.user);
  if (!user) return markReview(claimed._id, 'User not found');

  const activeReservations = await CompetitionSlotReservation.find({
    token: { $in: claimed.items.map((item) => item.reservationToken).filter(Boolean) },
    expiresAt: { $gt: new Date() },
  }).select('token').lean();
  const activeTokens = new Set(activeReservations.map((row) => row.token));
  const replacementReservations = [];
  try {
    for (const item of claimed.items) {
      if (activeTokens.has(item.reservationToken)) continue;
      const competition = await Competition.findById(item.competitionId);
      const reservation = await acquireCompetitionSlot({ competition, userId: claimed.user });
      replacementReservations.push(reservation);
      item.reservationToken = reservation?.token || '';
    }
  } catch (error) {
    await Promise.all(replacementReservations.filter(Boolean).map((row) => releaseCompetitionSlot(row.token).catch(() => {})));
    return markReview(claimed._id, 'Paid after capacity expired; full refund review required');
  }

  const allocations = allocate(Number(paymentOrder.totalAmount || 0), claimed.items);
  const session = await mongoose.startSession();
  const registrations = [];
  try {
    await session.withTransaction(async () => {
      const lockedBundle = await Bundle.findById(claimed._id).session(session);
      if (!lockedBundle || lockedBundle.fulfillmentState !== 'processing') throw new Error('Bundle fulfillment lock was lost');
      for (let i = 0; i < lockedBundle.items.length; i += 1) {
        const item = lockedBundle.items[i];
        const claimedItem = claimed.items[i];
        item.reservationToken = claimedItem.reservationToken;
        const derivedOrderId = `${paymentOrder.orderId}:${String(item._id)}`;
        const registration = await Registration.findOneAndUpdate(
          { payment_order_id: derivedOrderId },
          {
            $setOnInsert: {
              fest: lockedBundle.fest,
              user: lockedBundle.user,
              competitionId: item.competitionId,
              responses: { ...item.roster, mindspark_bundle_id: String(lockedBundle._id), bundle_cashfree_order_id: paymentOrder.orderId, bundle_original_amount: item.originalAmount, bundle_discount_percent: 70 },
              status: 'approved',
              payment_order_id: derivedOrderId,
              payment_id: paymentOrder.paymentId,
              payment_gateway: 'cashfree_bundle',
              paymentStatus: 'paid',
              amountPaid: allocations[i],
              qrCodeData: crypto.randomBytes(16).toString('hex'),
              ...cashfreeSettlementFields({ amountPaid: allocations[i], payment_gateway: 'cashfree', payment_order_id: derivedOrderId }),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true, session },
        );
        registrations.push(registration);
        item.registrationId = registration._id;
        item.allocatedPaidAmount = allocations[i];
      }
      if (registrations.length !== 3) throw new Error('Bundle did not produce exactly three registrations');
      lockedBundle.status = 'paid';
      lockedBundle.fulfillmentState = 'complete';
      lockedBundle.fulfillmentStartedAt = null;
      await lockedBundle.save({ session });
    });
  } catch (error) {
    await Bundle.updateOne(
      { _id: claimed._id, fulfillmentState: 'processing' },
      { $set: { status: 'confirming', fulfillmentState: 'idle', fulfillmentStartedAt: null } },
    ).catch(() => {});
    throw error;
  } finally {
    await session.endSession();
  }

  await Promise.all(claimed.items.map((item) => item.reservationToken).filter(Boolean).map((token) => releaseCompetitionSlot(token).catch(() => {})));
  sendBundleEmailOnce(claimed._id).catch(() => {});
  return { ok: true, issued: true, registrationIds: registrations.map((registration) => registration._id) };
}

module.exports = {
  allocate,
  fulfillMindSparkBundle,
  resendMindSparkBundleConfirmationEmail,
};
