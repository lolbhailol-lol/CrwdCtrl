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
const { validateTrekGenderRegistration, validateSportsGenderRegistration } = require('../utils/trekGenderRegistration');
const { resolveCompetitionTicketPrice } = require('../utils/competitionFeeTiers');
const { buildPaymentOrderNote } = require('../utils/paymentOrderNote');
const { assertCompetitionAcceptsRegistration } = require('../utils/competitionSlots');

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
  firstValidCustomerPhone,
} = require('../services/cashfreeService');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayKeyId,
} = require('../services/razorpayService');
const TrekCommunity = require('../model/trek_community_model');
const { extractPaymentFields } = require('../utils/paymentVerification');
const { sendVerifyResponse } = require('../utils/paymentVerifyResponse');
const { signPaymentProof } = require('../utils/paymentProof');
const { authorizePaymentVerify } = require('../utils/paymentVerifyAuth');
const { validateAndPriceCoupon } = require('../utils/couponPricing');
const { findByIdOrSlug } = require('../utils/slug');
const {
  listingHubForRunClubId,
  hubSourceFromListing,
  sportsNotFoundMessage,
  sportsActivityNoun,
} = require('../utils/listingHubCopy');
const {
  resolveSportsTicketTotal,
  resolveSportsPerPersonFee,
  resolveEventAddOns,
} = require('../utils/sportsPricing');
const { sanitizeSportsFormDraft } = require('../utils/sportsBookingDraft');
const {
  extractEntityId,
  findReusablePendingOrder,
  buildOrderResponse,
  expireCancelledPaymentOrder,
} = require('../utils/paymentOrderIdempotency');
const { captureFlowEvent } = require('../config/sentry');

const CASHFREE_CONFIG_MSG =
  'Payment gateway credentials are invalid or missing. Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in backend/.env';

const RAZORPAY_CONFIG_MSG =
  'Razorpay credentials are invalid or missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env';

async function resolveTrekCommunityGateway(trek) {
  const communityRef = trek?.communityId;
  if (!communityRef) return 'cashfree';
  const communityId = communityRef._id || communityRef;
  const community = await TrekCommunity.findById(communityId).select('paymentGateway').lean();
  return community?.paymentGateway === 'razorpay' ? 'razorpay' : 'cashfree';
}

const respondRazorpayError = (res, err, fallbackMessage) => {
  const rzError = err.response?.data;
  console.error(fallbackMessage + ':', rzError || err.message);
  if (err.code === 'RAZORPAY_CREDENTIALS_MISSING') {
    return res.status(503).json({ message: RAZORPAY_CONFIG_MSG });
  }
  if (err.code === 'RAZORPAY_INVALID_AMOUNT') {
    return res.status(400).json({ message: err.message || fallbackMessage });
  }
  const status = Number(err.response?.status);
  if (status === 401 || status === 403) {
    return res.status(503).json({ message: RAZORPAY_CONFIG_MSG });
  }
  const rzMessage =
    rzError?.error?.description
    || rzError?.error?.reason
    || rzError?.description
    || fallbackMessage;
  // Surface gateway validation errors as 400 with Razorpay's message
  if (status >= 400 && status < 500) {
    return res.status(400).json({
      message: typeof rzMessage === 'string' ? rzMessage : fallbackMessage,
      razorpay: rzError || undefined,
    });
  }
  return res.status(500).json({
    message: typeof rzMessage === 'string' ? rzMessage : fallbackMessage,
  });
};

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
        eventShowName: eventShow.title || eventShow.displayName || '',
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
    const competition = await Competition.findById(resolvedCompetitionId)
      .select('name feeAmount registrationFee feeTiers fest slotsAllotted registration.maxRegistrations registration.settings.maxRegistrations registration.status')
      .populate('fest', 'platformFeePercent')
      .lean();
    if (!competition) return null;
    await assertCompetitionAcceptsRegistration(competition);
    const { ticketPrice, tier } = resolveCompetitionTicketPrice(competition, resolvedTierId);
    return {
      entityType: 'competition',
      ticketPrice,
      platformFeePercent: resolveTrekPlatformFeePercent(competition.fest?.platformFeePercent, 3),
      notes: {
        competitionId: competition._id.toString(),
        festId: competition.fest?._id?.toString?.() || '',
        competitionName: competition.name || '',
        ...(tier ? { tierId: tier.id, tierName: tier.label } : {}),
      },
    };
  }

  if (resolvedFestId) {
    const fest = await FestOrganizer.findById(resolvedFestId).select('festName feeAmount platformFeePercent').lean();
    if (!fest) return null;
    return {
      entityType: 'fest',
      ticketPrice: fest.feeAmount,
      platformFeePercent: resolveTrekPlatformFeePercent(fest.platformFeePercent, 3),
      notes: { festId: fest._id.toString(), festName: fest.festName || '' },
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
      : buildPriceBreakdown(pricedEntity.ticketPrice, pricedEntity.platformFeePercent ?? 3);

  const coupon = await validateAndPriceCoupon({
    couponCode: pricedEntity.notes?.allowCoupons === false ? '' : couponCode,
    entityType: pricedEntity.entityType,
    userId: req.user?.userId || null,
    amountBeforeDiscount: breakdown.totalAmount,
    people: Math.max(1, Number(req.body.people) || 1),
    festId: pricedEntity.notes?.festId || '',
    competitionId: pricedEntity.notes?.competitionId || '',
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

function phonesFromRegistrationDraft(draft) {
  const formData = draft?.formData && typeof draft.formData === 'object' ? draft.formData : {};
  const members = Array.isArray(formData.team_members) ? formData.team_members : [];
  const first = members.find((member) => member && typeof member === 'object') || {};
  return [
    formData.phone,
    formData.contact_no,
    formData.contact,
    formData.mobile,
    first.phone,
    first.contact,
    first.mobile,
  ];
}

function phonesFromSportsOrderBody(body = {}) {
  const formData = body.formData && typeof body.formData === 'object' ? body.formData : {};
  const extraFields = body.extraFields && typeof body.extraFields === 'object' ? body.extraFields : {};
  return [
    body.customerPhone,
    formData.contact_no,
    formData.phone,
    formData.contact,
    formData.mobile,
    extraFields.contact_no,
    extraFields.phone,
    extraFields.contact,
    extraFields.mobile,
  ];
}

const getCustomerDetails = async (req) => {
  const { customerName, customerEmail, customerPhone, registrationDraft } = req.body || {};
  let user = null;
  if (req.user?.userId) {
    user = await User.findById(req.user.userId).select('name email phoneNumber phone').lean();
  }

  return {
    customerId: user?._id?.toString() || req.user?.userId || `guest_${Date.now()}`,
    customerName: customerName || user?.name,
    customerEmail: customerEmail || user?.email,
    customerPhone: firstValidCustomerPhone([
      customerPhone,
      user?.phoneNumber,
      user?.phone,
      ...phonesFromRegistrationDraft(registrationDraft),
    ]),
  };
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
      const gateway = await resolveTrekCommunityGateway(trek);
      const baseTicketTotal = (Number(trek.registrationFee) || 0) * Math.max(1, Number(people) || 1);
    // Organizer Razorpay: no CrwdCtrl platform fee (money settles to organizer)
      const feePct = gateway === 'razorpay'
        ? 0
        : resolveTrekPlatformFeePercent(trek.platformFeePercent, 3);
      const { totalAmount } = buildTrekPriceBreakdown(baseTicketTotal, feePct);
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
      if (!event) return res.status(404).json({ message: 'Not found or not published' });
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
      const amountBeforeDiscount = baseTicketTotal;
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
      festId: pricing.notes?.festId || '',
      competitionId: pricing.notes?.competitionId || '',
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
    const { sanitizeFestCompetitionDraft } = require('../utils/festCompetitionDraft');
    const eventDraft = sanitizeRegistrationDraft(req.body.registrationDraft);
    const festCompDraft = sanitizeFestCompetitionDraft(req.body.registrationDraft);
    const registrationDraft = eventDraft || festCompDraft;

    const existingPending = await findReusablePendingOrder({
      userId,
      customerEmail: customerDetails.customerEmail,
      entityType: pricing.entityType,
      entityId,
      totalAmount: pricing.totalAmount,
      couponCode: pricing.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      if (registrationDraft && ['event_show', 'fest', 'competition'].includes(pricing.entityType)) {
        const nextTags = {
          ...(existingPending.orderTags || {}),
          registrationDraft: pricing.entityType === 'event_show'
            ? { ...eventDraft, eventShowId: String(entityId || eventDraft?.eventShowId || '') }
            : {
              ...festCompDraft,
              festId: String(entityId || festCompDraft?.festId || pricing.notes?.festId || ''),
              competitionId: String(
                entityId || festCompDraft?.competitionId || pricing.notes?.competitionId || '',
              ),
            },
        };
        // Prefer updateOne so lean/plain objects never break checkout reuse
        await PaymentOrder.updateOne(
          { _id: existingPending._id },
          { $set: { orderTags: nextTags } },
        ).catch(() => {});
        existingPending.orderTags = nextTags;
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
    allowTag('competitionName', pricing.notes?.competitionName);
    allowTag('festName', pricing.notes?.festName);
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
      orderNote: buildPaymentOrderNote(pricing),
      orderTags,
    });

    if (entityId) {
      const mongoOrderTags = { ...notes, ...pricing.notes };
      if (registrationDraft && ['event_show', 'fest', 'competition'].includes(pricing.entityType)) {
        mongoOrderTags.registrationDraft = pricing.entityType === 'event_show'
          ? { ...eventDraft, eventShowId: String(entityId || eventDraft?.eventShowId || '') }
          : {
            ...festCompDraft,
            festId: String(entityId || festCompDraft?.festId || pricing.notes?.festId || ''),
            competitionId: String(
              entityId || festCompDraft?.competitionId || pricing.notes?.competitionId || '',
            ),
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
async function markOrderPaidAndFulfill(result) {
  try {
    const updated = await PaymentOrder.findOneAndUpdate(
      { orderId: result.orderId },
      {
        status: 'PAID',
        ...(result.paymentId ? { paymentId: String(result.paymentId) } : {}),
      },
      { upsert: false, new: true },
    );
    if (!updated) return null;
    if (updated.entityType === 'event_show' && updated.orderTags?.registrationDraft) {
      const { fulfillEventShowFromPaidOrder } = require('../services/eventShowPaymentFulfillment');
      fulfillEventShowFromPaidOrder(updated).catch(() => {});
    }
    if (['fest', 'competition'].includes(updated.entityType) && updated.orderTags?.registrationDraft) {
      const { fulfillFestCompetitionFromPaidOrder } = require('../services/festCompetitionPaymentFulfillment');
      fulfillFestCompetitionFromPaidOrder(updated).catch(() => {});
    }
    return updated;
  } catch {
    return null;
  }
}

exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = extractPaymentFields(req.body);

    if (!orderId) {
      return res.status(400).json({
        verified: false,
        status: 'failed',
        code: 'MISSING_ORDER_ID',
        message: 'Missing payment order ID',
        retryable: false,
      });
    }

    const paymentOrderForMerchant = await PaymentOrder.findOne({ orderId: String(orderId) })
      .select('cashfreeMerchant')
      .lean();
    const result = await verifyCashfreePayment({
      orderId,
      paymentId,
      merchant: paymentOrderForMerchant?.cashfreeMerchant === 'events' ? 'events' : 'platform',
    });
    if (result.status === 'cancelled' || result.status === 'failed') {
      expireCancelledPaymentOrder(orderId).catch(() => {});
    }
    let paymentOrder = null;
    if (result.verified) {
      paymentOrder = await markOrderPaidAndFulfill(result);
    }
    if (!paymentOrder) {
      paymentOrder = await PaymentOrder.findOne({ orderId: String(orderId) });
    }

    const extras = {};
    if (paymentOrder) {
      const draft = paymentOrder.orderTags?.registrationDraft || {};
      const entityType = paymentOrder.entityType || draft.entityType || 'fest';
      let competitionId = entityType === 'competition'
        ? String(paymentOrder.entityId || draft.competitionId || '')
        : String(draft.competitionId || '');
      let festId = entityType === 'fest'
        ? String(paymentOrder.entityId || draft.festId || '')
        : String(draft.festId || paymentOrder.orderTags?.festId || '');

      if (entityType === 'competition' && !festId && paymentOrder.entityId) {
        try {
          const comp = await Competition.findById(paymentOrder.entityId).select('fest').lean();
          if (comp?.fest) festId = String(comp.fest);
        } catch {
          /* ignore */
        }
      }

      let registrationId = null;
      if (result.verified && req.user?.userId) {
        try {
          const Registration = require('../model/registration_model');
          const regQuery = {
            payment_order_id: String(orderId),
            user: req.user.userId,
          };
          if (competitionId) regQuery.competitionId = competitionId;
          else if (festId) {
            regQuery.fest = festId;
            regQuery.competitionId = null;
          }
          const reg = await Registration.findOne(regQuery).select('_id').lean();
          registrationId = reg?._id ? String(reg._id) : null;
        } catch {
          /* ignore */
        }
      }

      extras.recovery = {
        entityType,
        entityId: paymentOrder.entityId ? String(paymentOrder.entityId) : null,
        festId: festId || null,
        competitionId: competitionId || null,
        registrationId,
      };
    }

    if (!result.verified) {
      captureFlowEvent('payment_verify', result.status || 'not_verified', {
        entityType: paymentOrder?.entityType || 'fest',
        code: result.code,
      });
    }
    return sendVerifyResponse(res, result, extras);
  } catch (err) {
    console.error('Cashfree verifyPayment error:', err.response?.data || err.message);
    captureFlowEvent('payment_verify', 'error', { message: err.message });
    res.status(500).json({
      verified: false,
      status: 'failed',
      code: 'VERIFICATION_ERROR',
      message: 'Verification error',
      retryable: true,
    });
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

    const gateway = await resolveTrekCommunityGateway(trek);

    // Security: ignore client-supplied baseAmount/amount — server is source of truth
    const baseTicketTotal = ticketPricePerPerson * peopleCount;
    // Organizer Razorpay settles to community merchant — no platform fee on the charge
    const platformFeePercent = gateway === 'razorpay'
      ? 0
      : resolveTrekPlatformFeePercent(trek.platformFeePercent, 3);
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
      gateway,
    });
    if (existingPending?.orderId && (
      existingPending.gateway === 'razorpay'
        ? true
        : Boolean(existingPending.paymentSessionId)
    )) {
      const reusedGateway = existingPending.gateway === 'razorpay' ? 'razorpay' : 'cashfree';
      const alreadyPaid = Boolean(
        existingPending._alreadyPaidAtGateway
        || existingPending.status === 'PAID',
      );
      return res.json({
        success: true,
        gateway: reusedGateway,
        alreadyPaid,
        paymentId: existingPending.paymentId || null,
        ...(reusedGateway === 'razorpay'
          ? {
              keyId: getRazorpayKeyId(),
              amountPaise: Math.round(Number(existingPending.totalAmount) * 100),
            }
          : { cashfreeMode: getCashfreeClientMode() }),
        ...buildOrderResponse(existingPending),
      });
    }

    const canonicalTrekId = String(trek._id);
    const orderTags = {
      trekId: canonicalTrekId,
      people: String(peopleCount),
      totalAmount: String(totalAmount),
      gateway,
    };

    if (gateway === 'razorpay') {
      const order = await createRazorpayOrder({
        orderAmount: totalAmount,
        currency,
        receipt: `trek_${canonicalTrekId}`.slice(0, 40),
        notes: {
          entityType: 'trek',
          trekId: canonicalTrekId,
          people: String(peopleCount),
          coupon: coupon.couponCode || '',
        },
      });

      await PaymentOrder.create({
        orderId: order.order_id,
        paymentSessionId: null,
        gateway: 'razorpay',
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
        orderTags,
        customerEmail: email,
        customerPhone: firstValidCustomerPhone([customerPhone]) || '',
      });

      return res.json({
        gateway: 'razorpay',
        orderId: order.order_id,
        keyId: getRazorpayKeyId(),
        paymentSessionId: null,
        amount: totalAmount,
        amountPaise: order.amount,
        currency: order.currency || currency,
        ticketPrice: ticketPricePerPerson,
        platformFee,
        couponCode: coupon.couponCode || '',
        couponDiscount: coupon.discountAmount || 0,
        amountBeforeDiscount: coupon.amountBeforeDiscount,
        amountAfterDiscount: coupon.amountAfterDiscount,
        totalAmount,
      });
    }

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
      gateway: 'cashfree',
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
      orderTags,
      customerEmail: email,
    });

    res.json({
      gateway: 'cashfree',
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
    const isRazorpay =
      err.code === 'RAZORPAY_CREDENTIALS_MISSING'
      || err.code === 'RAZORPAY_INVALID_AMOUNT'
      || /razorpay/i.test(String(err.response?.config?.url || ''))
      || /razorpay/i.test(String(err.message || ''));
    if (isRazorpay) {
      return respondRazorpayError(res, err, 'Failed to create trek payment order');
    }
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
      gender,
      formData,
      extraFields,
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
    let listingHub = 'sports';
    if (event) {
      listingHub = await listingHubForRunClubId(event.runClubId);
    } else {
      const unpublished = await findByIdOrSlug(SportsEvent, eventId, {
        pickName: (row) => row.title || '',
        lean: true,
      });
      if (unpublished) listingHub = await listingHubForRunClubId(unpublished.runClubId);
    }
    const hub = hubSourceFromListing(listingHub);
    const noun = sportsActivityNoun(hub);
    if (!event) {
      return res.status(404).json({ success: false, message: sportsNotFoundMessage(hub, { orNotPublished: true }) });
    }

    const requireLogin = event.registration?.requireLogin !== false;
    if (requireLogin && !req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: `Please log in to book this ${noun}.`,
        requireLogin: true,
      });
    }

    if (event.registration?.mode === 'organizer_qr') {
      return res.status(400).json({
        success: false,
        message: `This ${noun} uses UPI + screenshot payment, not online checkout.`,
      });
    }
    if (event.registration?.status === 'closed') {
      return res.status(400).json({ success: false, message: `Registration is currently closed for this ${noun}` });
    }

    let ticket;
    try {
      ticket = resolveSportsTicketTotal(event, { tierId, people, addOnSelected });
    } catch (e) {
      return res.status(e.status || 400).json({ success: false, message: e.message || 'Invalid tier' });
    }
    if (ticket.baseTicketTotal <= 0) {
      return res.status(400).json({ success: false, message: `This ${noun} does not require payment` });
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
          message: `This ${noun} is full`,
        });
      }
      if (seatsHeld + peopleCount > capacity) {
        return res.status(400).json({
          success: false,
          message: `Only ${capacity - seatsHeld} seat(s) left`,
        });
      }
    }

    const genderCheck = await validateSportsGenderRegistration({
      event,
      formData: { ...(formData && typeof formData === 'object' ? formData : {}), gender },
      people: peopleCount,
    });
    if (!genderCheck.ok) {
      return res.status(genderCheck.status || 400).json({
        success: false,
        message: genderCheck.message,
      });
    }

    // Security: ignore client-supplied amount — server is source of truth
    const baseTicketTotal = ticket.baseTicketTotal;
    const resolvedTier = ticket.tier;
    const ticketPricePerPerson = ticket.ticketPricePerPerson + ticket.addOnFeePerPerson;
    const platformFee = 0;
    const grossTotalAmount = baseTicketTotal;
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
    const resolvedName = event.title || eventName || (noun === 'event' ? 'Event booking' : 'Run Booking');

    let profilePhone = '';
    if (req.user?.userId) {
      const profile = await User.findById(req.user.userId).select('phoneNumber phone').lean();
      profilePhone = profile?.phoneNumber || profile?.phone || '';
    }
    const resolvedPhone = firstValidCustomerPhone([
      ...phonesFromSportsOrderBody(req.body),
      profilePhone,
    ]);
    if (!resolvedPhone) {
      return res.status(400).json({
        success: false,
        message: 'A 10-digit mobile number is required.',
      });
    }

    const formDraft = sanitizeSportsFormDraft(
      {
        ...(extraFields && typeof extraFields === 'object' ? extraFields : {}),
        ...(formData && typeof formData === 'object' ? formData : {}),
      },
      {
        gender,
        customerName,
        customerEmail: email,
        customerPhone: resolvedPhone,
      },
    );

    const cashfreeMerchant = listingHub === 'events' ? 'events' : 'platform';
    const cashfreeMode = getCashfreeClientMode(cashfreeMerchant);

    const existingPending = await findReusablePendingOrder({
      userId: req.user?.userId || null,
      customerEmail: email,
      entityType: 'sports',
      entityId: event._id,
      totalAmount,
      people: peopleCount,
      couponCode: coupon.couponCode,
    });
    if (existingPending?.paymentSessionId) {
      // Do not reuse a session from the other Cashfree merchant
      if ((existingPending.cashfreeMerchant || 'platform') !== cashfreeMerchant) {
        existingPending.status = 'EXPIRED';
        await existingPending.save().catch(() => {});
      } else {
        existingPending.orderTags = {
          ...(existingPending.orderTags && typeof existingPending.orderTags === 'object'
            ? existingPending.orderTags
            : {}),
          formData: formDraft,
          gender: formDraft.gender || gender || '',
        };
        if (resolvedPhone) existingPending.customerPhone = resolvedPhone;
        await existingPending.save().catch(() => {});
        return res.json({
          success: true,
          ...buildOrderResponse(existingPending),
          cashfreeMode,
          cashfreeMerchant,
        });
      }
    }

    const resolvedEventId = String(event._id);

    // Cashfree max 15 order_tags — keep essentials here; full metadata in PaymentOrder
    const cashfreeOrderTags = {
      entityType: 'sports',
      eventId: resolvedEventId,
      people: String(peopleCount),
      totalAmount: String(totalAmount),
      ticketPrice: String(ticketPricePerPerson),
      merchant: cashfreeMerchant,
    };
    if (coupon.couponCode) cashfreeOrderTags.couponCode = coupon.couponCode;
    if (Number(coupon.discountAmount) > 0) {
      cashfreeOrderTags.couponDiscount = String(coupon.discountAmount);
      cashfreeOrderTags.amountBeforeDiscount = String(coupon.amountBeforeDiscount);
    }
    if (resolvedTier?.id) cashfreeOrderTags.tierId = resolvedTier.id;
    if (ticket.addOnSelected) {
      cashfreeOrderTags.addOnSelected = '1';
      cashfreeOrderTags.addOnFee = String(ticket.addOnFeePerPerson || 0);
    }

    const order = await createCashfreeOrder({
      orderAmount: totalAmount,
      currency,
      customerDetails: {
        customerId: `sports_guest_${resolvedEventId}`,
        customerName: customerName || 'Run Guest',
        customerEmail: email,
        customerPhone: resolvedPhone,
      },
      orderNote: resolvedName,
      orderTags: cashfreeOrderTags,
      merchant: cashfreeMerchant,
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
      gateway: 'cashfree',
      cashfreeMerchant,
      orderTags: {
        eventId: resolvedEventId,
        eventName: resolvedName,
        people: String(peopleCount),
        totalAmount: String(totalAmount),
        tierId: resolvedTier?.id || '',
        tierName: resolvedTier?.name || '',
        addOnSelected: ticket.addOnSelected ? '1' : '0',
        addOnLabel: ticket.addOnSelected ? (ticket.addOn?.label || '') : '',
        addOnFee: String(ticket.addOnFeePerPerson || 0),
        formData: formDraft,
        gender: formDraft.gender || gender || '',
        listingHub,
      },
      customerEmail: email,
      customerPhone: resolvedPhone,
    });

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      cashfreeMode,
      cashfreeMerchant,
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

const CategoryRegistration = require('../model/category_registration_model');

/**
 * After sports payment verify, ensure registration exists and return its id.
 */
async function fulfillSportsOrderAndGetRegistration(orderId, overrides = {}) {
  if (!orderId) return { registrationId: null, fulfillmentError: null };
  const PaymentOrder = require('../model/payment_order_model');
  const { fulfillSportsFromPaidOrder } = require('../services/sportsPaymentFulfillment');
  const fullOrder = await PaymentOrder.findOne({ orderId: String(orderId) });
  if (!fullOrder || fullOrder.entityType !== 'sports') {
    return { registrationId: null, fulfillmentError: null };
  }
  try {
    const result = await fulfillSportsFromPaidOrder(fullOrder, overrides);
    if (result.ok && result.registration?._id) {
      return { registrationId: String(result.registration._id), fulfillmentError: null };
    }
    if (!result.ok && !result.skipped) {
      return { registrationId: null, fulfillmentError: result.error || 'Fulfillment failed' };
    }
    const existing = await CategoryRegistration.findOne({ payment_order_id: String(orderId) })
      .select('_id')
      .lean();
    return { registrationId: existing?._id ? String(existing._id) : null, fulfillmentError: null };
  } catch (err) {
    return { registrationId: null, fulfillmentError: err?.message || 'Fulfillment failed' };
  }
}

// POST /api/payment/sports-verify
exports.verifySportsPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = extractPaymentFields(req.body);
    if (!orderId) {
      return res.status(400).json({
        verified: false,
        status: 'failed',
        code: 'MISSING_ORDER_ID',
        message: 'Missing order ID',
        retryable: false,
      });
    }

    let paymentOrder = await PaymentOrder.findOne({ orderId }).lean();

    // Enforce ownership before calling Cashfree so leaked order IDs can't be
    // used to spam the gateway or mint payment proofs for other users.
    const authz = authorizePaymentVerify({ paymentOrder, req });
    if (!authz.ok) {
      return res.status(authz.status).json({
        verified: false,
        status: 'failed',
        code: authz.code,
        message: authz.message,
        retryable: false,
      });
    }

    // Idempotency: if the order is already PAID, return the cached success
    // instead of re-hitting Cashfree.
    if (paymentOrder?.status === 'PAID' && paymentOrder.entityType === 'sports') {
      const { registrationId, fulfillmentError } = await fulfillSportsOrderAndGetRegistration(
        paymentOrder.orderId,
      );
      const paymentProof = signPaymentProof({
        orderId: paymentOrder.orderId,
        paymentId: paymentOrder.paymentId || paymentId || null,
        eventId: paymentOrder.entityId,
        totalAmount: paymentOrder.totalAmount,
        people: paymentOrder.people,
      });
      return sendVerifyResponse(
        res,
        {
          verified: true,
          orderId: paymentOrder.orderId,
          paymentId: paymentOrder.paymentId || null,
          status: 'paid',
          code: 'PAYMENT_PAID',
        },
        {
          totalAmount: paymentOrder.totalAmount,
          paymentProof,
          registrationId,
          fulfillmentError,
        },
      );
    }

    const result = await verifyCashfreePayment({
      orderId,
      paymentId,
      merchant: paymentOrder?.cashfreeMerchant === 'events' ? 'events' : 'platform',
    });
    let paymentProof = null;

    if (result.verified) {
      if (!paymentOrder) paymentOrder = await PaymentOrder.findOne({ orderId }).lean();
      if (paymentOrder && paymentOrder.entityType === 'sports') {
        const phone = firstValidCustomerPhone([
          result.customerPhone,
          paymentOrder.customerPhone,
          paymentOrder.orderTags?.formData?.contact_no,
          paymentOrder.orderTags?.formData?.phone,
        ]);
        await PaymentOrder.updateOne(
          { orderId },
          {
            status: 'PAID',
            paymentId: result.paymentId,
            ...(phone ? { customerPhone: phone } : {}),
          },
        );
        const { registrationId, fulfillmentError } = await fulfillSportsOrderAndGetRegistration(
          orderId,
          { paymentId: result.paymentId, markPaid: true },
        );
        paymentProof = signPaymentProof({
          orderId: result.orderId,
          paymentId: result.paymentId,
          eventId: paymentOrder.entityId,
          totalAmount: paymentOrder.totalAmount,
          people: paymentOrder.people,
        });
        return sendVerifyResponse(res, result, {
          totalAmount: paymentOrder.totalAmount,
          paymentProof,
          registrationId,
          fulfillmentError,
        });
      }
    }

    return sendVerifyResponse(res, result, {
      totalAmount: paymentOrder?.totalAmount,
      paymentProof,
    });
  } catch (err) {
    res.status(500).json({
      verified: false,
      status: 'failed',
      code: 'VERIFICATION_ERROR',
      message: 'Verification error',
      retryable: true,
    });
  }
};

// POST /api/payment/trek-verify
exports.verifyTrekPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = extractPaymentFields(req.body);
    if (!orderId) {
      return res.status(400).json({
        verified: false,
        status: 'failed',
        code: 'MISSING_ORDER_ID',
        message: 'Missing order ID',
        retryable: false,
      });
    }

    let paymentOrder = await PaymentOrder.findOne({ orderId }).lean();

    const authz = authorizePaymentVerify({ paymentOrder, req });
    if (!authz.ok) {
      return res.status(authz.status).json({
        verified: false,
        status: 'failed',
        code: authz.code,
        message: authz.message,
        retryable: false,
      });
    }

    if (paymentOrder?.status === 'PAID' && paymentOrder.entityType === 'trek') {
      const paymentProof = signPaymentProof({
        orderId: paymentOrder.orderId,
        paymentId: paymentOrder.paymentId || paymentId || null,
        trekId: paymentOrder.entityId,
        totalAmount: paymentOrder.totalAmount,
        people: paymentOrder.people,
      });
      return sendVerifyResponse(
        res,
        {
          verified: true,
          orderId: paymentOrder.orderId,
          paymentId: paymentOrder.paymentId || null,
          status: 'paid',
          code: 'PAYMENT_PAID',
        },
        { totalAmount: paymentOrder.totalAmount, paymentProof },
      );
    }

    // Trust PaymentOrder.gateway when present. Never infer Razorpay from a loose
    // `signature` alone — Cashfree order ids also look like order_… and stray
    // signature keys must not divert a Cashfree verify into Razorpay HMAC checks.
    let gateway = paymentOrder?.gateway === 'razorpay' ? 'razorpay' : 'cashfree';
    if (!paymentOrder) {
      const body = req.body || {};
      const hasRazorpayTriple = Boolean(
        body.razorpay_signature
        && body.razorpay_order_id
        && (body.razorpay_payment_id || body.payment_id || body.paymentId),
      );
      gateway = hasRazorpayTriple ? 'razorpay' : 'cashfree';
    }
    const result = gateway === 'razorpay'
      ? await verifyRazorpayPayment({ orderId, paymentId, signature })
      : await verifyCashfreePayment({
          orderId,
          paymentId,
          merchant: paymentOrder?.cashfreeMerchant === 'events' ? 'events' : 'platform',
        });
    let paymentProof = null;

    if (result.verified) {
      if (!paymentOrder) paymentOrder = await PaymentOrder.findOne({ orderId }).lean();
      if (paymentOrder && paymentOrder.entityType === 'trek') {
        await PaymentOrder.updateOne(
          { orderId },
          { status: 'PAID', paymentId: result.paymentId },
        );
        paymentProof = signPaymentProof({
          orderId: result.orderId,
          paymentId: result.paymentId,
          trekId: paymentOrder.entityId,
          totalAmount: paymentOrder.totalAmount,
          people: paymentOrder.people,
        });
      }
    }

    return sendVerifyResponse(res, result, {
      totalAmount: paymentOrder?.totalAmount,
      paymentProof,
    });
  } catch (err) {
    console.error('trek-verify error:', err.response?.data || err.message);
    res.status(500).json({
      verified: false,
      status: 'failed',
      code: 'VERIFICATION_ERROR',
      message: 'Verification error',
      retryable: true,
    });
  }
};
