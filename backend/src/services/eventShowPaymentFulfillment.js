const User = require('../model/usermodel');
const PaymentOrder = require('../model/payment_order_model');
const EventShow = require('../model/event_show_model');
const EventShowRegistration = require('../model/event_show_registration_model');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { buildEventPriceBreakdown } = require('../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../utils/trekRegistrationFee');
const { scheduleRegistrationNotification } = require('../controllers/registration/helpers');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('./emailService');
const { logger } = require('../utils/logger');

function sanitizeRegistrationDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const values = raw.values && typeof raw.values === 'object' ? raw.values : raw.responses;
  if (!values || typeof values !== 'object') return null;
  const clean = {};
  for (const [key, value] of Object.entries(values)) {
    if (key.endsWith('_file')) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;
    if (
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
      || Array.isArray(value)
    ) {
      clean[key] = value;
    }
  }
  return {
    values: clean,
    tierId: raw.tierId ? String(raw.tierId).trim() : '',
    couponCode: raw.couponCode ? String(raw.couponCode).trim().toUpperCase() : '',
    eventShowId: raw.eventShowId ? String(raw.eventShowId).trim() : '',
  };
}

/**
 * After Cashfree marks an event_show order PAID, create the EventShowRegistration
 * from the draft stored on the order (or overrides). Idempotent by payment_order_id.
 */
async function fulfillEventShowFromPaidOrder(paymentOrderInput, overrides = {}) {
  const orderId = paymentOrderInput?.orderId || paymentOrderInput;
  if (!orderId) return { ok: false, error: 'Missing order id' };

  const paymentOrder = typeof paymentOrderInput === 'object' && paymentOrderInput.orderId
    ? paymentOrderInput
    : await PaymentOrder.findOne({ orderId: String(orderId) });

  if (!paymentOrder) return { ok: false, error: 'Payment order not found' };
  if (paymentOrder.entityType !== 'event_show') {
    return { ok: false, skipped: true, error: 'Not an event_show order' };
  }

  // Client verify / webhook race: Cashfree may be PAID before our Mongo row is.
  if (String(paymentOrder.status || '').toUpperCase() !== 'PAID') {
    if (overrides.markPaid) {
      paymentOrder.status = 'PAID';
      if (overrides.paymentId) paymentOrder.paymentId = String(overrides.paymentId);
      await paymentOrder.save().catch(() => {});
    } else {
      return { ok: false, error: 'Payment order is not PAID' };
    }
  }

  const userId = overrides.userId || paymentOrder.userId;
  if (!userId) return { ok: false, error: 'Missing user on payment order' };

  const storedDraft = sanitizeRegistrationDraft(paymentOrder.orderTags?.registrationDraft);
  const overrideDraft = sanitizeRegistrationDraft(overrides.registrationDraft || {
    values: overrides.responses,
    tierId: overrides.tierId,
    couponCode: overrides.couponCode,
    eventShowId: overrides.eventShowId,
  });
  const draft = overrideDraft || storedDraft;
  if (!draft || !Object.keys(draft.values || {}).length) {
    return { ok: false, error: 'No registration draft available for this payment' };
  }

  const eventShowId = paymentOrder.entityId
    || draft.eventShowId
    || paymentOrder.orderTags?.eventShowId;
  if (!eventShowId) return { ok: false, error: 'Missing event id' };

  const { findByIdOrSlug } = require('../utils/slug');
  const eventShow = await findByIdOrSlug(EventShow, eventShowId, {
    pickName: (row) => row.title || row.displayName || '',
    lean: false,
  });
  if (!eventShow) return { ok: false, error: 'Event not found' };

  const payment_order_id = paymentOrder.orderId;
  const payment_id = paymentOrder.paymentId || overrides.paymentId || null;

  const alreadyPaid = await EventShowRegistration.findOne({
    eventShow: eventShow._id,
    user: userId,
    $or: [
      { payment_order_id },
      { 'additionalEntries.payment_order_id': payment_order_id },
    ],
  });
  if (alreadyPaid) {
    return {
      ok: true,
      alreadyCompleted: true,
      registration: alreadyPaid,
      eventShow,
      addedToExisting: Boolean(alreadyPaid.reRegistrationCount),
    };
  }

  let responses = { ...(draft.values || {}) };
  let tierId = String(overrides.tierId || draft.tierId || paymentOrder.orderTags?.tierId || '').trim();

  let ticketPrice = Number(eventShow.ticketPrice) || 0;
  let selectedTier = null;
  if (eventShow.pricingMode === 'tiers') {
    const { resolveSportsPerPersonFee } = require('../utils/sportsPricing');
    try {
      const priced = resolveSportsPerPersonFee(
        { ...(eventShow.toObject?.() || eventShow), registrationFee: eventShow.ticketPrice },
        tierId,
      );
      ticketPrice = priced.fee;
      selectedTier = priced.tier;
    } catch (tierErr) {
      return { ok: false, error: tierErr.message || 'Invalid registration package' };
    }
  }

  const platformFeePercent = resolveTrekPlatformFeePercent(eventShow.platformFeePercent, 2.5);
  const paidAmount = Number(paymentOrder.totalAmount);
  const expectedAmount = buildEventPriceBreakdown(ticketPrice, platformFeePercent).totalAmount;
  // Prefer amount actually collected on the order (includes coupon).
  const entryAmount = Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : expectedAmount;

  if (draft.couponCode) responses.coupon_code = draft.couponCode;
  if (selectedTier?.name) responses.package_name = selectedTier.name;

  const user = await User.findById(userId);
  const now = new Date();
  const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const formEmail = String(responses.email || '').trim().toLowerCase();
  const accountEmail = String(user?.email || '').trim().toLowerCase();
  const matchEmail = formEmail || accountEmail;

  const orClauses = [{ user: userId }];
  if (matchEmail) {
    orClauses.push({ 'responses.email': new RegExp(`^${escapeRegex(matchEmail)}$`, 'i') });
  }
  const existing = await EventShowRegistration.findOne({
    eventShow: eventShow._id,
    $or: orClauses,
  }).sort({ submittedAt: 1, createdAt: 1 });

  let registration;
  let addedToExisting = false;

  if (existing) {
    existing.additionalEntries = existing.additionalEntries || [];
    existing.additionalEntries.push({
      tierId: selectedTier?.id || null,
      tierName: selectedTier?.name || null,
      amountPaid: entryAmount,
      paymentStatus: 'paid',
      payment_gateway: 'cashfree',
      paymentScreenshotUrl: '',
      transactionId: '',
      payment_order_id,
      payment_id,
      responses: { ...responses },
      status: 'approved',
      submittedAt: now,
    });
    existing.reRegistrationCount = existing.additionalEntries.length;
    existing.amountPaid = Number(existing.amountPaid || 0) + entryAmount;
    if (existing.status !== 'approved') existing.status = 'approved';
    await existing.save();
    registration = existing;
    addedToExisting = true;
  } else {
    registration = new EventShowRegistration({
      eventShow: eventShow._id,
      user: userId,
      responses,
      status: 'approved',
      payment_order_id,
      payment_id,
      payment_gateway: 'cashfree',
      paymentStatus: 'paid',
      paymentScreenshotUrl: '',
      transactionId: '',
      amountPaid: entryAmount,
      tierId: selectedTier?.id || null,
      tierName: selectedTier?.name || null,
      additionalEntries: [],
      reRegistrationCount: 0,
      submittedAt: now,
    });
    await registration.save();
  }

  consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});

  scheduleRegistrationNotification(userId, {
    title: addedToExisting ? 'Registration Updated!' : 'Registration Confirmed!',
    message: addedToExisting
      ? `Another package was added to your booking for ${eventShow.title}.`
      : `You've successfully registered for ${eventShow.title}.`,
    body: addedToExisting
      ? `Extra registration added for ${eventShow.title}`
      : `You've registered for ${eventShow.title}`,
    link: `/registration-details/${registration._id}?type=event`,
    metadata: { eventShowId: eventShow._id, registrationId: registration._id },
  });

  setImmediate(async () => {
    try {
      if (user?.email) {
        const eventTicketLink = `/registration-details/${registration._id}?type=event`;
        await sendRegistrationThankYouEmail(user.email, user.name, eventShow.title, {
          type: 'event',
          ticketLink: eventTicketLink,
        }).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email,
          user.name,
          eventShow.title,
          null,
          registration._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          {
            status: 'paid',
            method: 'cashfree',
            type: 'event',
            ticketLink: eventTicketLink,
          },
        ).catch(() => {});
      }

      const sheetsUrl = eventShow.registration?.googleSheetsUrl;
      if (sheetsUrl) {
        try {
          const { appendToEventGoogleSheets } = require('./googleSheetsService');
          let formSchema = [];
          const formType = eventShow.registration?.formType || 'SINGLE_STEP';
          if (formType === 'MULTI_STEP') {
            formSchema = (eventShow.registration?.steps || []).reduce(
              (all, step) => all.concat(step.fields || []),
              [],
            );
          } else {
            formSchema = eventShow.registration?.formSchema || [];
          }
          await appendToEventGoogleSheets(
            sheetsUrl,
            responses,
            {
              eventName: eventShow.title,
              registrationId: registration._id,
              amountPaid: entryAmount,
              paymentId: payment_id || '',
              paymentStatus: 'paid',
              tierName: selectedTier?.name || '',
              tierId: selectedTier?.id || '',
              reRegistration: addedToExisting,
              reRegistrationCount: registration.reRegistrationCount || 0,
            },
            {
              name: responses.name || responses.leader_name || user?.name || '',
              email: responses.email || user?.email || '',
              phone: responses.phone || user?.phoneNumber || user?.phone || '',
            },
            formSchema,
          );
        } catch (sheetsErr) {
          logger.error('❌ Event Google Sheets sync (fulfill) error:', sheetsErr.message);
        }
      }
    } catch (bgErr) {
      logger.error('❌ event fulfill background error:', bgErr.message);
    }
  });

  logger.debug('✅ EventShow registration fulfilled from payment:', payment_order_id, registration._id);

  return {
    ok: true,
    alreadyCompleted: false,
    registration,
    eventShow,
    addedToExisting,
    amountPaid: registration.amountPaid,
  };
}

module.exports = {
  sanitizeRegistrationDraft,
  fulfillEventShowFromPaidOrder,
};
