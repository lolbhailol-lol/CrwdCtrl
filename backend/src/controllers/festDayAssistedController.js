const crypto = require('crypto');
const mongoose = require('mongoose');
const Registration = require('../model/registration_model');
const PaymentOrder = require('../model/payment_order_model');
const Competition = require('../model/competition_model');
const User = require('../model/usermodel');
const { isMindSparkFestId } = require('../modules/fest/plugins/mindspark');
const { resolveCompetitionTicketPrice } = require('../utils/competitionFeeTiers');
const { buildPriceBreakdown } = require('../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../utils/trekRegistrationFee');
const { createCashfreeOrder, verifyCashfreePayment, getCashfreeClientMode } = require('../services/cashfreeService');
const { acquireCompetitionSlot, attachReservationToOrder, releaseCompetitionSlot } = require('../services/competitionSlotReservationService');

const FRONTEND = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const ORDER_TTL_MS = 30 * 60 * 1000;
const clean = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const phoneDigits = (value) => String(value || '').replace(/\D/g, '').slice(-10);

function publicState(registration, order) {
  const raw = String(order?.status || '').toUpperCase();
  const paid = registration.paymentStatus === 'paid' && registration.status === 'approved';
  const completed = paid || (registration.paymentStatus === 'free' && registration.status === 'approved');
  const timedOut = raw === 'PENDING' && Date.now() - new Date(order?.createdAt || 0).getTime() >= ORDER_TTL_MS;
  return {
    registrationId: String(registration._id),
    orderId: order?.orderId || null,
    status: completed ? 'paid' : raw === 'FAILED' ? 'failed' : (raw === 'EXPIRED' || timedOut) ? 'expired' : raw === 'PAID' ? 'confirming' : 'pending',
    amount: Number(order?.totalAmount) || 0,
    paymentSessionId: raw === 'PENDING' && !timedOut ? order?.paymentSessionId || null : null,
    cashfreeMode: getCashfreeClientMode(),
    ticketUrl: completed ? `${FRONTEND()}/desk-payment/${registration.deskPaymentToken}` : null,
    ticketQr: completed ? registration.qrCodeData || null : null,
    participantName: clean(registration.responses?.get?.('full_name') || registration.responses?.full_name),
    teamName: clean(registration.responses?.get?.('team_name') || registration.responses?.team_name),
  };
}

async function createOrderForRegistration({ registration, competition, user }) {
  const tierId = clean(registration.responses?.get?.('feeTierId') || registration.responses?.feeTierId, 80);
  const priced = resolveCompetitionTicketPrice(competition, tierId);
  const fee = resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3);
  const totals = buildPriceBreakdown(priced.ticketPrice, fee);
  const reservation = await acquireCompetitionSlot({ competition, userId: user._id });
  if (totals.totalAmount <= 0) {
    try {
      registration.status = 'approved';
      registration.paymentStatus = 'free';
      registration.deferTicketUntilPaid = false;
      await registration.save();
      return { registration, order: null };
    } finally {
      if (reservation?.token) await releaseCompetitionSlot(reservation.token).catch(() => {});
    }
  }
  try {
    const order = await createCashfreeOrder({
      orderAmount: totals.totalAmount,
      customerDetails: {
        customerId: String(user._id), customerName: user.name,
        customerEmail: user.email, customerPhone: user.phoneNumber,
      },
      orderMeta: { return_url: `${FRONTEND()}/desk-payment/${registration.deskPaymentToken}?returned=1` },
      orderNote: `MindSpark - ${competition.name}`,
      orderTags: { entityType: 'competition', competitionName: competition.name, assistedDesk: 'yes' },
    });
    const stored = await PaymentOrder.create({
      orderId: order.order_id, paymentSessionId: order.payment_session_id,
      entityType: 'competition', entityId: competition._id, userId: user._id,
      ticketPrice: totals.ticketPrice, platformFee: totals.platformFee,
      amountBeforeDiscount: totals.totalAmount, amountAfterDiscount: totals.totalAmount,
      totalAmount: totals.totalAmount, status: 'PENDING', customerEmail: user.email,
      customerPhone: user.phoneNumber,
      orderTags: {
        competitionName: competition.name, festId: String(competition.fest._id),
        assistedRegistrationId: String(registration._id), slotReservationToken: reservation?.token || '',
        registrationDraft: { festId: String(competition.fest._id), competitionId: String(competition._id), formData: Object.fromEntries(registration.responses) },
        ...(priced.tier ? { tierId: priced.tier.id, tierName: priced.tier.label } : {}),
      },
    });
    if (reservation?.token) await attachReservationToOrder(reservation.token, stored.orderId);
    registration.payment_order_id = stored.orderId;
    registration.payment_gateway = 'cashfree';
    await registration.save();
    return { registration, order: stored };
  } catch (error) {
    if (reservation?.token) await releaseCompetitionSlot(reservation.token).catch(() => {});
    throw error;
  }
}

exports.createAssistedRegistration = async (req, res) => {
  try {
    if (!isMindSparkFestId(req.festId)) return res.status(404).json({ success: false, message: 'MindSpark only' });
    const submissionKey = clean(req.body.submissionKey, 100);
    if (submissionKey.length < 8) return res.status(400).json({ success: false, message: 'Invalid submission key' });
    let registration = await Registration.findOne({ fest: req.festId, deskSubmissionKey: submissionKey }).select('+deskPaymentToken');
    if (registration) {
      let order = registration.payment_order_id ? await PaymentOrder.findOne({ orderId: registration.payment_order_id }) : null;
      if (!order && registration.paymentStatus === 'pending') {
        const [competition, user] = await Promise.all([
          Competition.findById(registration.competitionId).populate('fest'),
          User.findById(registration.user),
        ]);
        const created = await createOrderForRegistration({ registration, competition, user });
        order = created.order;
      }
      return res.json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${registration.deskPaymentToken}`, ...publicState(registration, order) });
    }
    const competition = await Competition.findOne({ _id: req.body.competitionId, fest: req.festId }).populate('fest');
    if (!competition) return res.status(404).json({ success: false, message: 'Competition not found' });
    const name = clean(req.body.name, 100);
    const phone = phoneDigits(req.body.phone);
    const emailInput = clean(req.body.email, 180).toLowerCase();
    if (!name || phone.length !== 10) return res.status(400).json({ success: false, message: 'Captain name and valid 10-digit phone are required' });
    const members = Array.isArray(req.body.members) ? req.body.members.map((x) => clean(x, 100)).filter(Boolean) : [];
    const min = Math.max(1, Number(competition.teamSizeMin) || 1);
    const max = Math.max(min, Number(competition.teamSizeMax) || min);
    const teamSize = 1 + members.length;
    if (teamSize < min || teamSize > max) return res.status(400).json({ success: false, message: `Team size must be between ${min} and ${max}` });
    resolveCompetitionTicketPrice(competition, clean(req.body.feeTierId, 80));
    let user = await User.findOne({ $or: [{ phoneNumber: phone }, ...(emailInput ? [{ email: emailInput }] : [])] });
    if (!user) {
      user = await User.create({ name, email: emailInput || `desk+${crypto.randomBytes(8).toString('hex')}@crwdctrl.local`, phoneNumber: phone, password: crypto.randomBytes(24).toString('hex'), isVerified: true, signupMethod: 'password' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    registration = await Registration.create({
      fest: req.festId, competitionId: competition._id, user: user._id,
      responses: { full_name: name, phone, email: emailInput, college: clean(req.body.college), team_name: clean(req.body.teamName), team_members: [name, ...members], team_size: teamSize, feeTierId: clean(req.body.feeTierId, 80), manual_entry: 'assisted_cashfree' },
      status: 'pending', paymentStatus: 'pending', amountPaid: 0, payment_gateway: 'cashfree',
      deferTicketUntilPaid: true, deskSubmissionKey: submissionKey, deskPaymentToken: token,
    });
    const created = await createOrderForRegistration({ registration, competition, user });
    return res.status(201).json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${token}`, ...publicState(created.registration, created.order) });
  } catch (error) {
    console.error('[festDayAssisted.create]', error);
    if (error.code === 11000 && req.body?.submissionKey) {
      const existing = await Registration.findOne({ fest: req.festId, deskSubmissionKey: clean(req.body.submissionKey, 100) }).select('+deskPaymentToken');
      if (existing) {
        const order = existing.payment_order_id ? await PaymentOrder.findOne({ orderId: existing.payment_order_id }) : null;
        return res.json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${existing.deskPaymentToken}`, ...publicState(existing, order) });
      }
    }
    const status = error.status || (error.code === 11000 ? 409 : 500);
    return res.status(status).json({ success: false, message: error.message || 'Could not create assisted registration' });
  }
};

async function loadPublic(token) {
  const registration = await Registration.findOne({ deskPaymentToken: clean(token, 100) }).select('+deskPaymentToken');
  if (!registration) return {};
  const [order, competition] = await Promise.all([
    registration.payment_order_id ? PaymentOrder.findOne({ orderId: registration.payment_order_id }) : null,
    Competition.findById(registration.competitionId).select('name').lean(),
  ]);
  return { registration, order, competition };
}

exports.getAssistedPayment = async (req, res) => {
  const { registration, order, competition } = await loadPublic(req.params.token);
  if (!registration) return res.status(404).json({ success: false, message: 'Payment link not found' });
  return res.json({ success: true, competitionName: competition?.name || 'Competition', ...publicState(registration, order) });
};

exports.verifyAssistedPayment = async (req, res) => {
  try {
    const { registration, order, competition } = await loadPublic(req.params.token);
    if (!registration) return res.status(404).json({ success: false, message: 'Payment link not found' });
    if (order && registration.paymentStatus !== 'paid') {
      const result = await verifyCashfreePayment({ orderId: order.orderId, paymentId: order.paymentId || undefined });
      if (result.verified) {
        order.status = 'PAID'; if (result.paymentId) order.paymentId = String(result.paymentId); await order.save();
        const { fulfillFestCompetitionFromPaidOrder } = require('../services/festCompetitionPaymentFulfillment');
        await fulfillFestCompetitionFromPaidOrder(order);
      } else if (['failed', 'cancelled'].includes(result.status)) {
        order.status = result.status === 'cancelled' ? 'EXPIRED' : 'FAILED'; await order.save();
        const token = order.orderTags?.slotReservationToken; if (token) await releaseCompetitionSlot(token).catch(() => {});
      }
    }
    const fresh = await Registration.findById(registration._id).select('+deskPaymentToken');
    const freshOrder = order ? await PaymentOrder.findById(order._id) : null;
    return res.json({ success: true, competitionName: competition?.name || 'Competition', ...publicState(fresh, freshOrder) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Could not verify payment' });
  }
};

exports.reissueAssistedPayment = async (req, res) => {
  try {
    const { registration, order } = await loadPublic(req.params.token);
    if (!registration) return res.status(404).json({ success: false, message: 'Payment link not found' });
    const timedOut = order?.status === 'PENDING' && Date.now() - new Date(order.createdAt).getTime() >= ORDER_TTL_MS;
    if (registration.paymentStatus === 'paid' || !order || (order.status === 'PENDING' && !timedOut)) return res.json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${registration.deskPaymentToken}`, ...publicState(registration, order) });
    if (timedOut) {
      order.status = 'EXPIRED';
      await order.save();
      if (order.orderTags?.slotReservationToken) await releaseCompetitionSlot(order.orderTags.slotReservationToken).catch(() => {});
    }
    const claim = crypto.randomBytes(12).toString('hex');
    const claimed = await PaymentOrder.findOneAndUpdate(
      { _id: order._id, status: { $in: ['FAILED', 'EXPIRED'] }, 'orderTags.reissueClaim': { $exists: false } },
      { $set: { 'orderTags.reissueClaim': claim } },
      { new: true },
    );
    if (!claimed) {
      const latestRegistration = await Registration.findById(registration._id).select('+deskPaymentToken');
      const latestOrder = latestRegistration.payment_order_id ? await PaymentOrder.findOne({ orderId: latestRegistration.payment_order_id }) : null;
      return res.json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${latestRegistration.deskPaymentToken}`, ...publicState(latestRegistration, latestOrder) });
    }
    const competition = await Competition.findById(registration.competitionId).populate('fest');
    const user = await User.findById(registration.user);
    let created;
    try {
      created = await createOrderForRegistration({ registration, competition, user });
    } catch (error) {
      await PaymentOrder.updateOne({ _id: claimed._id, 'orderTags.reissueClaim': claim }, { $unset: { 'orderTags.reissueClaim': 1 } }).catch(() => {});
      throw error;
    }
    return res.json({ success: true, paymentUrl: `${FRONTEND()}/desk-payment/${registration.deskPaymentToken}`, ...publicState(created.registration, created.order) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Could not reissue payment' });
  }
};

exports._test = { publicState, ORDER_TTL_MS, phoneDigits };
