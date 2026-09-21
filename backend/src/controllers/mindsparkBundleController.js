const crypto = require('crypto');
const Bundle = require('../model/mindspark_bundle_model');
const Competition = require('../model/competition_model');
const PaymentOrder = require('../model/payment_order_model');
const User = require('../model/usermodel');
const { FEST_ID, BUNDLE_COMPETITION_IDS, DISCOUNT_PERCENT, BUNDLE_SIZE, BUNDLE_GROUP, isBundleEligible, groupFor } = require('../modules/fest/plugins/mindsparkBundle');
const { resolveCompetitionTicketPrice } = require('../utils/competitionFeeTiers');
const { assertCompetitionAcceptsRegistration } = require('../utils/competitionSlots');
const { acquireCompetitionSlot, attachReservationToOrder, releaseCompetitionSlot } = require('../services/competitionSlotReservationService');
const {
  createCashfreeOrder,
  verifyCashfreePayment,
  getCashfreeClientMode,
  firstValidCustomerPhone,
} = require('../services/cashfreeService');
const { fulfillMindSparkBundle } = require('../services/mindsparkBundleService');

const TTL = 30 * 60 * 1000;
const FRONTEND = () => String(
  process.env.PRODUCTION_FRONTEND_URL
  || process.env.PUBLIC_FRONTEND_URL
  || process.env.FRONTEND_URL
  || 'https://www.crwdctrl.in',
).replace(/\/$/, '');
const PAYABLE_RATIO = (100 - DISCOUNT_PERCENT) / 100;
const ORDER_NOTE = `MindSpark Any ${BUNDLE_SIZE} Bundle (${DISCOUNT_PERCENT}% off)`;
const PLACEHOLDER_PHONE = '9999999999';
const clean = (v, n = 180) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, n);
const phone = v => String(v || '').replace(/\D/g, '').slice(-10);
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v).toLowerCase());
const isRealPhone = (v) => {
  const digits = phone(v);
  return digits.length === 10 && digits !== PLACEHOLDER_PHONE;
};

/** Prefer form / roster WhatsApp over account placeholder (9999999999). */
function resolveBundlePhone(bundle, user, extraPhone = '') {
  const rosterPhones = (bundle?.items || []).flatMap((item) => {
    const roster = item?.roster && typeof item.roster === 'object' ? item.roster : {};
    const members = Array.isArray(roster.team_members) ? roster.team_members : [];
    return [
      roster.phone,
      roster.mobile,
      ...members.map((m) => m?.phone || m?.mobile),
    ];
  });
  return firstValidCustomerPhone([
    extraPhone,
    ...rosterPhones,
    user?.phoneNumber,
  ]);
}

function serialize(bundle, order) {
  return {
    bundleId: String(bundle._id), status: bundle.status, subtotal: bundle.subtotal,
    discountPercent: bundle.discountPercent, discountAmount: bundle.discountAmount,
    amount: bundle.totalAmount, orderId: order?.orderId || bundle.activeOrderId,
    paymentSessionId: order?.status === 'PENDING' && bundle.expiresAt > new Date() ? order.paymentSessionId : null,
    cashfreeMode: getCashfreeClientMode(), expiresAt: bundle.expiresAt,
    tickets: [],
  };
}

async function serializeWithTickets(bundle, order) {
  const base = serialize(bundle, order);
  if (bundle.status !== 'paid') return base;
  const ids = (bundle.items || []).map((i) => i.registrationId).filter(Boolean);
  const Registration = require('../model/registration_model');
  const regs = ids.length
    ? await Registration.find({ _id: { $in: ids } }).select('_id qrCodeData').lean()
    : [];
  const byId = new Map(regs.map((r) => [String(r._id), r]));
  base.tickets = (bundle.items || []).map((i) => {
    const reg = byId.get(String(i.registrationId || ''));
    return {
      competitionName: i.competitionName,
      registrationId: i.registrationId,
      ticketUrl: i.registrationId ? `${FRONTEND()}/qr-ticket/${i.registrationId}` : null,
      ticketQr: reg?.qrCodeData || null,
    };
  });
  return base;
}

async function competitions() {
  const list = await Competition.find({ _id: { $in: BUNDLE_COMPETITION_IDS }, fest: FEST_ID })
    .select('name feeAmount feeTiers registrationFee teamSizeMin teamSizeMax registration.personFields slotsAllotted registrationsOpen')
    .lean();
  return list.map((c) => ({
    ...c,
    personFields: Array.isArray(c.registration?.personFields) ? c.registration.personFields : [],
  }));
}

function subcategoryFieldOf(competition) {
  const fields = Array.isArray(competition?.registration?.personFields)
    ? competition.registration.personFields
    : (Array.isArray(competition?.personFields) ? competition.personFields : []);
  return fields.find((f) => String(f.key || '').toLowerCase() === 'subcategory')
    || fields.find((f) => /sub\s*categor/i.test(String(f.label || '')))
    || null;
}

function resolveSubcategory(competition, rawValue) {
  const field = subcategoryFieldOf(competition);
  if (!field) return '';
  const options = Array.isArray(field.options) ? field.options.map((o) => String(o || '').trim()).filter(Boolean) : [];
  const wanted = clean(rawValue, 80);
  if (!wanted) {
    if (field.required === false) return '';
    const e = new Error(`${competition.name}: select a subcategory.`);
    e.status = 400;
    throw e;
  }
  const hit = options.find((opt) => opt.toLowerCase() === wanted.toLowerCase());
  if (!hit) {
    const e = new Error(`${competition.name}: choose a valid subcategory (${options.join(', ')}).`);
    e.status = 400;
    throw e;
  }
  return hit;
}

exports.offer = async (_req, res) => {
  const list = await competitions();
  const shaped = list.map(c => ({ ...c, group: groupFor(c._id) }));
  res.json({
    success: true,
    festId: FEST_ID,
    discountPercent: DISCOUNT_PERCENT,
    bundleSize: BUNDLE_SIZE,
    competitions: shaped,
    // Back-compat for older clients
    technical: shaped,
    nonTechnical: shaped,
  });
};

async function validateItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length !== BUNDLE_SIZE) {
    const e = new Error(`Select exactly ${BUNDLE_SIZE} different competitions from the bundle list.`);
    e.status = 400;
    throw e;
  }
  const ids = rawItems.map(i => String(i.competitionId || ''));
  if (new Set(ids).size !== BUNDLE_SIZE || ids.some(id => !isBundleEligible(id))) {
    const e = new Error(`Bundle must contain ${BUNDLE_SIZE} different competitions from the approved list.`);
    e.status = 400;
    throw e;
  }
  const docs = await Competition.find({ _id: { $in: ids }, fest: FEST_ID }).populate('fest');
  if (docs.length !== BUNDLE_SIZE) { const e = new Error('One or more competitions are unavailable.'); e.status = 404; throw e; }
  const byId = new Map(docs.map(c => [String(c._id), c]));
  return Promise.all(rawItems.map(async raw => {
    const competition = byId.get(String(raw.competitionId)); await assertCompetitionAcceptsRegistration(competition);
    const roster = raw.roster && typeof raw.roster === 'object' ? raw.roster : {};
    if (!clean(roster.full_name, 100) || phone(roster.phone).length !== 10 || !validEmail(roster.email)) { const e = new Error(`${competition.name}: team leader name, valid WhatsApp number, and email are required.`); e.status = 400; throw e; }
    const members = Array.isArray(roster.team_members)
      ? roster.team_members.map((entry) => {
          if (typeof entry === 'string') {
            const name = clean(entry, 100);
            return name ? { name, email: '' } : null;
          }
          if (entry && typeof entry === 'object') {
            const name = clean(entry.name || entry.full_name, 100);
            if (!name) return null;
            const member = { name };
            const email = clean(entry.email, 120).toLowerCase();
            const mobile = phone(entry.phone || entry.mobile);
            const college = clean(entry.college || entry.college_name, 120);
            member.email = email;
            if (mobile.length === 10) member.phone = mobile;
            if (college) member.college = college;
            return member;
          }
          return null;
        }).filter(Boolean)
      : [];
    const min = Math.max(1, Number(competition.teamSizeMin) || 1); const max = Math.max(min, Number(competition.teamSizeMax) || min);
    if (members.length < min || members.length > max) { const e = new Error(`${competition.name}: team size must be ${min === max ? min : `${min}-${max}`}.`); e.status = 400; throw e; }
    const missingEmail = members.find((m) => !validEmail(m.email));
    if (missingEmail) {
      const e = new Error(`${competition.name}: every participant needs a valid email (missing for ${missingEmail.name}).`);
      e.status = 400;
      throw e;
    }
    const priced = resolveCompetitionTicketPrice(competition, clean(raw.feeTierId, 80));
    const subcategory = resolveSubcategory(
      competition,
      raw.subcategory || roster.subcategory || roster.team_responses?.subcategory,
    );
    const rosterOut = {
      ...roster,
      team_members: members,
      team_size: members.length,
      feeTierId: priced.tier?.id || '',
    };
    if (subcategory) {
      rosterOut.subcategory = subcategory;
      rosterOut.team_responses = {
        ...(roster.team_responses && typeof roster.team_responses === 'object' ? roster.team_responses : {}),
        subcategory,
      };
    }
    return {
      competition,
      group: BUNDLE_GROUP,
      feeTierId: priced.tier?.id || '',
      subcategory,
      roster: rosterOut,
      originalAmount: priced.ticketPrice,
    };
  }));
}

exports.quote = async (req, res) => {
  try {
    const items = await validateItems(req.body.items);
    const subtotal = items.reduce((s, x) => s + x.originalAmount, 0);
    const totalAmount = Math.round(subtotal * PAYABLE_RATIO);
    res.json({
      success: true,
      subtotal,
      discountPercent: DISCOUNT_PERCENT,
      discountAmount: subtotal - totalAmount,
      totalAmount,
      items: items.map(x => ({ competitionId: x.competition._id, name: x.competition.name, amount: x.originalAmount })),
    });
  } catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
};

async function resolveCustomer(req, source) {
  const name = clean(req.body.customer?.name, 100);
  const mobile = phone(req.body.customer?.phone);
  const email = clean(req.body.customer?.email).toLowerCase();

  if (source === 'public') {
    const user = await User.findById(req.user.userId);
    if (!user) {
      const e = new Error('Please sign in again.');
      e.status = 401;
      throw e;
    }
    // Form WhatsApp wins over account placeholder / empty phone.
    if (!isRealPhone(mobile) && !isRealPhone(user.phoneNumber)) {
      const e = new Error('Team leader name, valid WhatsApp number, and email are required.');
      e.status = 400;
      throw e;
    }
    let dirty = false;
    if (isRealPhone(mobile) && phone(user.phoneNumber) !== mobile) {
      user.phoneNumber = mobile;
      dirty = true;
    }
    if (name && user.name !== name) {
      user.name = name;
      dirty = true;
    }
    if (email && validEmail(email) && String(user.email || '').toLowerCase() !== email) {
      user.email = email;
      dirty = true;
    }
    if (dirty) await user.save();
    return user;
  }

  if (!name || !isRealPhone(mobile) || !validEmail(email)) {
    const e = new Error('Team leader name, valid WhatsApp number, and email are required.');
    e.status = 400;
    throw e;
  }
  let user = await User.findOne({ $or: [{ phoneNumber: mobile }, { email }] });
  if (!user) {
    user = await User.create({
      name,
      phoneNumber: mobile,
      email,
      password: crypto.randomBytes(24).toString('hex'),
      isVerified: true,
      signupMethod: 'password',
    });
    return user;
  }
  let dirty = false;
  if (name && user.name !== name) {
    user.name = name;
    dirty = true;
  }
  // Email match can pull an old account still stuck on Cashfree placeholder phone.
  if (!isRealPhone(user.phoneNumber) || phone(user.phoneNumber) !== mobile) {
    user.phoneNumber = mobile;
    dirty = true;
  }
  if (dirty) await user.save();
  return user;
}

async function restoreBundleReservations(bundle) {
  const docs = await Competition.find({ _id: { $in: bundle.items.map((item) => item.competitionId) }, fest: FEST_ID }).populate('fest');
  const byId = new Map(docs.map((competition) => [String(competition._id), competition]));
  const acquired = [];
  try {
    for (const item of bundle.items) {
      const reservation = await acquireCompetitionSlot({ competition: byId.get(String(item.competitionId)), userId: bundle.user });
      acquired.push(reservation);
      item.reservationToken = reservation?.token || '';
    }
    bundle.expiresAt = new Date(Date.now() + TTL);
    await bundle.save();
    return acquired;
  } catch (error) {
    await Promise.all(acquired.filter(Boolean).map((row) => releaseCompetitionSlot(row.token).catch(() => {})));
    throw error;
  }
}

async function createOrderForBundle(bundle, user) {
  const customerPhone = resolveBundlePhone(bundle, user);
  if (!customerPhone) {
    const e = new Error('A valid 10-digit WhatsApp number is required for Cashfree payment.');
    e.status = 400;
    throw e;
  }
  let order;
  if (Number(bundle.totalAmount) <= 0) {
    order = await PaymentOrder.create({
      orderId: `msb_free_${bundle._id}`,
      entityType: 'competition_bundle', entityId: bundle._id, userId: user._id,
      ticketPrice: 0, amountBeforeDiscount: 0, amountAfterDiscount: 0, totalAmount: 0,
      status: 'PAID', gateway: 'cashfree', customerEmail: user.email, customerPhone,
      orderTags: { bundleId: String(bundle._id), festId: FEST_ID, zeroFee: true },
    });
  } else {
    const cashfree = await createCashfreeOrder({
      orderAmount: bundle.totalAmount,
      customerDetails: {
        customerId: String(user._id),
        customerName: user.name,
        customerEmail: user.email,
        customerPhone,
      },
      orderMeta: { return_url: `${FRONTEND()}/mindspark/bundle-pay/${bundle.paymentToken}?returned=1` },
      orderNote: ORDER_NOTE,
      orderTags: { entityType: 'competition_bundle', bundleId: String(bundle._id) },
    });
    order = await PaymentOrder.create({
      orderId: cashfree.order_id,
      paymentSessionId: cashfree.payment_session_id,
      entityType: 'competition_bundle',
      entityId: bundle._id,
      userId: user._id,
      ticketPrice: bundle.subtotal,
      couponDiscount: bundle.discountAmount,
      amountBeforeDiscount: bundle.subtotal,
      amountAfterDiscount: bundle.totalAmount,
      totalAmount: bundle.totalAmount,
      status: 'PENDING',
      customerEmail: user.email,
      customerPhone,
      orderTags: { bundleId: String(bundle._id), festId: FEST_ID },
    });
  }
  bundle.activeOrderId = order.orderId;
  if (!bundle.orderIds.includes(order.orderId)) bundle.orderIds.push(order.orderId);
  await bundle.save();
  await Promise.all(bundle.items.map((item) => item.reservationToken).filter(Boolean).map((token) => attachReservationToOrder(token, order.orderId)));
  if (order.status === 'PAID') await fulfillMindSparkBundle(order);
  return order;
}

exports.create = source => async (req, res) => {
  const reservations = [];
  try {
    const key = clean(req.body.submissionKey, 100); if (key.length < 8) return res.status(400).json({ success: false, message: 'Invalid submission key.' });
    const user = await resolveCustomer(req, source);
    let existing = await Bundle.findOne({ source, user: user._id, submissionKey: key }).select('+paymentToken');
    if (existing) {
      let order = existing.activeOrderId
        ? await PaymentOrder.findOne({ orderId: existing.activeOrderId })
        : await PaymentOrder.findOne({ entityType: 'competition_bundle', entityId: existing._id }).sort({ createdAt: -1 });
      if (order && !existing.activeOrderId) {
        existing.activeOrderId = order.orderId;
        if (!existing.orderIds.includes(order.orderId)) existing.orderIds.push(order.orderId);
        await existing.save();
      }
      if (!order) {
        const restored = await restoreBundleReservations(existing);
        reservations.push(...restored);
        order = await createOrderForBundle(existing, user);
        existing = await Bundle.findById(existing._id).select('+paymentToken');
      }
      if (order.status === 'PAID' && existing.status !== 'paid' && existing.status !== 'paid_review') {
        await fulfillMindSparkBundle(order);
        existing = await Bundle.findById(existing._id).select('+paymentToken');
      }
      return res.json({ success: true, paymentUrl: `${FRONTEND()}/mindspark/bundle-pay/${existing.paymentToken}`, ...await serializeWithTickets(existing, order) });
    }
    const valid = await validateItems(req.body.items);
    const { findOpenMindSparkCheckout } = require('../utils/openMindSparkCheckout');
    const openCheckout = await findOpenMindSparkCheckout({
      festId: FEST_ID,
      userId: user._id,
      phone: user.phoneNumber,
    });
    if (openCheckout) {
      await Promise.all(reservations.filter(Boolean).map((r) => releaseCompetitionSlot(r.token).catch(() => {})));
      if (openCheckout.kind === 'bundle' && openCheckout.paymentToken) {
        const existingBundle = await Bundle.findById(openCheckout.bundleId).select('+paymentToken');
        const order = await PaymentOrder.findOne({ orderId: openCheckout.orderId });
        return res.json({
          success: true,
          reused: true,
          message: 'Reusing this person’s open bundle payment QR — only one at a time.',
          paymentUrl: `${FRONTEND()}/mindspark/bundle-pay/${openCheckout.paymentToken}`,
          ...await serializeWithTickets(existingBundle, order),
        });
      }
      const paymentUrl = openCheckout.kind === 'desk' && openCheckout.paymentToken
        ? `${FRONTEND()}/desk-payment/${openCheckout.paymentToken}`
        : null;
      return res.status(409).json({
        success: false,
        openPayment: true,
        kind: openCheckout.kind,
        competitionName: openCheckout.competitionName,
        orderId: openCheckout.orderId,
        paymentUrl,
        message: `This person already has an open payment for ${openCheckout.competitionName}. Finish that payment before starting a bundle.`,
      });
    }
    for (const item of valid) reservations.push(await acquireCompetitionSlot({ competition: item.competition, userId: user._id }));
    const subtotal = valid.reduce((s, x) => s + x.originalAmount, 0);
    const totalAmount = Math.round(subtotal * PAYABLE_RATIO);
    const token = crypto.randomBytes(32).toString('hex');
    const bundle = await Bundle.create({
      fest: FEST_ID,
      source,
      user: user._id,
      createdByOrganizer: source === 'desk' ? req.organizerId : null,
      submissionKey: key,
      paymentToken: token,
      subtotal,
      discountPercent: DISCOUNT_PERCENT,
      discountAmount: subtotal - totalAmount,
      totalAmount,
      expiresAt: new Date(Date.now() + TTL),
      items: valid.map((x, i) => ({
        competitionId: x.competition._id,
        competitionName: x.competition.name,
        group: x.group,
        feeTierId: x.feeTierId,
        roster: x.roster,
        originalAmount: x.originalAmount,
        reservationToken: reservations[i]?.token || '',
      })),
    });
    const order = await createOrderForBundle(bundle, user);
    const fresh = await Bundle.findById(bundle._id).select('+paymentToken');
    res.status(201).json({ success: true, paymentUrl: `${FRONTEND()}/mindspark/bundle-pay/${token}`, ...await serializeWithTickets(fresh, order) });
  } catch (e) { await Promise.all(reservations.filter(Boolean).map(r => releaseCompetitionSlot(r.token).catch(() => {}))); res.status(e.status || (e.code === 11000 ? 409 : 500)).json({ success: false, message: e.message || 'Could not create bundle.' }); }
};

async function load(token) { const bundle = await Bundle.findOne({ paymentToken: clean(token, 100) }).select('+paymentToken'); const order = bundle?.activeOrderId ? await PaymentOrder.findOne({ orderId: bundle.activeOrderId }) : null; return { bundle, order }; }
exports.payment = async (req, res) => { const { bundle, order } = await load(req.params.token); if (!bundle) return res.status(404).json({ success: false, message: 'Bundle not found.' }); res.json({ success: true, ...await serializeWithTickets(bundle, order) }); };
exports.verify = async (req, res) => {
  try {
    const { bundle, order } = await load(req.params.token);
    if (!bundle || !order) return res.status(404).json({ success: false, message: 'Bundle not found.' });
    let fulfillment = null;
    if (bundle.status === 'paid_review') {
      return res.json({ success: true, paidReview: true, issued: false, ...await serializeWithTickets(bundle, order) });
    }
    if (order.status === 'PAID') {
      fulfillment = await fulfillMindSparkBundle(order);
    } else if (bundle.status !== 'paid') {
      const verified = await verifyCashfreePayment({ orderId: order.orderId, paymentId: order.paymentId || undefined });
      if (verified.verified) {
        order.status = 'PAID';
        order.paymentId = verified.paymentId || order.paymentId;
        await order.save();
        fulfillment = await fulfillMindSparkBundle(order);
      } else if (['failed', 'cancelled'].includes(verified.status)) {
        order.status = verified.status === 'failed' ? 'FAILED' : 'EXPIRED';
        bundle.status = verified.status === 'failed' ? 'failed' : 'expired';
        await Promise.all(bundle.items.map((item) => releaseCompetitionSlot(item.reservationToken).catch(() => {})));
        await order.save();
        await bundle.save();
      } else if (bundle.fulfillmentState !== 'processing') {
        bundle.status = 'pending';
        await bundle.save();
      }
    }
    const fresh = await Bundle.findById(bundle._id).select('+paymentToken');
    res.json({ success: true, issued: fresh.status === 'paid', paidReview: fresh.status === 'paid_review', inProgress: fulfillment?.inProgress || fresh.fulfillmentState === 'processing', ...await serializeWithTickets(fresh, await PaymentOrder.findById(order._id)) });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Could not verify payment.' });
  }
};

exports.reissue = async (req, res) => {
  const reservations = [];
  try {
    const { bundle, order } = await load(req.params.token);
    if (!bundle || !order) return res.status(404).json({ success: false, message: 'Bundle not found.' });
    const timedOut = order.status === 'PENDING' && bundle.expiresAt <= new Date();
    if (bundle.status === 'paid' || (order.status === 'PENDING' && !timedOut)) return res.json({ success: true, ...await serializeWithTickets(bundle, order) });
    if (!['FAILED','EXPIRED'].includes(order.status) && !timedOut) return res.status(409).json({ success: false, message: 'The existing payment is still being confirmed.' });
    order.status = timedOut ? 'EXPIRED' : order.status; order.orderTags = { ...(order.orderTags || {}), retired: true }; await order.save();
    const docs = await Competition.find({ _id: { $in: bundle.items.map(i => i.competitionId) }, fest: FEST_ID }).populate('fest');
    const byId = new Map(docs.map(c => [String(c._id), c]));
    for (const item of bundle.items) reservations.push(await acquireCompetitionSlot({ competition: byId.get(String(item.competitionId)), userId: bundle.user }));
    const user = await User.findById(bundle.user); const token = bundle.paymentToken;
    const customerPhone = resolveBundlePhone(bundle, user);
    if (!customerPhone) {
      return res.status(400).json({ success: false, message: 'A valid 10-digit WhatsApp number is required for Cashfree payment.' });
    }
    const cashfree = await createCashfreeOrder({
      orderAmount: bundle.totalAmount,
      customerDetails: {
        customerId: String(user._id),
        customerName: user.name,
        customerEmail: user.email,
        customerPhone,
      },
      orderMeta: { return_url: `${FRONTEND()}/mindspark/bundle-pay/${token}?returned=1` },
      orderNote: ORDER_NOTE,
      orderTags: { entityType: 'competition_bundle', bundleId: String(bundle._id) },
    });
    const replacement = await PaymentOrder.create({
      orderId: cashfree.order_id,
      paymentSessionId: cashfree.payment_session_id,
      entityType: 'competition_bundle',
      entityId: bundle._id,
      userId: bundle.user,
      ticketPrice: bundle.subtotal,
      couponDiscount: bundle.discountAmount,
      amountBeforeDiscount: bundle.subtotal,
      amountAfterDiscount: bundle.totalAmount,
      totalAmount: bundle.totalAmount,
      status: 'PENDING',
      customerEmail: user.email,
      customerPhone,
      orderTags: { bundleId: String(bundle._id), festId: FEST_ID },
    });
    bundle.items.forEach((item, i) => { item.reservationToken = reservations[i]?.token || ''; }); bundle.activeOrderId = replacement.orderId; bundle.orderIds.push(replacement.orderId); bundle.status = 'pending'; bundle.expiresAt = new Date(Date.now() + TTL); await bundle.save();
    await Promise.all(reservations.filter(Boolean).map(r => attachReservationToOrder(r.token, replacement.orderId)));
    res.json({ success: true, ...await serializeWithTickets(bundle, replacement) });
  } catch (e) { await Promise.all(reservations.filter(Boolean).map(r => releaseCompetitionSlot(r.token).catch(() => {}))); res.status(e.status || 500).json({ success: false, message: e.message || 'Could not create replacement payment.' }); }
};

exports._test = { validateItems, serialize, resolveBundlePhone, isRealPhone };
