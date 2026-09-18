const crypto = require('crypto');
const DeskEntry = require('../model/fest_day_assisted_registration_model');
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
const {
  findApprovedCompetitionDuplicate,
} = require('../utils/competitionDuplicateGuard');
const { findOpenMindSparkCheckout } = require('../utils/openMindSparkCheckout');

const FRONTEND = () => String(
  process.env.PRODUCTION_FRONTEND_URL
  || process.env.PUBLIC_FRONTEND_URL
  || process.env.FRONTEND_URL
  || 'https://www.crwdctrl.in',
).replace(/\/$/, '');
const ORDER_TTL_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const clean = (value, max = 160) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const phoneDigits = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const validEmail = (value) => EMAIL_RE.test(clean(value).toLowerCase());

function publicState(entry, order, issuedRegistration = null, competitionName = '') {
  const raw = String(order?.status || '').toUpperCase();
  const completed = entry.status === 'paid' && Boolean(issuedRegistration);
  const timedOut = raw === 'PENDING' && Date.now() - new Date(order?.createdAt || 0).getTime() >= ORDER_TTL_MS;
  return {
    registrationId: issuedRegistration?._id ? String(issuedRegistration._id) : null,
    orderId: order?.orderId || null,
    status: completed
      ? 'paid'
      : order?.orderTags?.paidReview || order?.orderTags?.retired
        ? 'paid_review'
        : raw === 'FAILED'
          ? 'failed'
          : (raw === 'EXPIRED' || timedOut)
            ? 'expired'
            : raw === 'PAID'
              ? 'confirming'
              : 'pending',
    amount: Number(order?.totalAmount) || 0,
    paymentSessionId: raw === 'PENDING' && !timedOut ? order?.paymentSessionId || null : null,
    cashfreeMode: getCashfreeClientMode(),
    paymentUrl: `${FRONTEND()}/desk-payment/${entry.paymentToken}`,
    ticketUrl: completed ? `${FRONTEND()}/desk-payment/${entry.paymentToken}` : null,
    ticketQr: completed ? issuedRegistration.qrCodeData || null : null,
    competitionName: competitionName || '',
    participantName: clean(entry.responses?.get?.('full_name') || entry.responses?.full_name),
    teamName: clean(entry.responses?.get?.('team_name') || entry.responses?.team_name),
  };
}

function normalizeMembers(rawMembers, captainName) {
  const list = Array.isArray(rawMembers) ? rawMembers : [];
  return list.map((entry) => {
    if (typeof entry === 'string') {
      const name = clean(entry, 100);
      return name ? { name, email: '' } : null;
    }
    if (entry && typeof entry === 'object') {
      const name = clean(entry.name || entry.full_name, 100);
      if (!name) return null;
      return {
        name,
        email: clean(entry.email, 120).toLowerCase(),
        phone: phoneDigits(entry.phone || entry.mobile),
        college: clean(entry.college || entry.college_name, 120),
      };
    }
    return null;
  }).filter((row) => row && row.name && row.name.toLowerCase() !== String(captainName || '').toLowerCase());
}

async function findApprovedDuplicate({ festId, competitionId, userId, phone, email }) {
  return findApprovedCompetitionDuplicate({ festId, competitionId, userId, phone, email });
}

async function createOrderForEntry({ entry, competition, user }) {
  const tierId = clean(entry.responses?.get?.('feeTierId') || entry.responses?.feeTierId, 80);
  const priced = resolveCompetitionTicketPrice(competition, tierId);
  const totals = buildPriceBreakdown(priced.ticketPrice, resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3));
  const reservation = await acquireCompetitionSlot({ competition, userId: user._id });
  if (totals.totalAmount <= 0) {
    try {
      const issued = await Registration.create({
        fest: competition.fest._id, competitionId: competition._id, user: user._id,
        responses: Object.fromEntries(entry.responses), status: 'approved', paymentStatus: 'free', amountPaid: 0,
      });
      entry.status = 'paid'; entry.registrationId = issued._id; await entry.save();
      return { entry, order: null, issued };
    } finally {
      if (reservation?.token) await releaseCompetitionSlot(reservation.token).catch(() => {});
    }
  }
  try {
    const cashfree = await createCashfreeOrder({
      orderAmount: totals.totalAmount,
      customerDetails: { customerId: String(user._id), customerName: user.name, customerEmail: user.email, customerPhone: user.phoneNumber },
      orderMeta: { return_url: `${FRONTEND()}/desk-payment/${entry.paymentToken}?returned=1` },
      orderNote: `MindSpark - ${competition.name}`,
      orderTags: { entityType: 'competition', competitionName: competition.name, assistedDesk: 'yes' },
    });
    const order = await PaymentOrder.create({
      orderId: cashfree.order_id, paymentSessionId: cashfree.payment_session_id,
      entityType: 'competition', entityId: competition._id, userId: user._id,
      ticketPrice: totals.ticketPrice, platformFee: totals.platformFee,
      amountBeforeDiscount: totals.totalAmount, amountAfterDiscount: totals.totalAmount,
      totalAmount: totals.totalAmount, status: 'PENDING', customerEmail: user.email, customerPhone: user.phoneNumber,
      orderTags: {
        competitionName: competition.name, festId: String(competition.fest._id),
        deskEntryId: String(entry._id), slotReservationToken: reservation?.token || '',
        registrationDraft: { festId: String(competition.fest._id), competitionId: String(competition._id), formData: Object.fromEntries(entry.responses) },
        ...(priced.tier ? { tierId: priced.tier.id, tierName: priced.tier.label } : {}),
      },
    });
    if (reservation?.token) await attachReservationToOrder(reservation.token, order.orderId);
    entry.paymentOrderId = order.orderId; await entry.save();
    return { entry, order, issued: null };
  } catch (error) {
    if (reservation?.token) await releaseCompetitionSlot(reservation.token).catch(() => {});
    throw error;
  }
}

async function responseFor(entry, order = null, competitionName = '') {
  const issued = entry.registrationId
    ? await Registration.findById(entry.registrationId)
    : order?.orderId ? await Registration.findOne({ payment_order_id: order.orderId }) : null;
  if (issued && entry.status !== 'paid') {
    entry.status = 'paid'; entry.registrationId = issued._id; await entry.save();
  }
  return publicState(entry, order, issued, competitionName);
}

exports.createAssistedRegistration = async (req, res) => {
  try {
    if (!isMindSparkFestId(req.festId)) return res.status(404).json({ success: false, message: 'MindSpark only' });
    const submissionKey = clean(req.body.submissionKey, 100);
    if (submissionKey.length < 8) return res.status(400).json({ success: false, message: 'Invalid submission key' });
    let entry = await DeskEntry.findOne({ fest: req.festId, submissionKey }).select('+paymentToken');
    if (entry) {
      const [order, competition] = await Promise.all([
        entry.paymentOrderId ? PaymentOrder.findOne({ orderId: entry.paymentOrderId }) : null,
        Competition.findById(entry.competitionId).select('name').lean(),
      ]);
      return res.json({
        success: true,
        ...(await responseFor(entry, order, competition?.name || '')),
      });
    }

    const competition = await Competition.findOne({ _id: req.body.competitionId, fest: req.festId }).populate('fest');
    if (!competition) return res.status(404).json({ success: false, message: 'Competition not found' });

    const name = clean(req.body.name, 100);
    const phone = phoneDigits(req.body.phone);
    const email = clean(req.body.email, 180).toLowerCase();
    if (!name || phone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Captain name and valid 10-digit phone are required' });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ success: false, message: 'Captain email is required for confirmation and ticket delivery' });
    }

    const memberRows = normalizeMembers(req.body.members, name);
    const min = Math.max(1, Number(competition.teamSizeMin) || 1);
    const max = Math.max(min, Number(competition.teamSizeMax) || min);
    if (1 + memberRows.length < min || 1 + memberRows.length > max) {
      return res.status(400).json({ success: false, message: `Team size must be between ${min} and ${max}` });
    }
    const missingMemberEmail = memberRows.find((m) => !validEmail(m.email));
    if (missingMemberEmail) {
      return res.status(400).json({
        success: false,
        message: `Every teammate needs a valid email (missing for ${missingMemberEmail.name})`,
      });
    }
    for (const member of memberRows) {
      const memberDup = await findApprovedDuplicate({
        festId: req.festId,
        competitionId: competition._id,
        phone: member.phone,
        email: member.email,
      });
      if (memberDup) {
        return res.status(409).json({
          success: false,
          message: `${member.name} is already registered for this competition.`,
          registrationId: String(memberDup._id),
          alreadyRegistered: true,
        });
      }
    }

    resolveCompetitionTicketPrice(competition, clean(req.body.feeTierId, 80));

    let user = await User.findOne({ phoneNumber: phone });
    if (!user) user = await User.findOne({ email });
    if (user && user.email && validEmail(user.email) && user.email !== email && String(user.phoneNumber || '') !== phone) {
      return res.status(409).json({ success: false, message: 'This email is linked to a different phone number. Use the correct email or phone.' });
    }
    if (!user) {
      user = await User.create({
        name,
        email,
        phoneNumber: phone,
        password: crypto.randomBytes(24).toString('hex'),
        isVerified: true,
        signupMethod: 'password',
      });
    } else {
      let dirty = false;
      if (!user.phoneNumber) { user.phoneNumber = phone; dirty = true; }
      if (!user.email || String(user.email).endsWith('@crwdctrl.local')) { user.email = email; dirty = true; }
      if (dirty) await user.save();
    }

    const duplicate = await findApprovedDuplicate({
      festId: req.festId,
      competitionId: competition._id,
      userId: user._id,
      phone,
      email,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This participant is already registered for this competition.',
        registrationId: String(duplicate._id),
        alreadyRegistered: true,
      });
    }

    // One open payment QR per person across the whole fest (desk / bundle / website)
    const openCheckout = await findOpenMindSparkCheckout({
      festId: req.festId,
      userId: user._id,
      phone,
    });
    if (openCheckout) {
      const sameComp = openCheckout.kind === 'desk'
        && String(openCheckout.competitionId) === String(competition._id);
      if (sameComp && openCheckout.paymentToken) {
        const pendingEntry = await DeskEntry.findById(openCheckout.entryId).select('+paymentToken');
        const pendingOrder = await PaymentOrder.findOne({ orderId: openCheckout.orderId });
        if (pendingEntry && pendingOrder) {
          return res.json({
            success: true,
            reused: true,
            message: 'Reusing this person’s open payment QR — only one at a time.',
            ...(await responseFor(pendingEntry, pendingOrder, competition.name)),
          });
        }
      }
      const paymentUrl = openCheckout.kind === 'bundle' && openCheckout.paymentToken
        ? `${FRONTEND()}/mindspark/bundle-pay/${openCheckout.paymentToken}`
        : openCheckout.kind === 'desk' && openCheckout.paymentToken
          ? `${FRONTEND()}/desk-payment/${openCheckout.paymentToken}`
          : null;
      return res.status(409).json({
        success: false,
        openPayment: true,
        kind: openCheckout.kind,
        competitionName: openCheckout.competitionName,
        competitionId: openCheckout.competitionId || null,
        orderId: openCheckout.orderId,
        paymentUrl,
        paymentToken: openCheckout.paymentToken || null,
        amount: openCheckout.amount,
        message: `This person already has an open ${openCheckout.kind === 'bundle' ? 'bundle' : ''} payment QR for ${openCheckout.competitionName}. Finish that payment (or wait for it to expire) before starting another.`,
      });
    }

    const rosterMembers = [
      { name, email, phone, college: clean(req.body.college) },
      ...memberRows,
    ];
    entry = await DeskEntry.create({
      fest: req.festId,
      competitionId: competition._id,
      user: user._id,
      submissionKey,
      paymentToken: crypto.randomBytes(32).toString('hex'),
      responses: {
        full_name: name,
        phone,
        email,
        college: clean(req.body.college),
        team_name: clean(req.body.teamName),
        team_members: rosterMembers,
        team_size: rosterMembers.length,
        feeTierId: clean(req.body.feeTierId, 80),
        manual_entry: 'assisted_cashfree',
      },
    });
    const created = await createOrderForEntry({ entry, competition, user });
    return res.status(201).json({
      success: true,
      ...publicState(created.entry, created.order, created.issued, competition.name),
    });
  } catch (error) {
    console.error('[festDayAssisted.create]', error);
    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ success: false, message: error.message || 'Could not create assisted registration' });
  }
};

async function loadPublic(token) {
  const entry = await DeskEntry.findOne({ paymentToken: clean(token, 100) }).select('+paymentToken');
  if (!entry) return {};
  const [order, competition] = await Promise.all([
    entry.paymentOrderId ? PaymentOrder.findOne({ orderId: entry.paymentOrderId }) : null,
    Competition.findById(entry.competitionId).select('name').lean(),
  ]);
  return { entry, order, competition };
}

exports.getAssistedPayment = async (req, res) => {
  const { entry, order, competition } = await loadPublic(req.params.token);
  if (!entry) return res.status(404).json({ success: false, message: 'Payment link not found' });
  return res.json({ success: true, ...(await responseFor(entry, order, competition?.name || 'Competition')) });
};

exports.verifyAssistedPayment = async (req, res) => {
  try {
    const { entry, order, competition } = await loadPublic(req.params.token);
    if (!entry) return res.status(404).json({ success: false, message: 'Payment link not found' });
    if (order && entry.status !== 'paid') {
      const result = await verifyCashfreePayment({ orderId: order.orderId, paymentId: order.paymentId || undefined });
      if (result.verified) {
        order.status = 'PAID'; if (result.paymentId) order.paymentId = String(result.paymentId); await order.save();
        const { fulfillFestCompetitionFromPaidOrder } = require('../services/festCompetitionPaymentFulfillment');
        await fulfillFestCompetitionFromPaidOrder(order);
      } else if (['failed', 'cancelled'].includes(result.status)) {
        order.status = result.status === 'cancelled' ? 'EXPIRED' : 'FAILED'; await order.save();
        entry.status = order.status === 'EXPIRED' ? 'expired' : 'failed'; await entry.save();
        if (order.orderTags?.slotReservationToken) await releaseCompetitionSlot(order.orderTags.slotReservationToken).catch(() => {});
      }
    }
    const freshOrder = order ? await PaymentOrder.findById(order._id) : null;
    const freshEntry = await DeskEntry.findById(entry._id).select('+paymentToken');
    return res.json({ success: true, ...(await responseFor(freshEntry, freshOrder, competition?.name || 'Competition')) });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not verify payment' });
  }
};

exports.reissueAssistedPayment = async (req, res) => {
  try {
    const { entry, order } = await loadPublic(req.params.token);
    if (!entry) return res.status(404).json({ success: false, message: 'Payment link not found' });
    const timedOut = order?.status === 'PENDING' && Date.now() - new Date(order.createdAt).getTime() >= ORDER_TTL_MS;
    if (entry.status === 'paid' || !order || (order.status === 'PENDING' && !timedOut)) {
      const competition = await Competition.findById(entry.competitionId).select('name').lean();
      return res.json({ success: true, ...(await responseFor(entry, order, competition?.name || '')) });
    }
    if (timedOut) {
      order.status = 'EXPIRED';
      await order.save();
      if (order.orderTags?.slotReservationToken) await releaseCompetitionSlot(order.orderTags.slotReservationToken).catch(() => {});
    }
    // Keep draft on the retired order so ops can recover, but mark retired so late CF pay refunds instead of double-issuing.
    await PaymentOrder.updateOne(
      { _id: order._id, status: { $in: ['FAILED', 'EXPIRED'] } },
      {
        $set: {
          'orderTags.retired': true,
          'orderTags.retiredAt': new Date().toISOString(),
        },
      },
    );
    const competition = await Competition.findById(entry.competitionId).populate('fest');
    const user = await User.findById(entry.user);
    entry.status = 'pending';
    const created = await createOrderForEntry({ entry, competition, user });
    if (created.order?.orderId) {
      await PaymentOrder.updateOne(
        { _id: order._id },
        { $set: { 'orderTags.supersededBy': created.order.orderId } },
      ).catch(() => {});
    }
    return res.json({ success: true, ...publicState(created.entry, created.order, created.issued, competition.name) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Could not reissue payment' });
  }
};

exports._test = { publicState, ORDER_TTL_MS, phoneDigits, normalizeMembers, validEmail, findApprovedDuplicate };
