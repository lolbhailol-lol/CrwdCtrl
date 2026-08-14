const Registration = require('../model/registration_model');
const Competition = require('../model/competition_model');
const PaymentOrder = require('../model/payment_order_model');
const User = require('../model/usermodel');
const { buildPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../utils/trekRegistrationFee');
const {
  mergeRegistrationResponses,
  scheduleRegistrationNotification,
} = require('../controllers/registration/helpers');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('./emailService');
const { appendPaymentOnlyToSheets } = require('./googleSheetsService');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { logger } = require('../utils/logger');

function sanitizeFestCompetitionDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const formData = raw.formData && typeof raw.formData === 'object' ? raw.formData : raw.values;
  const stepData = raw.stepData && typeof raw.stepData === 'object' ? raw.stepData : null;

  const cleanForm = {};
  if (formData && typeof formData === 'object') {
    for (const [key, value] of Object.entries(formData)) {
      if (key.endsWith('_file')) continue;
      if (value === null || value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value)) continue;
      if (
        typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
        || Array.isArray(value)
      ) {
        cleanForm[key] = value;
      }
    }
  }

  const cleanSteps = {};
  if (stepData) {
    for (const [step, fields] of Object.entries(stepData)) {
      if (!fields || typeof fields !== 'object') continue;
      const slice = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key.endsWith('_file')) continue;
        if (value === null || value === undefined) continue;
        if (typeof value === 'object' && !Array.isArray(value)) continue;
        if (
          typeof value === 'string'
          || typeof value === 'number'
          || typeof value === 'boolean'
          || Array.isArray(value)
        ) {
          slice[key] = value;
        }
      }
      if (Object.keys(slice).length) cleanSteps[step] = slice;
    }
  }

  if (!Object.keys(cleanForm).length && !Object.keys(cleanSteps).length) return null;

  return {
    formData: cleanForm,
    stepData: cleanSteps,
    currentStep: raw.currentStep ?? 1,
    festId: raw.festId ? String(raw.festId).trim() : '',
    competitionId: raw.competitionId ? String(raw.competitionId).trim() : '',
    couponCode: raw.couponCode ? String(raw.couponCode).trim().toUpperCase() : '',
  };
}

function draftToResponses(draft) {
  if (!draft) return {};
  const merged = { ...(draft.formData || {}) };
  if (draft.stepData && typeof draft.stepData === 'object') {
    for (const fields of Object.values(draft.stepData)) {
      if (fields && typeof fields === 'object') Object.assign(merged, fields);
    }
  }
  return merged;
}

async function fulfillFestCompetitionFromPaidOrder(paymentOrderInput, overrides = {}) {
  const orderId = paymentOrderInput?.orderId || paymentOrderInput;
  if (!orderId) return { ok: false, error: 'Missing order id' };

  const paymentOrder = typeof paymentOrderInput === 'object' && paymentOrderInput.orderId
    ? paymentOrderInput
    : await PaymentOrder.findOne({ orderId: String(orderId) });

  if (!paymentOrder) return { ok: false, error: 'Payment order not found' };
  if (!['fest', 'competition'].includes(paymentOrder.entityType)) {
    return { ok: false, skipped: true, error: 'Not a fest/competition order' };
  }

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

  const storedDraft = sanitizeFestCompetitionDraft(paymentOrder.orderTags?.registrationDraft);
  const overrideDraft = sanitizeFestCompetitionDraft(overrides.registrationDraft);
  const draft = overrideDraft || storedDraft;
  if (!draft) return { ok: false, error: 'No registration draft available for this payment' };

  const payment_order_id = paymentOrder.orderId;
  const payment_id = paymentOrder.paymentId || overrides.paymentId || null;

  if (paymentOrder.entityType === 'competition') {
    const competitionId = paymentOrder.entityId || draft.competitionId;
    const competition = await Competition.findById(competitionId).populate('fest');
    if (!competition) return { ok: false, error: 'Competition not found' };

    const alreadyPaid = payment_order_id
      ? await Registration.findOne({
          payment_order_id,
          fest: competition.fest._id,
          competitionId: competition._id,
          user: userId,
        })
      : null;
    if (alreadyPaid) {
      return { ok: true, registrationId: alreadyPaid._id, alreadyExists: true };
    }

    const user = await User.findById(userId);
    if (!user) return { ok: false, error: 'User not found' };

    const competitionTicketPrice = parseTicketPrice(competition.feeAmount)
      || parseTicketPrice(competition.registrationFee);
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3);
    const competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;

    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: mergeRegistrationResponses(
        { name: user.name || '', email: user.email || '', phone: user.phoneNumber || '' },
        draftToResponses(draft),
      ),
      status: 'approved',
      payment_order_id,
      payment_id,
      payment_gateway: 'cashfree',
      paymentStatus: 'paid',
      amountPaid: competitionTotalAmount,
      submittedAt: new Date(),
    });

    await registration.save();
    logger.debug('✅ Competition registration fulfilled from payment:', payment_order_id, registration._id);

    setImmediate(async () => {
      try {
        await consumeCouponUsageForOrder({
          couponCode: paymentOrder.couponCode || draft.couponCode,
          userId,
          orderId: payment_order_id,
        });
        scheduleRegistrationNotification(registration, competition.fest, competition);
        await sendRegistrationThankYouEmail(user.email, user.name, competition.name);
        await sendRegistrationConfirmationEmail(user.email, user.name, competition.name, registration._id);
      } catch (bgErr) {
        logger.error('❌ competition fulfill background error:', bgErr.message);
      }
    });

    return { ok: true, registrationId: registration._id };
  }

  const festId = paymentOrder.entityId || draft.festId;
  const FestOrganizer = require('../model/fest_organizer_model');
  const fest = await FestOrganizer.findById(festId);
  if (!fest) return { ok: false, error: 'Fest not found' };

  const alreadyPaid = payment_order_id
    ? await Registration.findOne({
        payment_order_id,
        fest: fest._id,
        user: userId,
        competitionId: null,
      })
    : null;
  if (alreadyPaid) {
    return { ok: true, registrationId: alreadyPaid._id, alreadyExists: true };
  }

  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found' };

  const festPlatformFeePercent = resolveTrekPlatformFeePercent(fest.platformFeePercent, 3);
  const festTotalAmount = buildPriceBreakdown(fest.feeAmount, festPlatformFeePercent).totalAmount;

  const registration = new Registration({
    fest: fest._id,
    user: userId,
    responses: mergeRegistrationResponses(
      { name: user.name || '', email: user.email || '', phone: user.phoneNumber || '' },
      draftToResponses(draft),
    ),
    status: 'approved',
    payment_order_id,
    payment_id,
    payment_gateway: 'cashfree',
    paymentStatus: 'paid',
    amountPaid: festTotalAmount,
    submittedAt: new Date(),
  });

  await registration.save();
  logger.debug('✅ Fest registration fulfilled from payment:', payment_order_id, registration._id);

  setImmediate(async () => {
    try {
      await consumeCouponUsageForOrder({
        couponCode: paymentOrder.couponCode || draft.couponCode,
        userId,
        orderId: payment_order_id,
      });
      scheduleRegistrationNotification(registration, fest, null);
      await sendRegistrationThankYouEmail(user.email, user.name, fest.festName);
      await appendPaymentOnlyToSheets(fest, registration).catch(() => {});
    } catch (bgErr) {
      logger.error('❌ fest fulfill background error:', bgErr.message);
    }
  });

  return { ok: true, registrationId: registration._id };
}

module.exports = {
  sanitizeFestCompetitionDraft,
  fulfillFestCompetitionFromPaidOrder,
};
