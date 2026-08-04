const User = require('../../model/usermodel');
const { uploadToCloudinary } = require('../../services/cloudinaryService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('../../services/emailService');
const { consumeCouponUsageForOrder } = require('../../utils/couponPricing');
const { logger } = require('../../utils/logger');
const { scheduleRegistrationNotification } = require('./helpers');

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
    if (reg.status !== 'open' || reg.mode !== 'internal_form') {
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

    const platformFeePercent = resolveTrekPlatformFeePercent(eventShow.platformFeePercent, 2.5);
    const totalAmount = buildEventPriceBreakdown(ticketPrice, platformFeePercent).totalAmount;
    let payment_order_id = null;
    let payment_id = null;
    let paymentStatus = 'free';

    if (ticketPrice > 0) {
      const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
      const paymentCheck = await verifyPaymentForRegistration(req.body, {
        expectedTotalAmount: totalAmount,
        entityId: eventShow._id,
      });
      if (!paymentCheck.ok) {
        return res.status(400).json({ error: paymentCheck.error || 'Payment is required for this event.' });
      }
      payment_order_id = paymentCheck.orderId;
      payment_id = paymentCheck.paymentId;
      paymentStatus = 'paid';
    }

    // Idempotent: a paid order must not create duplicate event registrations.
    // Scoped to this event + user so an unrelated order id can never falsely match.
    if (payment_order_id) {
      const alreadyPaid = await EventShowRegistration.findOne({
        payment_order_id,
        eventShow: eventShow._id,
        user: userId,
      });
      if (alreadyPaid) {
        return res.status(200).json({
          success: true,
          message: 'Registration already completed',
          _id: alreadyPaid._id,
          registrationId: alreadyPaid._id,
          eventName: eventShow.title,
          amountPaid: alreadyPaid.amountPaid,
        });
      }
    }

    const user = await User.findById(userId);

    const registration = new EventShowRegistration({
      eventShow: eventShow._id,
      user: userId,
      responses,
      status: 'pending',
      payment_order_id,
      payment_id,
      payment_gateway: paymentStatus === 'paid' ? 'cashfree' : null,
      paymentStatus,
      amountPaid: paymentStatus === 'paid' ? totalAmount : 0,
      tierId: selectedTier?.id || null,
      tierName: selectedTier?.name || null,
      submittedAt: new Date(),
    });

    await registration.save();
    if (payment_order_id) {
      consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      _id: registration._id,
      registrationId: registration._id,
      eventName: eventShow.title,
      amountPaid: registration.amountPaid,
    });

    scheduleRegistrationNotification(userId, {
      title: 'Registration Confirmed!',
      message: `You've successfully registered for ${eventShow.title}.`,
      body: `You've registered for ${eventShow.title}`,
      link: `/registration-details/${registration._id}?type=event`,
      metadata: { eventShowId: eventShow._id, registrationId: registration._id },
    });

    setImmediate(async () => {
      try {
        if (user?.email) {
          const eventTicketLink = `/registration-details/${registration._id}?type=event`;
          const eventPaymentStatus = registration.amountPaid > 0 ? 'paid' : 'free';
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
              method: eventPaymentStatus === 'paid' ? 'cashfree' : '',
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
                amountPaid: registration.amountPaid,
                paymentId: registration.payment_id || '',
                paymentStatus: registration.paymentStatus,
              },
              {
                name: user?.name,
                email: user?.email,
                phone: user?.phoneNumber || user?.phone || '',
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

module.exports = {
  submitEventShowRegistration,
};
