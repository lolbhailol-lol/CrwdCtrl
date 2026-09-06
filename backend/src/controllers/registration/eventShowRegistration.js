const User = require('../../model/usermodel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('../../services/emailService');
const {
  consumeCouponUsageForOrder,
  validateAndPriceCoupon,
  reserveCouponUsage,
} = require('../../utils/couponPricing');
const { logger } = require('../../utils/logger');
const { scheduleRegistrationNotification } = require('./helpers');
const {
  isAllowedPaymentScreenshotUrl,
  normalizeTransactionId,
} = require('../../utils/runClubRegistrationGuards');

/**
 * Submit an internal EventShow registration (authed, paid via Cashfree).
 * Mirrors the competition custom flow: multipart responses + files + payment verify.
 */
const submitEventShowRegistration = async (req, res) => {
  try {
    const { eventShowId } = req.params;
    const userId = req.user.userId;

    const EventShow = require('../../model/event_show_model');
    const EventShowRegistration = require('../../model/event_show_registration_model');
    const { buildEventPriceBreakdown } = require('../../utils/platformFee');
    const { resolveTrekPlatformFeePercent } = require('../../utils/trekRegistrationFee');
    const { findByIdOrSlug } = require('../../utils/slug');

    const eventShow = await findByIdOrSlug(EventShow, eventShowId, {
      pickName: (row) => row.title || row.displayName || '',
      lean: false,
    });
    if (!eventShow) return res.status(404).json({ error: 'Event not found' });

    const reg = eventShow.registration || {};
    if (reg.status !== 'open' || !['internal_form', 'organizer_qr'].includes(reg.mode)) {
      return res.status(400).json({ error: 'Registration is not open for this event.' });
    }

    // Parse responses (JSON or FormData string)
    let responses = req.body.responses;
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch {
        return res.status(400).json({ error: 'Invalid responses format' });
      }
    }
    if (!responses || typeof responses !== 'object') responses = {};

    // Handle file uploads (store Cloudinary URLs back into responses)
    const files = req.files || [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          const result = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            'event-registration',
            `event_${eventShowId}_${Date.now()}`,
            userId,
            file.fieldname
          );
          if (result.success) {
            const entry = {
              fileName: file.originalname,
              url: result.cloudinaryLink,
              size: file.size,
              uploaded: true,
            };
            const existing = responses[file.fieldname];
            if (existing === undefined) {
              responses[file.fieldname] = entry;
            } else if (Array.isArray(existing)) {
              existing.push(entry);
            } else {
              responses[file.fieldname] = [existing, entry];
            }
          }
        } catch (uploadErr) {
          logger.error('❌ Event registration file upload error:', uploadErr.message);
        }
      }
    }

    // Verify payment when the selected package / ticket has a fee
    const { resolveSportsPerPersonFee } = require('../../utils/sportsPricing');
    let tierId = req.body.tierId;
    if (typeof tierId === 'string') tierId = tierId.trim();
    else tierId = '';

    let ticketPrice = Number(eventShow.ticketPrice) || 0;
    let selectedTier = null;
    if (eventShow.pricingMode === 'tiers') {
      try {
        const priced = resolveSportsPerPersonFee(
          { ...eventShow.toObject?.() || eventShow, registrationFee: eventShow.ticketPrice },
          tierId,
        );
        ticketPrice = priced.fee;
        selectedTier = priced.tier;
      } catch (tierErr) {
        return res.status(tierErr.status || 400).json({ error: tierErr.message || 'Please select a registration package.' });
      }
    }
    const { resolveEventAddOns } = require('../../utils/sportsPricing');
    let addOns;
    try {
      const rawAddOnIds = req.body.selectedAddOnIds;
      const selectedAddOnIds = typeof rawAddOnIds === 'string'
        ? JSON.parse(rawAddOnIds)
        : rawAddOnIds;
      addOns = resolveEventAddOns(eventShow, selectedAddOnIds || []);
    } catch (addOnErr) {
      return res.status(addOnErr.status || 400).json({ error: addOnErr.message || 'Invalid add-on selection.' });
    }
    ticketPrice += addOns.total;
    if (addOns.selected.length) {
      responses.selected_add_ons = addOns.selected.map((addOn) => addOn.name).join(', ');
    }

    const regMode = eventShow.registration?.mode || 'internal_form';
    const isOrganizerQr = regMode === 'organizer_qr';
    const platformFeePercent = isOrganizerQr
      ? 0
      : resolveTrekPlatformFeePercent(eventShow.platformFeePercent, 2.5);
    const baseTotalAmount = buildEventPriceBreakdown(ticketPrice, platformFeePercent).totalAmount;
    let payment_order_id = null;
    let payment_id = null;
    let paymentScreenshotUrl = '';
    let transactionId = '';
    let paymentStatus = 'free';
    let registrationStatus = 'approved';
    let appliedCouponCode = '';
    let totalAmount = baseTotalAmount;

    if (ticketPrice > 0) {
      if (isOrganizerQr) {
        const rawCoupon = eventShow.registration?.allowCoupons === false
          ? ''
          : String(req.body.couponCode || responses.coupon_code || '').trim();
        try {
          const couponResult = await validateAndPriceCoupon({
            couponCode: rawCoupon,
            entityType: 'event_show',
            userId,
            amountBeforeDiscount: baseTotalAmount,
            people: Math.max(1, Number(selectedTier?.participantCount) || Number(responses.driver_count) || 1),
            failOnMissingCode: false,
          });
          appliedCouponCode = couponResult.couponCode || '';
          totalAmount = Number(couponResult.amountAfterDiscount);
          if (!Number.isFinite(totalAmount) || totalAmount < 0) totalAmount = baseTotalAmount;
        } catch (couponErr) {
          return res.status(400).json({ error: couponErr.message || 'Invalid coupon' });
        }

        if (totalAmount > 0) {
          if (!String(eventShow.registration?.paymentQR || '').trim()) {
            return res.status(400).json({
              error: 'Organizer payment QR is not configured yet. Please contact event organizer.',
            });
          }
          paymentScreenshotUrl = String(req.body.paymentScreenshotUrl || '').trim();
          transactionId = normalizeTransactionId(req.body.transactionId || '');
          if (!paymentScreenshotUrl) {
            return res.status(400).json({ error: 'Please upload your payment screenshot.' });
          }
          if (!isAllowedPaymentScreenshotUrl(paymentScreenshotUrl)) {
            return res.status(400).json({ error: 'Invalid payment screenshot URL. Please re-upload from the form.' });
          }
          if (transactionId.length < 4) {
            return res.status(400).json({ error: 'Please enter your UPI / transaction ID (at least 4 characters).' });
          }
          if (eventShow.registration?.qrAutoConfirm === true) {
            paymentStatus = 'paid';
            registrationStatus = 'approved';
          } else {
            paymentStatus = 'pending';
            registrationStatus = 'pending';
          }
        } else {
          // Coupon covered full amount — no QR proof needed
          paymentStatus = 'free';
          registrationStatus = 'approved';
          paymentScreenshotUrl = '';
          transactionId = '';
        }

        if (appliedCouponCode) {
          try {
            await reserveCouponUsage({ couponCode: appliedCouponCode, userId });
          } catch (reserveErr) {
            return res.status(400).json({ error: reserveErr.message || 'Coupon could not be applied' });
          }
        }
      } else {
        const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
        const paymentCheck = await verifyPaymentForRegistration(req.body, {
          expectedTotalAmount: baseTotalAmount,
          entityId: eventShow._id,
        });
        if (!paymentCheck.ok) {
          return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this event.' });
        }
        payment_order_id = paymentCheck.orderId;
        payment_id = paymentCheck.paymentId;
        paymentStatus = 'paid';
        totalAmount = Number(paymentCheck.amountPaid) || baseTotalAmount;
      }
    } else {
      totalAmount = 0;
    }

    // Idempotent: a paid order must not create duplicate event registrations.
    // Scoped to this event + user so an unrelated order id can never falsely match.
    // Also check additionalEntries for re-register Cashfree orders.
    if (payment_order_id) {
      const alreadyPaid = await EventShowRegistration.findOne({
        eventShow: eventShow._id,
        user: userId,
        $or: [
          { payment_order_id },
          { 'additionalEntries.payment_order_id': payment_order_id },
        ],
      });
      if (alreadyPaid) {
        return res.status(200).json({
          success: true,
          message: 'Registration already completed',
          _id: alreadyPaid._id,
          registrationId: alreadyPaid._id,
          eventName: eventShow.title,
          amountPaid: alreadyPaid.amountPaid,
          addedToExisting: Boolean(alreadyPaid.reRegistrationCount),
        });
      }
    }

    const user = await User.findById(userId);

    if (appliedCouponCode) {
      responses.coupon_code = appliedCouponCode;
    }

    const paymentGateway = isOrganizerQr && totalAmount > 0
      ? 'organizer_qr'
      : (paymentStatus === 'paid' ? 'cashfree' : (appliedCouponCode && isOrganizerQr ? 'organizer_qr' : null));
    const entryAmount = totalAmount > 0 ? totalAmount : 0;
    const now = new Date();

    const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const formEmail = String(responses.email || '').trim().toLowerCase();
    const accountEmail = String(user?.email || '').trim().toLowerCase();
    const matchEmail = formEmail || accountEmail;

    // Find earliest primary registration for this event + same user/email
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
      // Append as unlimited re-register (2nd, 3rd, … Nth) on the same guest row
      existing.additionalEntries = existing.additionalEntries || [];
      existing.additionalEntries.push({
        tierId: selectedTier?.id || null,
        tierName: selectedTier?.name || null,
        selectedAddOns: addOns.selected,
        amountPaid: entryAmount,
        paymentStatus,
        payment_gateway: paymentGateway,
        paymentScreenshotUrl,
        transactionId,
        payment_order_id,
        payment_id,
        responses: { ...responses },
        status: registrationStatus,
        submittedAt: now,
      });
      existing.reRegistrationCount = existing.additionalEntries.length;
      existing.amountPaid = Number(existing.amountPaid || 0) + entryAmount;
      // Keep primary status if already approved; pending add-ons stay on the entry
      if (existing.status !== 'approved' && registrationStatus === 'approved') {
        existing.status = 'approved';
      }
      // Free Drive/spectator parents that later get a paid package should not stay "free"
      if (
        paymentStatus === 'paid'
        && Number(existing.amountPaid) > 0
        && existing.paymentStatus === 'free'
      ) {
        existing.paymentStatus = 'paid';
      }
      await existing.save();
      registration = existing;
      addedToExisting = true;
    } else {
      registration = new EventShowRegistration({
        eventShow: eventShow._id,
        user: userId,
        responses,
        status: registrationStatus,
        payment_order_id,
        payment_id,
        payment_gateway: paymentGateway,
        paymentStatus,
        paymentScreenshotUrl,
        transactionId,
        amountPaid: entryAmount,
        tierId: selectedTier?.id || null,
        tierName: selectedTier?.name || null,
        selectedAddOns: addOns.selected,
        additionalEntries: [],
        reRegistrationCount: 0,
        submittedAt: now,
      });
      await registration.save();
    }

    if (payment_order_id) {
      consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});
    }

    res.status(addedToExisting ? 200 : 201).json({
      success: true,
      message: addedToExisting
        ? 'Added to your existing registration'
        : 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      eventName: eventShow.title,
      amountPaid: registration.amountPaid,
      addedToExisting,
      reRegistrationCount: registration.reRegistrationCount || 0,
    });

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
          const eventPaymentStatus = entryAmount > 0
            ? (paymentStatus === 'pending' ? 'pending' : 'paid')
            : 'free';
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
              status: eventPaymentStatus,
              method: paymentGateway || (eventPaymentStatus === 'paid' ? 'cashfree' : ''),
              type: 'event',
              ticketLink: eventTicketLink,
            },
          ).catch(() => {});
        }

        // Auto-append the registration to the organiser's Google Sheet (incl. payment id)
        const sheetsUrl = eventShow.registration?.googleSheetsUrl;
        if (sheetsUrl) {
          try {
            const { appendToEventGoogleSheets } = require('../../services/googleSheetsService');

            // Flatten the form schema (single or multi-step) for column mapping
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
                paymentStatus,
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
            logger.error('❌ Event Google Sheets sync error:', sheetsErr.message);
          }
        }
      } catch (bgErr) {
        logger.error('❌ event registration background error:', bgErr.message);
      }
    });
  } catch (err) {
    logger.error('❌ submitEventShowRegistration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * POST /api/registrations/events/:eventShowId/pay-and-register
 * Completes EventShow registration after Cashfree payment using body responses
 * and/or the draft stored on the PaymentOrder. Idempotent by payment_order_id.
 */
const payAndRegisterEventShow = async (req, res) => {
  try {
    const { eventShowId } = req.params;
    const userId = req.user.userId;
    const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
    const { fulfillEventShowFromPaidOrder, sanitizeRegistrationDraft } = require('../../services/eventShowPaymentFulfillment');

    const paymentCheck = await verifyPaymentForRegistration(req.body, {
      entityId: eventShowId,
    });
    if (!paymentCheck.ok) {
      return res.status(400).json({ error: paymentCheck.error || 'Payment verification failed' });
    }

    const PaymentOrder = require('../../model/payment_order_model');
    await PaymentOrder.findOneAndUpdate(
      { orderId: paymentCheck.orderId },
      {
        status: 'PAID',
        ...(paymentCheck.paymentId ? { paymentId: String(paymentCheck.paymentId) } : {}),
      },
      { upsert: false },
    );

    let responses = req.body.responses;
    if (typeof responses === 'string') {
      try {
        responses = JSON.parse(responses);
      } catch {
        responses = {};
      }
    }

    const draft = sanitizeRegistrationDraft({
      values: responses,
      tierId: req.body.tierId,
      selectedAddOnIds: req.body.selectedAddOnIds,
      couponCode: req.body.couponCode,
      eventShowId,
    });

    const result = await fulfillEventShowFromPaidOrder(paymentCheck.orderId, {
      userId,
      paymentId: paymentCheck.paymentId,
      markPaid: true,
      registrationDraft: draft,
      eventShowId,
      tierId: req.body.tierId,
      selectedAddOnIds: req.body.selectedAddOnIds,
      couponCode: req.body.couponCode,
      responses,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Could not complete registration' });
    }

    const registration = result.registration;
    return res.status(result.alreadyCompleted || result.addedToExisting ? 200 : 201).json({
      success: true,
      message: result.alreadyCompleted
        ? 'Registration already completed'
        : result.addedToExisting
          ? 'Added to your existing registration'
          : 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      eventName: result.eventShow?.title,
      amountPaid: registration.amountPaid,
      addedToExisting: result.addedToExisting,
      reRegistrationCount: registration.reRegistrationCount || 0,
    });
  } catch (err) {
    logger.error('❌ payAndRegisterEventShow error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = {
  submitEventShowRegistration,
  payAndRegisterEventShow,
};
