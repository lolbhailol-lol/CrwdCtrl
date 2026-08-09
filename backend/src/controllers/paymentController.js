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
const {
  resolveSportsTicketTotal,
  resolveSportsPerPersonFee,
  resolveEventAddOns,
} = require('../utils/sportsPricing');
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
  const cfMessage =
    cfError?.message
    || cfError?.error
    || (Array.isArray(cfError?.message) ? cfError.message.join(', ') : null)
    || fallbackMessage;
  const status = Number(err.response?.status);
  // Surface gateway validation errors as 400 with Cashfree's message
  if (status >= 400 && status < 500) {
    return res.status(400).json({
      message: typeof cfMessage === 'string' ? cfMessage : fallbackMessage,
      cashfree: cfError || undefined,
    });
  }
  return res.status(500).json({
    message: typeof cfMessage === 'string' ? cfMessage : fallbackMessage,
  });
};

const resolvePricedEntity = async ({
  eventId,
  competitionId,
  festId,
  eventShowId,
  notes = {},
  tierId,
  selectedAddOnIds,
} = {}) => {
  const resolvedEventId = eventId || notes.eventId;
  const resolvedCompetitionId = competitionId || notes.competitionId;
  const resolvedFestId = festId || notes.festId;
  const resolvedEventShowId = eventShowId || notes.eventShowId;
  const resolvedTierId = tierId || notes.tierId || '';

  if (resolvedEventShowId) {
    const eventShow = await findByIdOrSlug(EventShow, resolvedEventShowId, {
      pickName: (row) => row.title || row.displayName || '',
      select: 'title ticketPrice platformFeePercent pricingMode tiers addOns registration.mode registration.allowCoupons',
      lean: true,
    });
    if (!eventShow) return null;

    let ticketPrice = Math.max(0, Number(eventShow.ticketPrice) || 0);
    let tier = null;
    if (eventShow.pricingMode === 'tiers') {
      const priced = resolveSportsPerPersonFee(
        { ...eventShow, registrationFee: eventShow.ticketPrice },
        resolvedTierId,
      );
      ticketPrice = priced.fee;
      tier = priced.tier;
    }

    const addOns = resolveEventAddOns(eventShow, selectedAddOnIds || notes.selectedAddOnIds || []);
    const packagePrice = ticketPrice;
    ticketPrice += addOns.total;
    const isOrganizerQr = (eventShow.registration?.mode || '') === 'organizer_qr';
    return {
      entityType: 'event_show',
      ticketPrice,
      platformFeePercent: isOrganizerQr
        ? 0
        : resolveTrekPlatformFeePercent(eventShow.platformFeePercent, 2.5),
      notes: {
        eventShowId: String(eventShow._id),
        registrationMode: eventShow.registration?.mode || 'internal_form',
        allowCoupons: eventShow.registration?.allowCoupons !== false,
        packagePrice,
        selectedAddOnIds: addOns.selected.map((addOn) => addOn.id),
        selectedAddOns: addOns.selected,
        ...(tier ? { tierId: tier.id, tierName: tier.name } : {}),
      },
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
  const {
    eventId,
    competitionId,
    festId,
    eventShowId,
    notes = {},
    couponCode,
    tierId,
    selectedAddOnIds,
  } = req.body;
  let pricedEntity;
  try {
    pricedEntity = await resolvePricedEntity({
      eventId,
      competitionId,
      festId,
      eventShowId,
      notes,
      tierId,
      selectedAddOnIds,
    });
  } catch (e) {
    if (e.status) {
      const err = new Error(e.message);
      err.status = e.status;
      throw err;
    }
    throw e;
  }

  if (!pricedEntity) return null;

  const breakdown =
    pricedEntity.entityType === 'event_show'
      ? buildEventPriceBreakdown(pricedEntity.ticketPrice, pricedEntity.platformFeePercent ?? 2.5)
      : buildPriceBreakdown(pricedEntity.ticketPrice);

  const coupon = await validateAndPriceCoupon({
    couponCode: pricedEntity.notes?.allowCoupons === false ? '' : couponCode,
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

    if (pricing.entityType === 'event_show' && pricing.notes?.registrationMode === 'organizer_qr') {
      return res.status(400).json({
        message: 'This event uses organizer QR payment. Please complete payment from the registration form.',
      });
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
    if (err.status) return res.status(err.status).json({ message: err.message });
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
        userId: req.user?.userId || req.user?._id || null,
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
      let ticket;
      try {
        ticket = resolveSportsTicketTotal(event, {
          tierId: req.body.tierId || req.body.tier,
          people,
          addOnSelected: req.body.addOnSelected,
          // Coupon preview only — never use inference on create-order / charge paths
          expectedTicketTotal: req.body.expectedTicketTotal ?? req.body.amountBeforeDiscount,
          inferMissingTier: true,
        });
      } catch (e) {
        return res.status(e.status || 400).json({ message: e.message || 'Invalid tier' });
      }
      const baseTicketTotal = ticket.baseTicketTotal;
      // UPI/SS (organizer_qr) has no platform fee — discount against run fee only
      const amountBeforeDiscount = event.registration?.mode === 'organizer_qr'
        ? baseTicketTotal
        : buildPriceBreakdown(baseTicketTotal).totalAmount;
      const coupon = await validateAndPriceCoupon({
        couponCode,
        entityType: 'sports',
        userId: req.user?.userId || req.user?._id || null,
        amountBeforeDiscount,
        people: Math.max(1, Number(people) || 1),
        failOnMissingCode: true,
      });
      return res.json(coupon);
    }

    const pricing = await getPricingForRequest({ body: req.body, user: req.user });
    if (!pricing) return res.status(404).json({ message: 'Paid event not found' });
    if (pricing.notes?.allowCoupons === false && String(couponCode || '').trim()) {
      return res.status(400).json({ message: 'Promo codes are not available for this event.' });
    }
    const coupon = await validateAndPriceCoupon({
      couponCode,
      entityType: pricing.entityType,
      userId: req.user?.userId || req.user?._id || null,
      amountBeforeDiscount: pricing.amountBeforeDiscount ?? pricing.totalAmount,
      people: Math.max(1, Number(people) || 1),
      failOnMissingCode: true,
    });
    return res.json(coupon);
  } catch (err) {
    console.warn('[payment.validateCoupon]', err.message || err);
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
      // Free package (e.g. Independence Day Drive only) — not an error
      return res.json({
        free: true,
        message: 'This registration does not require payment',
        ticketPrice: 0,
        totalAmount: 0,
        entityType: pricing.entityType,
        notes: pricing.notes,
      });
    }

    const entityId = extractEntityId(pricing.notes);
    const customerDetails = await getCustomerDetails(req);
    const userId = req.user?.userId || null;

    const { sanitizeRegistrationDraft } = require('../services/eventShowPaymentFulfillment');
    const registrationDraft = sanitizeRegistrationDraft(req.body.registrationDraft);

    const existingPending = await findReusablePendingOrder({
      userId,
      customerEmail: customerDetails.customerEmail,
      entityType: pricing.entityType,
      entityId,
      totalAmount: pricing.totalAmount,
      couponCode: pricing.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      if (registrationDraft && pricing.entityType === 'event_show') {
        existingPending.orderTags = {
          ...(existingPending.orderTags || {}),
          registrationDraft: {
            ...registrationDraft,
            eventShowId: String(entityId || registrationDraft.eventShowId || ''),
          },
        };
        await existingPending.save().catch(() => {});
      }
      return res.json({
        ...buildOrderResponse(existingPending),
        cashfreeMode: getCashfreeClientMode(),
      });
    }

    // Cashfree order_tags: only simple string pairs; URLs must be https; avoid special chars
    const orderTags = {};
    const allowTag = (key, value) => {
      if (value === undefined || value === null) return;
      const k = String(key || '').trim();
      if (!/^[a-zA-Z0-9_]{1,64}$/.test(k)) return;
      let str = String(value).trim().slice(0, 255);
      if (!str) return;
      // Cashfree rejects non-https looking URL-ish values
      if (/^https?:\/\//i.test(str) && !/^https:\/\//i.test(str)) return;
      // Strip characters that often break CF tag validation (middle dots, etc.)
      str = str.replace(/[^\w\s.@+\-:/]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!str) return;
      orderTags[k] = str;
    };
    allowTag('entityType', pricing.entityType);
    allowTag('eventShowId', pricing.notes?.eventShowId);
    allowTag('tierId', pricing.notes?.tierId);
    allowTag('tierName', pricing.notes?.tierName);
    allowTag('ticketPrice', pricing.ticketPrice);
    allowTag('platformFee', pricing.platformFee);
    allowTag('totalAmount', pricing.totalAmount);
    if (pricing.couponCode) allowTag('couponCode', pricing.couponCode);

    const order = await createCashfreeOrder({
      orderAmount: pricing.totalAmount,
      currency,
      customerDetails,
      orderNote: `${pricing.entityType} registration`,
      orderTags,
    });

    if (entityId) {
      const mongoOrderTags = { ...notes, ...pricing.notes };
      if (registrationDraft && pricing.entityType === 'event_show') {
        mongoOrderTags.registrationDraft = {
          ...registrationDraft,
          eventShowId: String(entityId || registrationDraft.eventShowId || ''),
        };
      }
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
        orderTags: mongoOrderTags,
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
    console.error('[payment.createOrder]', {
      message: err.message,
      status: err.status,
      httpStatus: err.response?.status,
      cf: err.response?.data,
      eventShowId: req.body?.eventShowId,
      tierId: req.body?.tierId,
    });
    // Axios / Cashfree errors have response — never treat as our custom err.status
    if (err.response || err.code === 'CASHFREE_CREDENTIALS_MISSING') {
      return respondCashfreeError(res, err, 'Failed to create payment order');
    }
    if (err.status) return res.status(err.status).json({ message: err.message });
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

    try {
      const updated = await PaymentOrder.findOneAndUpdate(
        { orderId: result.orderId },
        {
          status: 'PAID',
          ...(result.paymentId ? { paymentId: String(result.paymentId) } : {}),
        },
        { upsert: false, new: true },
      );
      if (updated?.entityType === 'event_show' && updated?.orderTags?.registrationDraft) {
        const { fulfillEventShowFromPaidOrder } = require('../services/eventShowPaymentFulfillment');
        fulfillEventShowFromPaidOrder(updated).catch(() => {});
      }
    } catch {
      /* non-fatal — registration paths also mark PAID */
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
    // Prefer logged-in user when Authorization is present (coupons / dedupe)
    if (!req.user?.userId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { getJwtSecret } = require('../config/jwtSecret');
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded?.userId) req.user = { userId: decoded.userId };
      } catch {
        /* guest checkout still allowed when trek.requireLogin is false */
      }
    }

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

    const requireLogin = trek.registration?.requireLogin !== false;
    if (requireLogin && !req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to book this trek.',
        requireLogin: true,
      });
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
      const pendingBooking = await TrekBooking.findOne({
        trekId: trek._id,
        userId: req.user.userId,
        status: 'pending',
      }).select('_id status').sort({ createdAt: -1 }).lean();
      if (pendingBooking) {
        return res.status(409).json({
          success: false,
          message: 'You already have a registration waiting for organizer approval',
          bookingId: pendingBooking._id,
        });
      }
    } else if (email) {
      const pendingGuest = await TrekBooking.findOne({
        trekId: trek._id,
        userEmail: email,
        userId: null,
        status: 'pending',
      }).select('_id status').sort({ createdAt: -1 }).lean();
      if (pendingGuest) {
        return res.status(409).json({
          success: false,
          message: 'This email already has a registration waiting for organizer approval',
          bookingId: pendingGuest._id,
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
      addOnSelected = false,
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

    const requireLogin = event.registration?.requireLogin !== false;
    if (requireLogin && !req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to book this run.',
        requireLogin: true,
      });
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

    let ticket;
    try {
      ticket = resolveSportsTicketTotal(event, { tierId, people, addOnSelected });
    } catch (e) {
      return res.status(e.status || 400).json({ success: false, message: e.message || 'Invalid tier' });
    }
    if (ticket.baseTicketTotal <= 0) {
      return res.status(400).json({ success: false, message: 'This run does not require payment' });
    }

    const peopleCount = ticket.people;
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
    const baseTicketTotal = ticket.baseTicketTotal;
    const resolvedTier = ticket.tier;
    const ticketPricePerPerson = ticket.ticketPricePerPerson + ticket.addOnFeePerPerson;
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
        addOnSelected: ticket.addOnSelected ? '1' : '0',
        addOnLabel: ticket.addOnSelected ? (ticket.addOn?.label || '') : '',
        addOnFee: String(ticket.addOnFeePerPerson || 0),
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
