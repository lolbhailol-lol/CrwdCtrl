const mongoose = require('mongoose');
const User = require('../model/usermodel');
const Event = require('../model/event_model');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const EventShow = require('../model/event_show_model');
const PlatformEvent = require('../model/platform_event_model');
const SportsEvent = require('../model/sports_model');
const PaymentOrder = require('../model/payment_order_model');
const { buildPriceBreakdown, buildTrekPriceBreakdown, buildEventPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');
const { resolveTrekPlatformFeePercent } = require('../utils/trekRegistrationFee');
const { validateTrekGenderRegistration } = require('../utils/trekGenderRegistration');

async function sumTrekConfirmedSeats(trekId) {
  const rows = await TrekBooking.aggregate([
    { $match: { trekId, status: 'confirmed' } },
    { $group: { _id: null, seats: { $sum: { $ifNull: ['$bookingDetails.people', 1] } } } },
  ]);
  return Number(rows[0]?.seats) || 0;
}
const {
  createCashfreeOrder,
  verifyCashfreePayment,
  getCashfreeClientMode,
} = require('../services/cashfreeService');
const { extractPaymentFields } = require('../utils/paymentVerification');
const { signPaymentProof } = require('../utils/paymentProof');
const { validateAndPriceCoupon } = require('../utils/couponPricing');
const { findByIdOrSlug } = require('../utils/slug');
const { resolveSportsPerPersonFee } = require('../utils/sportsPricing');
const {
  extractEntityId,
  findReusablePendingOrder,
  buildOrderResponse,
} = require('../utils/paymentOrderIdempotency');

const CASHFREE_CONFIG_MSG =
  'Payment gateway credentials are invalid or missing. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in backend/.env';

const respondCashfreeError = (res, err, fallbackMessage) => {
  const cfError = err.response?.data;
  console.error(fallbackMessage + ':', cfError || err.message);
  if (err.code === 'CASHFREE_CREDENTIALS_MISSING' || cfError?.type === 'authentication_error') {
    return res.status(503).json({ message: CASHFREE_CONFIG_MSG });
  }
  return res.status(500).json({ message: cfError?.message || fallbackMessage });
};

const resolvePricedEntity = async ({ eventId, competitionId, festId, eventShowId, notes = {} }) => {
  const resolvedEventId = eventId || notes.eventId;
  const resolvedCompetitionId = competitionId || notes.competitionId;
  const resolvedFestId = festId || notes.festId;
  const resolvedEventShowId = eventShowId || notes.eventShowId;

  if (resolvedEventShowId) {
    const eventShow = await findByIdOrSlug(EventShow, resolvedEventShowId, {
      pickName: (row) => row.title || row.displayName || '',
      select: 'title ticketPrice platformFeePercent',
      lean: true,
    });
    if (!eventShow) return null;
    return {
      entityType: 'event_show',
      ticketPrice: eventShow.ticketPrice,
      platformFeePercent: Number(eventShow.platformFeePercent) || 2.5,
      notes: { eventShowId: String(eventShow._id) },
    };
  }

  if (resolvedEventId) {
    const platformEvent = await PlatformEvent.findById(resolvedEventId).select('title price').lean();
    if (platformEvent) {
      return {
        entityType: 'event',
        ticketPrice: platformEvent.price || 0,
        notes: { eventId: platformEvent._id.toString() },
      };
    }

    const event = await Event.findById(resolvedEventId).select('name price registrationFee feeAmount');
    if (!event) return null;
    return {
      entityType: 'event',
      ticketPrice: event.price ?? event.registrationFee ?? event.feeAmount,
      notes: { eventId: event._id.toString() },
    };
  }

  if (resolvedCompetitionId) {
    const competition = await Competition.findById(resolvedCompetitionId).select('name feeAmount registrationFee');
    if (!competition) return null;
    return {
      entityType: 'competition',
      ticketPrice: parseTicketPrice(competition.feeAmount) || parseTicketPrice(competition.registrationFee),
      notes: { competitionId: competition._id.toString() },
    };
  }

  if (resolvedFestId) {
    const fest = await FestOrganizer.findById(resolvedFestId).select('festName feeAmount');
    if (!fest) return null;
    return {
      entityType: 'fest',
      ticketPrice: fest.feeAmount,
      notes: { festId: fest._id.toString() },
    };
  }

  return null;
};

const getPricingForRequest = async (req) => {
  const { eventId, competitionId, festId, eventShowId, notes = {}, couponCode } = req.body;
  const pricedEntity = await resolvePricedEntity({ eventId, competitionId, festId, eventShowId, notes });

  if (!pricedEntity) return null;

  const breakdown =
    pricedEntity.entityType === 'event_show'
      ? buildEventPriceBreakdown(pricedEntity.ticketPrice, pricedEntity.platformFeePercent ?? 2.5)
      : buildPriceBreakdown(pricedEntity.ticketPrice);

  const coupon = await validateAndPriceCoupon({
    couponCode,
    entityType: pricedEntity.entityType,
    userId: req.user?.userId || null,
    amountBeforeDiscount: breakdown.totalAmount,
    people: Math.max(1, Number(req.body.people) || 1),
  });

  return {
    ...pricedEntity,
    ...breakdown,
    couponCode: coupon.couponCode,
    couponDiscount: coupon.discountAmount,
    amountBeforeDiscount: coupon.amountBeforeDiscount,
    amountAfterDiscount: coupon.amountAfterDiscount,
    totalAmount: coupon.amountAfterDiscount,
  };
};

const getCustomerDetails = async (req) => {
  const { customerName, customerEmail, customerPhone } = req.body;
  if (customerName || customerEmail || customerPhone) {
    return {
      customerId: req.user?.userId || `guest_${Date.now()}`,
      customerName,
      customerEmail,
      customerPhone,
    };
  }

  if (req.user?.userId) {
    const user = await User.findById(req.user.userId).select('name email phoneNumber phone');
    if (user) {
      return {
        customerId: user._id.toString(),
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phoneNumber || user.phone,
      };
    }
  }

  return { customerId: `guest_${Date.now()}` };
};

exports.getPaymentQuote = async (req, res) => {
  try {
    const pricing = await getPricingForRequest(req);

    if (!pricing) {
      return res.status(404).json({ message: 'Paid event not found' });
    }

    if (pricing.ticketPrice <= 0) {
      return res.status(400).json({ message: 'This event does not require payment' });
    }

    res.json({
      entityType: pricing.entityType,
      ticketPrice: pricing.ticketPrice,
      platformFee: pricing.platformFee,
      couponCode: pricing.couponCode || '',
      couponDiscount: pricing.couponDiscount || 0,
      amountBeforeDiscount: pricing.amountBeforeDiscount ?? pricing.totalAmount,
      amountAfterDiscount: pricing.amountAfterDiscount ?? pricing.totalAmount,
      totalAmount: pricing.totalAmount,
      currency: 'INR',
    });
  } catch (err) {
    console.error('Payment quote error:', err);
    res.status(500).json({ message: 'Failed to calculate payment quote' });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { trekId, eventId, people = 1, couponCode } = req.body;

    if (trekId) {
      const trek = await findByIdOrSlug(Trek, trekId, {
        pickName: (row) => row.trekName || row.title || '',
        lean: true,
      });
      if (!trek) return res.status(404).json({ message: 'Trek not found' });
      const baseTicketTotal = (Number(trek.registrationFee) || 0) * Math.max(1, Number(people) || 1);
      const { totalAmount } = buildTrekPriceBreakdown(baseTicketTotal, resolveTrekPlatformFeePercent(trek.platformFeePercent, 3));
      const coupon = await validateAndPriceCoupon({
        couponCode,
        entityType: 'trek',
        userId: req.user?.userId || null,
        amountBeforeDiscount: totalAmount,
        people: Math.max(1, Number(people) || 1),
        failOnMissingCode: true,
      });
      return res.json(coupon);
    }

    if (eventId) {
      const event = await findByIdOrSlug(SportsEvent, eventId, {
        pickName: (row) => row.title || '',
        lean: true,
      });
      if (!event) return res.status(404).json({ message: 'Run not found' });
      let ticketPricePerPerson;
      try {
        ticketPricePerPerson = resolveSportsPerPersonFee(event, req.body.tierId).fee;
      } catch (e) {
        return res.status(e.status || 400).json({ message: e.message || 'Invalid tier' });
      }
      const baseTicketTotal = ticketPricePerPerson * Math.max(1, Number(people) || 1);
      // UPI/SS (organizer_qr) has no platform fee — discount against run fee only
      const amountBeforeDiscount = event.registration?.mode === 'organizer_qr'
        ? baseTicketTotal
        : buildPriceBreakdown(baseTicketTotal).totalAmount;
      const coupon = await validateAndPriceCoupon({
        couponCode,
        entityType: 'sports',
        userId: req.user?.userId || null,
        amountBeforeDiscount,
        people: Math.max(1, Number(people) || 1),
        failOnMissingCode: true,
      });
      return res.json(coupon);
    }

    const pricing = await getPricingForRequest({ body: req.body, user: req.user });
    if (!pricing) return res.status(404).json({ message: 'Paid event not found' });
    const coupon = await validateAndPriceCoupon({
      couponCode,
      entityType: pricing.entityType,
      userId: req.user?.userId || null,
      amountBeforeDiscount: pricing.amountBeforeDiscount ?? pricing.totalAmount,
      people: Math.max(1, Number(people) || 1),
      failOnMissingCode: true,
    });
    return res.json(coupon);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid coupon' });
  }
};

// POST /api/payment/order
exports.createOrder = async (req, res) => {
  try {
    const { currency = 'INR', notes = {} } = req.body;
    const pricing = await getPricingForRequest(req);

    if (!pricing) {
      return res.status(404).json({ message: 'Paid event not found' });
    }

    if (pricing.ticketPrice <= 0) {
      return res.status(400).json({ message: 'This event does not require payment' });
    }

    const entityId = extractEntityId(pricing.notes);
    const customerDetails = await getCustomerDetails(req);
    const userId = req.user?.userId || null;

    const existingPending = await findReusablePendingOrder({
      userId,
      customerEmail: customerDetails.customerEmail,
      entityType: pricing.entityType,
      entityId,
      totalAmount: pricing.totalAmount,
      couponCode: pricing.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      return res.json({
        ...buildOrderResponse(existingPending),
        cashfreeMode: getCashfreeClientMode(),
      });
    }

    const order = await createCashfreeOrder({
      orderAmount: pricing.totalAmount,
      currency,
      customerDetails,
      orderNote: `${pricing.entityType} registration`,
      orderTags: {
        ...notes,
        ...pricing.notes,
        entityType: pricing.entityType,
        ticketPrice: String(pricing.ticketPrice),
        platformFee: String(pricing.platformFee),
        couponCode: pricing.couponCode || '',
        couponDiscount: String(pricing.couponDiscount || 0),
        amountBeforeDiscount: String(pricing.amountBeforeDiscount ?? pricing.totalAmount),
        amountAfterDiscount: String(pricing.amountAfterDiscount ?? pricing.totalAmount),
        totalAmount: String(pricing.totalAmount),
      },
    });

    if (entityId) {
      await PaymentOrder.create({
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        entityType: pricing.entityType,
        entityId,
        userId,
        ticketPrice: pricing.ticketPrice,
        platformFee: pricing.platformFee,
        couponCode: pricing.couponCode || '',
        couponDiscount: pricing.couponDiscount || 0,
        amountBeforeDiscount: pricing.amountBeforeDiscount ?? pricing.totalAmount,
        amountAfterDiscount: pricing.amountAfterDiscount ?? pricing.totalAmount,
        totalAmount: pricing.totalAmount,
        people: 1,
        currency,
        status: 'PENDING',
        orderTags: { ...notes, ...pricing.notes },
        customerEmail: customerDetails.customerEmail || null,
      });
    }

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      cashfreeMode: getCashfreeClientMode(),
      amount: order.order_amount,
      currency: order.order_currency,
      ticketPrice: pricing.ticketPrice,
      platformFee: pricing.platformFee,
      couponCode: pricing.couponCode || '',
      couponDiscount: pricing.couponDiscount || 0,
      amountBeforeDiscount: pricing.amountBeforeDiscount ?? pricing.totalAmount,
      amountAfterDiscount: pricing.amountAfterDiscount ?? pricing.totalAmount,
      totalAmount: pricing.totalAmount,
    });
  } catch (err) {
    respondCashfreeError(res, err, 'Failed to create payment order');
  }
};

// POST /api/payment/verify
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = extractPaymentFields(req.body);

    if (!orderId) {
      return res.status(400).json({ message: 'Missing payment order ID', verified: false });
    }

    const result = await verifyCashfreePayment({ orderId, paymentId });
    if (!result.verified) {
      return res.status(400).json({ message: result.message || 'Payment verification failed', verified: false });
    }

    res.json({
      verified: true,
      payment_order_id: result.orderId,
      payment_id: result.paymentId,
    });
  } catch (err) {
    console.error('Cashfree verifyPayment error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Verification error' });
  }
};

// POST /api/payment/trek-order — guest-friendly; price computed server-side only
exports.createTrekOrder = async (req, res) => {
  try {
    const {
      trekId,
      trekName = 'Trek Booking',
      people = 1,
      currency = 'INR',
      customerName,
      customerEmail,
      customerPhone,
      couponCode,
    } = req.body;

    if (!trekId) {
      return res.status(400).json({ success: false, message: 'Valid trekId is required' });
    }

    const email = String(customerEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid customerEmail is required' });
    }

    const trek = await findByIdOrSlug(Trek, trekId, {
      baseFilter: { status: 'published' },
      pickName: (row) => row.trekName || row.title || '',
      lean: false,
    });
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found or not published' });
    }

    if (trek.registration?.mode === 'organizer_qr') {
      return res.status(400).json({
        success: false,
        message: 'This trek uses UPI + screenshot payment, not online checkout.',
      });
    }
    if (trek.registration?.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Registration is currently closed for this trek' });
    }
    if (trek.registration?.status === 'not_open_yet') {
      return res.status(400).json({ success: false, message: 'Registration is not open yet for this trek' });
    }

    if (req.user?.userId) {
      const existingBooking = await TrekBooking.findOne({
        trekId: trek._id,
        userId: req.user.userId,
        status: { $in: ['confirmed', 'pending'] },
      }).select('_id status').lean();
      if (existingBooking) {
        return res.status(409).json({
          success: false,
          message: existingBooking.status === 'pending'
            ? 'You already have a registration waiting for organizer approval'
            : 'You already have a registration for this trek',
          bookingId: existingBooking._id,
        });
      }
    }

    const peopleCount = Math.max(1, Number(people) || 1);
    const configuredMax = Number(trek.registration?.maxPeoplePerBooking);
    // Enforce only intentional caps (legacy schema default was 10 = unlimited)
    if (Number.isFinite(configuredMax) && configuredMax > 0 && configuredMax !== 10 && peopleCount > configuredMax) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${configuredMax} people allowed per booking`,
      });
    }

    const genderCheck = await validateTrekGenderRegistration({
      trek,
      userId: req.user?.userId,
      formData: req.body.formData || {},
      people: peopleCount,
    });
    if (!genderCheck.ok) {
      return res.status(genderCheck.status || 400).json({
        success: false,
        message: genderCheck.message,
      });
    }

    const capacity = Math.max(0, Number(trek.maxParticipants) || 0);
    if (capacity > 0) {
      const seatsHeld = await sumTrekConfirmedSeats(trek._id);
      if (seatsHeld >= capacity) {
        return res.status(400).json({ success: false, message: 'This trek is full' });
      }
      if (seatsHeld + peopleCount > capacity) {
        return res.status(400).json({
          success: false,
          message: `Only ${capacity - seatsHeld} seat(s) left`,
        });
      }
    }

    const ticketPricePerPerson = Number(trek.registrationFee) || 0;
    if (ticketPricePerPerson <= 0) {
      return res.status(400).json({ success: false, message: 'This trek does not require payment' });
    }

    // Security: ignore client-supplied baseAmount/amount — server is source of truth
    const baseTicketTotal = ticketPricePerPerson * peopleCount;
    const platformFeePercent = resolveTrekPlatformFeePercent(trek.platformFeePercent, 3);
    const { platformFee, totalAmount: grossTotalAmount } = buildTrekPriceBreakdown(baseTicketTotal, platformFeePercent);
    const coupon = await validateAndPriceCoupon({
      couponCode,
      entityType: 'trek',
      userId: req.user?.userId || null,
      amountBeforeDiscount: grossTotalAmount,
      people: peopleCount,
    });
    const totalAmount = coupon.amountAfterDiscount;
    const resolvedTrekName = trek.trekName || trekName || 'Trek Booking';

    const existingPending = await findReusablePendingOrder({
      customerEmail: email,
      entityType: 'trek',
      entityId: trek._id,
      totalAmount,
      people: peopleCount,
      couponCode: coupon.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      return res.json({
        success: true,
        ...buildOrderResponse(existingPending),
        cashfreeMode: getCashfreeClientMode(),
      });
    }

    const canonicalTrekId = String(trek._id);

    const order = await createCashfreeOrder({
      orderAmount: totalAmount,
      currency,
      customerDetails: {
        customerId: `trek_${canonicalTrekId}`,
        customerName: customerName || 'Trek Guest',
        customerEmail: email,
        customerPhone,
      },
      orderNote: resolvedTrekName,
      orderTags: {
        entityType: 'trek',
        trekId: canonicalTrekId,
        trekName: resolvedTrekName,
        people: String(peopleCount),
        ticketPrice: String(ticketPricePerPerson),
        platformFee: String(platformFee),
        platformFeePercent: String(platformFeePercent),
        couponCode: coupon.couponCode || '',
        couponDiscount: String(coupon.discountAmount || 0),
        amountBeforeDiscount: String(coupon.amountBeforeDiscount),
        amountAfterDiscount: String(coupon.amountAfterDiscount),
        totalAmount: String(totalAmount),
      },
    });

    await PaymentOrder.create({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      entityType: 'trek',
      entityId: trek._id,
      userId: req.user?.userId || null,
      ticketPrice: ticketPricePerPerson,
      platformFee,
      couponCode: coupon.couponCode || '',
      couponDiscount: coupon.discountAmount || 0,
      amountBeforeDiscount: coupon.amountBeforeDiscount,
      amountAfterDiscount: coupon.amountAfterDiscount,
      totalAmount,
      people: peopleCount,
      currency,
      status: 'PENDING',
      orderTags: {
        trekId: canonicalTrekId,
        people: String(peopleCount),
        totalAmount: String(totalAmount),
      },
      customerEmail: email,
    });

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      cashfreeMode: getCashfreeClientMode(),
      amount: order.order_amount,
      currency: order.order_currency,
      ticketPrice: ticketPricePerPerson,
      platformFee,
      couponCode: coupon.couponCode || '',
      couponDiscount: coupon.discountAmount || 0,
      amountBeforeDiscount: coupon.amountBeforeDiscount,
      amountAfterDiscount: coupon.amountAfterDiscount,
      totalAmount,
    });
  } catch (err) {
    respondCashfreeError(res, err, 'Failed to create trek payment order');
  }
};

// POST /api/payment/sports-order — guest-friendly; price computed server-side only
exports.createSportsOrder = async (req, res) => {
  try {
    // Prefer logged-in user for coupon per-user limits when Authorization is present
    if (!req.user?.userId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { getJwtSecret } = require('../config/jwtSecret');
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded?.userId) req.user = { userId: decoded.userId };
      } catch {
        /* guest checkout still allowed */
      }
    }

    const {
      eventId,
      eventName = 'Run Booking',
      people = 1,
      currency = 'INR',
      customerName,
      customerEmail,
      customerPhone,
      couponCode,
      tierId,
    } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Valid eventId is required' });
    }

    const email = String(customerEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid customerEmail is required' });
    }

    const event = await findByIdOrSlug(SportsEvent, eventId, {
      baseFilter: { status: 'published' },
      pickName: (row) => row.title || '',
      lean: false,
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Run not found or not published' });
    }

    if (event.registration?.mode === 'organizer_qr') {
      return res.status(400).json({
        success: false,
        message: 'This run uses UPI + screenshot payment, not online checkout.',
      });
    }
    if (event.registration?.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Registration is currently closed for this run' });
    }

    let ticketPricePerPerson;
    let resolvedTier = null;
    try {
      const priced = resolveSportsPerPersonFee(event, tierId);
      ticketPricePerPerson = priced.fee;
      resolvedTier = priced.tier;
    } catch (e) {
      return res.status(e.status || 400).json({ success: false, message: e.message || 'Invalid tier' });
    }
    if (ticketPricePerPerson <= 0) {
      return res.status(400).json({ success: false, message: 'This run does not require payment' });
    }

    const peopleCount = Math.max(1, Number(people) || 1);
    const maxPeople = event.registration?.maxPeoplePerBooking || event.maxParticipants || 10;
    if (peopleCount > maxPeople) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxPeople} people allowed per booking`,
      });
    }

    const {
      expireStalePendingRegistrations,
      sumConfirmedSeats,
    } = require('../utils/runClubRegistrationGuards');
    await expireStalePendingRegistrations(event._id);
    const capacity = Math.max(0, Number(event.maxParticipants) || 0);
    if (capacity > 0) {
      const seatsHeld = await sumConfirmedSeats(event._id);
      if (seatsHeld >= capacity) {
        return res.status(400).json({
          success: false,
          message: 'This run is full',
        });
      }
      if (seatsHeld + peopleCount > capacity) {
        return res.status(400).json({
          success: false,
          message: `Only ${capacity - seatsHeld} seat(s) left`,
        });
      }
    }

    // Security: ignore client-supplied amount — server is source of truth
    const baseTicketTotal = ticketPricePerPerson * peopleCount;
    const { platformFee, totalAmount: grossTotalAmount } = buildPriceBreakdown(baseTicketTotal);
    const coupon = await validateAndPriceCoupon({
      couponCode,
      entityType: 'sports',
      userId: req.user?.userId || null,
      amountBeforeDiscount: grossTotalAmount,
      people: peopleCount,
    });
    const totalAmount = coupon.amountAfterDiscount;

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No payment required for this booking — confirm without online checkout.',
        skipPayment: true,
        couponCode: coupon.couponCode || '',
        couponDiscount: coupon.discountAmount || 0,
        amountBeforeDiscount: coupon.amountBeforeDiscount,
        amountAfterDiscount: 0,
        totalAmount: 0,
      });
    }
    const resolvedName = event.title || eventName || 'Run Booking';

    const existingPending = await findReusablePendingOrder({
      customerEmail: email,
      entityType: 'sports',
      entityId: event._id,
      totalAmount,
      people: peopleCount,
      couponCode: coupon.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      return res.json({
        success: true,
        ...buildOrderResponse(existingPending),
        cashfreeMode: getCashfreeClientMode(),
      });
    }

    const resolvedEventId = String(event._id);

    const order = await createCashfreeOrder({
      orderAmount: totalAmount,
      currency,
      customerDetails: {
        customerId: `sports_guest_${resolvedEventId}`,
        customerName: customerName || 'Run Guest',
        customerEmail: email,
        customerPhone,
      },
      orderNote: resolvedName,
      orderTags: {
        entityType: 'sports',
        eventId: resolvedEventId,
        eventName: resolvedName,
        people: String(peopleCount),
        ticketPrice: String(ticketPricePerPerson),
        platformFee: String(platformFee),
        couponCode: coupon.couponCode || '',
        couponDiscount: String(coupon.discountAmount || 0),
        amountBeforeDiscount: String(coupon.amountBeforeDiscount),
        amountAfterDiscount: String(coupon.amountAfterDiscount),
        totalAmount: String(totalAmount),
        tierId: resolvedTier?.id || '',
        tierName: resolvedTier?.name || '',
      },
    });

    await PaymentOrder.create({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      entityType: 'sports',
      entityId: event._id,
      userId: req.user?.userId || null,
      ticketPrice: ticketPricePerPerson,
      platformFee,
      couponCode: coupon.couponCode || '',
      couponDiscount: coupon.discountAmount || 0,
      amountBeforeDiscount: coupon.amountBeforeDiscount,
      amountAfterDiscount: coupon.amountAfterDiscount,
      totalAmount,
      people: peopleCount,
      currency,
      status: 'PENDING',
      orderTags: {
        eventId: resolvedEventId,
        people: String(peopleCount),
        totalAmount: String(totalAmount),
        tierId: resolvedTier?.id || '',
        tierName: resolvedTier?.name || '',
      },
      customerEmail: email,
    });

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      cashfreeMode: getCashfreeClientMode(),
      amount: order.order_amount,
      currency: order.order_currency,
      ticketPrice: ticketPricePerPerson,
      platformFee,
      couponCode: coupon.couponCode || '',
      couponDiscount: coupon.discountAmount || 0,
      amountBeforeDiscount: coupon.amountBeforeDiscount,
      amountAfterDiscount: coupon.amountAfterDiscount,
      totalAmount,
      tierId: resolvedTier?.id || '',
      tierName: resolvedTier?.name || '',
    });
  } catch (err) {
    respondCashfreeError(res, err, 'Failed to create run payment order');
  }
};

// POST /api/payment/sports-verify
exports.verifySportsPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = extractPaymentFields(req.body);
    if (!orderId) {
      return res.status(400).json({ verified: false, message: 'Missing order ID' });
    }

    const result = await verifyCashfreePayment({ orderId, paymentId });
    if (!result.verified) {
      return res.status(400).json({ verified: false, message: result.message || 'Payment verification failed' });
    }

    const paymentOrder = await PaymentOrder.findOne({ orderId }).lean();
    let paymentProof = null;
    if (paymentOrder && paymentOrder.entityType === 'sports') {
      await PaymentOrder.updateOne(
        { orderId },
        { status: 'PAID', paymentId: result.paymentId }
      );
      paymentProof = signPaymentProof({
        orderId: result.orderId,
        paymentId: result.paymentId,
        eventId: paymentOrder.entityId,
        totalAmount: paymentOrder.totalAmount,
        people: paymentOrder.people,
      });
    }

    res.json({
      verified: true,
      payment_order_id: result.orderId,
      payment_id: result.paymentId,
      totalAmount: paymentOrder?.totalAmount,
      paymentProof,
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification error' });
  }
};

// POST /api/payment/trek-verify
exports.verifyTrekPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = extractPaymentFields(req.body);
    if (!orderId) {
      return res.status(400).json({ verified: false, message: 'Missing order ID' });
    }

    const result = await verifyCashfreePayment({ orderId, paymentId });
    if (!result.verified) {
      return res.status(400).json({ verified: false, message: result.message || 'Payment verification failed' });
    }

    const paymentOrder = await PaymentOrder.findOne({ orderId }).lean();
    let paymentProof = null;
    if (paymentOrder && paymentOrder.entityType === 'trek') {
      await PaymentOrder.updateOne(
        { orderId },
        { status: 'PAID', paymentId: result.paymentId }
      );
      paymentProof = signPaymentProof({
        orderId: result.orderId,
        paymentId: result.paymentId,
        trekId: paymentOrder.entityId,
        totalAmount: paymentOrder.totalAmount,
        people: paymentOrder.people,
      });
    }

    res.json({
      verified: true,
      payment_order_id: result.orderId,
      payment_id: result.paymentId,
      paymentProof,
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification error' });
  }
};
