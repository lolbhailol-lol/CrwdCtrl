const Registration = require('../../model/registration_model');
const FestOrganizer = require('../../model/fest_organizer_model');
const User = require('../../model/usermodel');
const { appendPaymentOnlyToSheets } = require('../../services/googleSheetsService');
const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('../../services/emailService');
const { consumeCouponUsageForOrder } = require('../../utils/couponPricing');
const { buildPriceBreakdown, parseTicketPrice } = require('../../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../../utils/trekRegistrationFee');
const { competitionRequiresPayment, resolvePaidOrderTotal } = require('../../utils/competitionFeeTiers');
const { logger } = require('../../utils/logger');
const { findByIdOrSlug } = require('../../utils/slug');
const { saveRegistrationIdempotent } = require('../../utils/registrationIdempotency');
const { cashfreeSettlementFields } = require('../../utils/cashfreeGatewayFee');
const {
  parseResponsesBody,
  mergeRegistrationResponses,
  maybeEnrichExistingResponses,
  scheduleRegistrationNotification,
} = require('./helpers');

// Pay-and-register for FESTS: Cashfree payment flow, uses user profile data
// POST /api/registrations/fests/:festId/pay-and-register
const payAndRegisterFest = async (req, res) => {
  try {
    const { festId } = req.params;
    const userId = req.user.userId;

    const fest = await findByIdOrSlug(FestOrganizer, festId, {
      pickName: (row) => row.festName || row.name || '',
      lean: false,
    });
    if (!fest) return res.status(404).json({ error: 'Fest not found' });
    const festObjectId = fest._id;

    if (!fest.feeAmount || fest.feeAmount <= 0) {
      return res.status(400).json({ error: 'This fest does not require payment' });
    }

    const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
    const paymentCheck = await verifyPaymentForRegistration(req.body);
    if (!paymentCheck.ok) {
      return res.status(400).json({ error: paymentCheck.error || 'Payment verification failed' });
    }

    const payment_order_id = paymentCheck.orderId;
    const payment_id = paymentCheck.paymentId;
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(fest.platformFeePercent, 3);
    const festTotalAmount = buildPriceBreakdown(fest.feeAmount, festPlatformFeePercent).totalAmount;

    // Idempotent: if this exact payment already produced a registration, return it
    // so a re-fired resume (double submit / page revisit) succeeds instead of erroring.
    // Scoped to this fest + user so an unrelated order id can never falsely match.
    const alreadyPaid = payment_order_id
      ? await Registration.findOne({
          payment_order_id,
          fest: festObjectId,
          user: userId,
          competitionId: null,
        })
      : null;
    if (alreadyPaid) {
      const extraResponses = parseResponsesBody(req.body);
      if (Object.keys(extraResponses).length > 0) {
        await maybeEnrichExistingResponses(alreadyPaid, extraResponses);
      }
      return res.status(200).json({
        success: true,
        message: 'Registration already completed',
        _id: alreadyPaid._id,
        registrationId: alreadyPaid._id,
        festName: fest.festName,
        amountPaid: alreadyPaid.amountPaid,
      });
    }

    // Repeat registrations are allowed: each verified payment gets its own
    // registration. Retries of the SAME payment are caught by the order-scoped
    // idempotency check above, so no duplicate can come from a resume/double-submit.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const registration = new Registration({
      fest: festObjectId,
      user: userId,
      responses: mergeRegistrationResponses(
        {
          name: user.name || '',
          email: user.email || '',
          phone: user.phoneNumber || '',
        },
        parseResponsesBody(req.body),
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

    const savedFestReg = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: festObjectId,
      user: userId,
      competitionId: null,
    });
    const persistedFest = savedFestReg.registration;
    if (savedFestReg.created) {
      logger.debug('✅ Fest pay-and-register saved:', persistedFest._id);
    }
    if (payment_order_id) {
      consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});
    }

    const festRegistrationLink = `/registration-details/${persistedFest._id}`;

    res.status(savedFestReg.created ? 201 : 200).json({
      success: true,
      message: savedFestReg.created ? 'Registration successful' : 'Registration already completed',
      _id: persistedFest._id,
      registrationId: persistedFest._id,
      festName: fest.festName,
      amountPaid: persistedFest.amountPaid || festTotalAmount,
    });

    if (!savedFestReg.created) return;

    scheduleRegistrationNotification(userId, {
      title: 'Fest Registration Confirmed!',
      message: `You've successfully registered for ${fest.festName}.`,
      body: `You've registered for ${fest.festName}`,
      link: festRegistrationLink,
      metadata: { festId: fest._id, registrationId: persistedFest._id },
    });

    setImmediate(async () => {
      try {
        await sendRegistrationThankYouEmail(user.email, user.name, fest.festName, {
          type: 'fest',
          ticketLink: festRegistrationLink,
        }).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email, user.name,
          fest.festName, null,
          persistedFest._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          { status: 'paid', method: 'cashfree', type: 'fest', ticketLink: festRegistrationLink },
        ).catch(() => {});

        // Google Sheets
        if (fest.registration?.googleSheetsUrl) {
          await appendPaymentOnlyToSheets(fest.registration.googleSheetsUrl, {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber || '',
            amountPaid: festTotalAmount,
            paymentId: payment_id,
            entityName: fest.festName,
            entityType: 'Fest',
          }).catch(e => logger.error('❌ Sheets error (payAndRegisterFest):', e.message));
        }
      } catch (bgErr) {
        logger.error('❌ fest pay-and-register background error:', bgErr);
      }
    });
  } catch (err) {
    logger.error('❌ payAndRegisterFest error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Pay-and-register for COMPETITIONS: Cashfree payment flow with no form
// POST /api/registrations/competitions/:competitionId/pay-and-register
const payAndRegister = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.user.userId;

    const Competition = require('../../model/competition_model');
    const competition = await Competition.findById(competitionId).populate('fest');
    if (!competition) return res.status(404).json({ error: 'Competition not found' });
    const competitionTicketPrice = parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee);
    const festPlatformFeePercent = resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3);
    let competitionTotalAmount = buildPriceBreakdown(competitionTicketPrice, festPlatformFeePercent).totalAmount;

    if (!competitionRequiresPayment(competition)) {
      return res.status(400).json({ error: 'This competition does not require payment' });
    }

    const { verifyPaymentForRegistration } = require('../../utils/paymentVerification');
    const paymentCheck = await verifyPaymentForRegistration(req.body);
    if (!paymentCheck.ok) {
      return res.status(400).json({ error: paymentCheck.error || 'Payment verification failed' });
    }

    const payment_order_id = paymentCheck.orderId;
    const payment_id = paymentCheck.paymentId;
    competitionTotalAmount = await resolvePaidOrderTotal(payment_order_id, competitionTotalAmount);

    // Idempotent: if this exact payment already produced a registration, return it
    // so a re-fired resume (double submit / page revisit) succeeds instead of erroring.
    // Scoped to this fest + competition + user so an unrelated order id can't match.
    const alreadyPaid = payment_order_id
      ? await Registration.findOne({
          payment_order_id,
          fest: competition.fest._id,
          competitionId: competition._id,
          user: userId,
        })
      : null;
    if (alreadyPaid) {
      const extraResponses = parseResponsesBody(req.body);
      if (Object.keys(extraResponses).length > 0) {
        await maybeEnrichExistingResponses(alreadyPaid, extraResponses);
      }
      return res.status(200).json({
        success: true,
        message: 'Registration already completed',
        _id: alreadyPaid._id,
        registrationId: alreadyPaid._id,
        competitionName: competition.name,
        amountPaid: alreadyPaid.amountPaid,
      });
    }

    // Repeat registrations are allowed: each verified payment gets its own
    // registration. Retries of the SAME payment are caught by the order-scoped
    // idempotency check above, so no duplicate can come from a resume/double-submit.
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const registration = new Registration({
      fest: competition.fest._id,
      user: userId,
      competitionId: competition._id,
      responses: mergeRegistrationResponses(
        {
          name: user.name || '',
          email: user.email || '',
          phone: user.phoneNumber || '',
        },
        parseResponsesBody(req.body),
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

    const savedCompReg = await saveRegistrationIdempotent(registration, {
      payment_order_id,
      fest: competition.fest._id,
      competitionId: competition._id,
      user: userId,
    });
    const persistedComp = savedCompReg.registration;
    if (savedCompReg.created) {
      logger.debug('✅ Pay-and-register saved:', persistedComp._id);
    }
    if (payment_order_id) {
      consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});
    }

    const payCompRegistrationLink = `/registration-details/${persistedComp._id}`;

    res.status(savedCompReg.created ? 201 : 200).json({
      success: true,
      message: savedCompReg.created ? 'Registration successful' : 'Registration already completed',
      _id: persistedComp._id,
      registrationId: persistedComp._id,
      competitionName: competition.name,
      amountPaid: persistedComp.amountPaid || competitionTotalAmount,
    });

    if (!savedCompReg.created) return;

    scheduleRegistrationNotification(userId, {
      title: 'Registration Confirmed!',
      message: `You've successfully registered for ${competition.name}.`,
      body: `You've registered for ${competition.name}`,
      link: payCompRegistrationLink,
      metadata: {
        competitionId: competition._id,
        festId: competition.fest?._id,
        registrationId: persistedComp._id,
      },
    });

    // Background: emails + sheets
    setImmediate(async () => {
      try {
        await sendRegistrationThankYouEmail(user.email, user.name, competition.fest?.festName || competition.name, {
          type: 'competition',
          ticketLink: payCompRegistrationLink,
        }).catch(() => {});
        await sendRegistrationConfirmationEmail(
          user.email, user.name,
          competition.fest?.festName || competition.name,
          competition.name,
          persistedComp._id.toString(),
          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          { status: 'paid', method: 'cashfree', type: 'competition', ticketLink: payCompRegistrationLink },
        ).catch(() => {});

        // Google Sheets — use the fest's Google Sheets URL if configured
        const sheetsUrl = competition.fest?.registration?.googleSheetsUrl;
        if (sheetsUrl) {
          await appendPaymentOnlyToSheets(sheetsUrl, {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber || '',
            amountPaid: competitionTotalAmount,
            paymentId: payment_id,
            entityName: competition.name,
            entityType: 'Competition',
          }).catch(e => logger.error('❌ Sheets error (payAndRegister):', e.message));
        }
      } catch (bgErr) {
        logger.error('❌ pay-and-register background error:', bgErr);
      }
    });
  } catch (err) {
    logger.error('❌ payAndRegister error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = {
  payAndRegisterFest,
  payAndRegister,
};
