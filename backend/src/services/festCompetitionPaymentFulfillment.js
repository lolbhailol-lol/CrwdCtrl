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
const { sendCompetitionRegistrationEmailForRecord } = require('./emailService');
const { appendPaymentOnlyToSheets } = require('./googleSheetsService');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { logger } = require('../utils/logger');
const {
  sanitizeFestCompetitionDraft,
  draftToResponses,
} = require('../utils/festCompetitionDraft');
const { normalizeLeadIdentityFromRoster } = require('../utils/rosterResponses');
const { saveRegistrationIdempotent } = require('../utils/registrationIdempotency');
const { cashfreeSettlementFields } = require('../utils/cashfreeGatewayFee');
const { assignStallCouponIfEligible } = require('../utils/assignStallCoupon');
const {
  findApprovedCompetitionDuplicate,
  identityFromDraft,
  phoneDigits,
} = require('../utils/competitionDuplicateGuard');
const { queueAutomaticCompetitionRefund } = require('./autoRefundCompetitionPayment');

async function restoreDraftFromDeskEntry(paymentOrder) {
  const deskEntryId = paymentOrder.orderTags?.deskEntryId;
  if (!deskEntryId) return null;
  try {
    const DeskEntry = require('../model/fest_day_assisted_registration_model');
    const entry = await DeskEntry.findById(deskEntryId).lean();
    if (!entry) return null;
    const formData = entry.responses instanceof Map
      ? Object.fromEntries(entry.responses)
      : (entry.responses || {});
    return sanitizeFestCompetitionDraft({
      festId: String(entry.fest || ''),
      competitionId: String(entry.competitionId || ''),
      formData,
    });
  } catch {
    return null;
  }
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

  // Retired / superseded desk payment — refund, never issue a second ticket
  if (paymentOrder.orderTags?.retired) {
    const refund = await queueAutomaticCompetitionRefund(paymentOrder, {
      reason: 'retired_desk_order_late_pay',
      actor: 'system:retired_order',
    });
    return {
      ok: false,
      retired: true,
      paidReview: true,
      refundQueued: Boolean(refund.ok),
      error: 'This payment was replaced by a newer attempt and will be refunded.',
    };
  }

  const userId = overrides.userId || paymentOrder.userId;
  if (!userId) return { ok: false, error: 'Missing user on payment order' };

  const storedDraft = sanitizeFestCompetitionDraft(paymentOrder.orderTags?.registrationDraft);
  const overrideDraft = sanitizeFestCompetitionDraft(overrides.registrationDraft);
  let draft = overrideDraft || storedDraft;
  if (!draft && paymentOrder.entityType === 'competition') {
    draft = await restoreDraftFromDeskEntry(paymentOrder);
    if (draft) {
      paymentOrder.orderTags = {
        ...(paymentOrder.orderTags || {}),
        registrationDraft: draft,
      };
      paymentOrder.markModified('orderTags');
      await paymentOrder.save().catch(() => {});
    }
  }
  if (!draft) {
    const refund = await queueAutomaticCompetitionRefund(paymentOrder, {
      reason: 'missing_registration_draft',
      actor: 'system:missing_draft',
    });
    return {
      ok: false,
      paidReview: true,
      refundQueued: Boolean(refund.ok),
      error: 'No registration draft available for this payment',
    };
  }

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
      const stallCoupon = await assignStallCouponIfEligible({
        fest: competition.fest,
        userId,
      });
      return {
        ok: true,
        registrationId: alreadyPaid._id,
        alreadyExists: true,
        stallCoupon: stallCoupon || null,
      };
    }

    const user = await User.findById(userId);
    if (!user) return { ok: false, error: 'User not found' };

    const draftIdentity = identityFromDraft(draft);
    const priorApproved = await findApprovedCompetitionDuplicate({
      festId: competition.fest._id,
      competitionId: competition._id,
      userId,
      phone: draftIdentity.phone || phoneDigits(user.phoneNumber || paymentOrder.customerPhone),
      email: draftIdentity.email || user.email || paymentOrder.customerEmail,
    });
    if (priorApproved && String(priorApproved.payment_order_id || '') !== String(payment_order_id)) {
      logger.error('Duplicate competition payment after prior approved registration', {
        orderId: payment_order_id,
        existingRegistrationId: String(priorApproved._id),
        competitionId: String(competition._id),
        userId: String(userId),
      });
      const refund = await queueAutomaticCompetitionRefund(paymentOrder, {
        reason: 'duplicate_competition_payment',
        actor: 'system:duplicate_pay',
      });
      return {
        ok: true,
        registrationId: priorApproved._id,
        alreadyExists: true,
        duplicatePayment: true,
        refundQueued: Boolean(refund.ok),
      };
    }

    // Re-acquire capacity if the 30m reservation expired before payment settled
    const {
      acquireCompetitionSlot,
      releaseCompetitionSlot: releaseSlot,
    } = require('./competitionSlotReservationService');
    const CompetitionSlotReservation = require('../model/competition_slot_reservation_model');
    const heldToken = paymentOrder.orderTags?.slotReservationToken || '';
    let activeReservation = heldToken
      ? await CompetitionSlotReservation.findOne({ token: heldToken, expiresAt: { $gt: new Date() } }).lean()
      : null;
    if (!activeReservation) {
      try {
        const replacement = await acquireCompetitionSlot({ competition, userId });
        if (replacement?.token) {
          paymentOrder.orderTags = {
            ...(paymentOrder.orderTags || {}),
            slotReservationToken: replacement.token,
          };
          paymentOrder.markModified('orderTags');
          await paymentOrder.save().catch(() => {});
          activeReservation = replacement;
        }
      } catch (capacityError) {
        logger.error('Competition fulfill after capacity expired — holding for refund review', {
          orderId: payment_order_id,
          message: capacityError.message,
          competitionId: String(competition._id),
        });
        const refund = await queueAutomaticCompetitionRefund(paymentOrder, {
          reason: 'capacity_expired_paid_review',
          actor: 'system:capacity_review',
        });
        return {
          ok: false,
          paidReview: true,
          refundQueued: Boolean(refund.ok),
          error: capacityError.message || 'Paid after capacity expired; refund queued',
        };
      }
    }

    const competitionTicketPrice = parseTicketPrice(competition.feeAmount)
      || parseTicketPrice(competition.registrationFee);
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3);
    const quotedTotal = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;
    const paidTotal = Number(paymentOrder.totalAmount);
    const competitionTotalAmount = Number.isFinite(paidTotal) && paidTotal >= 0
      ? paidTotal
      : quotedTotal;

    const draftResponses = normalizeLeadIdentityFromRoster(draftToResponses(draft));
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
      ...cashfreeSettlementFields({
        amountPaid: competitionTotalAmount,
        payment_gateway: 'cashfree',
        payment_order_id,
      }),
      submittedAt: new Date(),
    });

    const saved = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: competition.fest._id,
      competitionId: competition._id,
      user: userId,
    });
    if (paymentOrder.orderTags?.slotReservationToken) {
      const { releaseCompetitionSlot } = require('./competitionSlotReservationService');
      await releaseCompetitionSlot(paymentOrder.orderTags.slotReservationToken).catch(() => {});
    }
    if (!saved.created) {
      const stallCoupon = await assignStallCouponIfEligible({
        fest: competition.fest,
        userId,
      });
      return {
        ok: true,
        registrationId: saved.registration._id,
        alreadyExists: true,
        stallCoupon: stallCoupon || null,
      };
    }
    logger.debug('✅ Competition registration fulfilled from payment:', payment_order_id, saved.registration._id);

    const stallCoupon = await assignStallCouponIfEligible({
      fest: competition.fest,
      userId,
    });

    setImmediate(async () => {
      try {
        await consumeCouponUsageForOrder({
          paymentOrderId: payment_order_id,
          userId,
        });
        const persistedRegistration = saved.registration || registration;
        const ticketLink = `/qr-ticket/${persistedRegistration._id}`;
        scheduleRegistrationNotification(userId, {
          title: 'Registration Confirmed!',
          message: `You've successfully registered for ${competition.name}.`,
          body: `You've registered for ${competition.name}`,
          link: ticketLink,
          metadata: {
            competitionId: competition._id,
            festId: competition.fest?._id,
            registrationId: persistedRegistration._id,
          },
          whatsapp: {
            name: user?.name,
            user,
            responses: persistedRegistration.responses,
            eventName: competition.name,
            bookingId: persistedRegistration._id,
            type: '',
            date: competition.fest?.startDate || competition.startDate || '',
            time: '',
            amount: competitionTotalAmount,
          },
        });
        await sendCompetitionRegistrationEmailForRecord({
          user,
          fest: competition.fest,
          competition,
          registration: persistedRegistration,
          extras: { stallCoupon: stallCoupon || null },
        }).catch(() => {});
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

    return {
      ok: true,
      registrationId: registration._id,
      stallCoupon: stallCoupon || null,
    };
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
    const stallCoupon = await assignStallCouponIfEligible({ fest, userId });
    return {
      ok: true,
      registrationId: alreadyPaid._id,
      alreadyExists: true,
      stallCoupon: stallCoupon || null,
    };
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
      normalizeLeadIdentityFromRoster(draftToResponses(draft)),
    ),
    status: 'approved',
    payment_order_id,
    payment_id,
    payment_gateway: 'cashfree',
    paymentStatus: 'paid',
    amountPaid: festTotalAmount,
    ...cashfreeSettlementFields({
      amountPaid: festTotalAmount,
      payment_gateway: 'cashfree',
      payment_order_id,
    }),
    submittedAt: new Date(),
  });

    const savedFest = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: fest._id,
      user: userId,
      competitionId: null,
    });
    if (!savedFest.created) {
      const stallCoupon = await assignStallCouponIfEligible({ fest, userId });
      return {
        ok: true,
        registrationId: savedFest.registration._id,
        alreadyExists: true,
        stallCoupon: stallCoupon || null,
      };
    }
    logger.debug('✅ Fest registration fulfilled from payment:', payment_order_id, savedFest.registration._id);

  const stallCoupon = await assignStallCouponIfEligible({ fest, userId });

  setImmediate(async () => {
    try {
      await consumeCouponUsageForOrder({
        paymentOrderId: payment_order_id,
        userId,
      });
      const ticketLink = `/registration-details/${registration._id}`;
      scheduleRegistrationNotification(userId, {
        title: 'Fest Registration Confirmed!',
        message: `You've successfully registered for ${fest.festName}.`,
        body: `You've registered for ${fest.festName}`,
        link: ticketLink,
        metadata: { festId: fest._id, registrationId: registration._id },
        whatsapp: {
          name: user?.name,
          user,
          responses: registration.responses,
          eventName: fest.festName,
          bookingId: registration._id,
          type: '',
          date: fest.startDate || '',
          time: '',
          amount: festTotalAmount,
        },
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
        {
          status: 'paid',
          method: 'cashfree',
          type: 'fest',
          ticketLink,
          qrHash: registration.qrCodeData || '',
          venue: fest.venue || '',
          stallCoupon: stallCoupon || null,
        },
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

  return {
    ok: true,
    registrationId: registration._id,
    stallCoupon: stallCoupon || null,
  };
}

module.exports = {
  sanitizeFestCompetitionDraft,
  fulfillFestCompetitionFromPaidOrder,
};
