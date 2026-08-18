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
const {
  sanitizeFestCompetitionDraft,
  draftToResponses,
} = require('../utils/festCompetitionDraft');
const { saveRegistrationIdempotent } = require('../utils/registrationIdempotency');

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
    const quotedTotal = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;
    const paidTotal = Number(paymentOrder.totalAmount);
    const competitionTotalAmount = Number.isFinite(paidTotal) && paidTotal >= 0
      ? paidTotal
      : quotedTotal;

    const draftResponses = draftToResponses(draft);
    if (paymentOrder.orderTags?.tierId) {
      draftResponses.feeTierId = paymentOrder.orderTags.tierId;
      if (paymentOrder.orderTags.tierName) {
        draftResponses.feeTierLabel = paymentOrder.orderTags.tierName;
        draftResponses['Student category'] = paymentOrder.orderTags.tierName;
      }
    }

    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: mergeRegistrationResponses(
        { name: user.name || '', email: user.email || '', phone: user.phoneNumber || '' },
        draftResponses,
      ),
      status: 'approved',
      payment_order_id,
      payment_id,
      payment_gateway: 'cashfree',
      paymentStatus: 'paid',
      amountPaid: competitionTotalAmount,
      submittedAt: new Date(),
    });

    const saved = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: competition.fest._id,
      competitionId: competition._id,
      user: userId,
    });
    if (!saved.created) {
      return { ok: true, registrationId: saved.registration._id, alreadyExists: true };
    }
    logger.debug('✅ Competition registration fulfilled from payment:', payment_order_id, saved.registration._id);

    setImmediate(async () => {
      try {
        await consumeCouponUsageForOrder({
          couponCode: paymentOrder.couponCode || draft.couponCode,
          userId,
          orderId: payment_order_id,
        });
        const ticketLink = `/registration-details/${registration._id}`;
        scheduleRegistrationNotification(userId, {
          title: 'Registration Confirmed!',
          message: `You've successfully registered for ${competition.name}.`,
          body: `You've registered for ${competition.name}`,
          link: ticketLink,
          metadata: {
            competitionId: competition._id,
            festId: competition.fest?._id,
            registrationId: registration._id,
          },
        });
        await sendRegistrationThankYouEmail(
          user.email,
          user.name,
          competition.fest?.festName || competition.name,
          { type: 'competition', ticketLink },
        ).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email,
          user.name,
          competition.fest?.festName || competition.name,
          competition.name,
          registration._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          {
            status: 'paid',
            method: 'cashfree',
            type: 'competition',
            ticketLink,
            groupLink: competition.registration?.whatsappGroupLink || '',
          },
        ).catch(() => {});
        const sheetsUrl = competition.fest?.registration?.googleSheetsUrl
          || competition.registration?.googleSheetsUrl;
        if (sheetsUrl) {
          await appendPaymentOnlyToSheets(sheetsUrl, {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber || '',
            amountPaid: competitionTotalAmount,
            paymentId: payment_id,
            entityName: competition.name,
            entityType: 'Competition',
          }).catch((e) => logger.error('❌ Sheets error (competition fulfill):', e.message));
        }
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

    const savedFest = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: fest._id,
      user: userId,
      competitionId: null,
    });
    if (!savedFest.created) {
      return { ok: true, registrationId: savedFest.registration._id, alreadyExists: true };
    }
    logger.debug('✅ Fest registration fulfilled from payment:', payment_order_id, savedFest.registration._id);

  setImmediate(async () => {
    try {
      await consumeCouponUsageForOrder({
        couponCode: paymentOrder.couponCode || draft.couponCode,
        userId,
        orderId: payment_order_id,
      });
      const ticketLink = `/registration-details/${registration._id}`;
      scheduleRegistrationNotification(userId, {
        title: 'Fest Registration Confirmed!',
        message: `You've successfully registered for ${fest.festName}.`,
        body: `You've registered for ${fest.festName}`,
        link: ticketLink,
        metadata: { festId: fest._id, registrationId: registration._id },
      });
      await sendRegistrationThankYouEmail(user.email, user.name, fest.festName, {
        type: 'fest',
        ticketLink,
      }).catch(() => {});
      await sendRegistrationConfirmationEmail(
        user.email,
        user.name,
        fest.festName,
        null,
        registration._id.toString(),
        new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        { status: 'paid', method: 'cashfree', type: 'fest', ticketLink },
      ).catch(() => {});
      const sheetsUrl = fest.registration?.googleSheetsUrl;
      if (sheetsUrl) {
        await appendPaymentOnlyToSheets(sheetsUrl, {
          name: user.name,
          email: user.email,
          phone: user.phoneNumber || '',
          amountPaid: festTotalAmount,
          paymentId: payment_id,
          entityName: fest.festName,
          entityType: 'Fest',
        }).catch((e) => logger.error('❌ Sheets error (fest fulfill):', e.message));
      }
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
