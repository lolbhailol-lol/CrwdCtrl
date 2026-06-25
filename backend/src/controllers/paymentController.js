const mongoose = require('mongoose');
const User = require('../model/usermodel');
const Event = require('../model/event_model');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const EventShow = require('../model/event_show_model');
const PaymentOrder = require('../model/payment_order_model');
const { buildPriceBreakdown, buildEventPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');
const {
  createCashfreeOrder,
  verifyCashfreePayment,
  getCashfreeClientMode,
} = require('../services/cashfreeService');
const { extractPaymentFields } = require('../utils/paymentVerification');
const { signPaymentProof } = require('../utils/paymentProof');

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
    const eventShow = await EventShow.findById(resolvedEventShowId).select('title ticketPrice');
    if (!eventShow) return null;
    return {
      entityType: 'event_show',
      ticketPrice: eventShow.ticketPrice,
      notes: { eventShowId: eventShow._id.toString() },
    };
  }

  if (resolvedEventId) {
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
  const { eventId, competitionId, festId, eventShowId, notes = {} } = req.body;
  const pricedEntity = await resolvePricedEntity({ eventId, competitionId, festId, eventShowId, notes });

  if (!pricedEntity) return null;

  const breakdown =
    pricedEntity.entityType === 'event_show'
      ? buildEventPriceBreakdown(pricedEntity.ticketPrice)
      : buildPriceBreakdown(pricedEntity.ticketPrice);

  return {
    ...pricedEntity,
    ...breakdown,
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
      totalAmount: pricing.totalAmount,
      currency: 'INR',
    });
  } catch (err) {
    console.error('Payment quote error:', err);
    res.status(500).json({ message: 'Failed to calculate payment quote' });
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

    const customerDetails = await getCustomerDetails(req);
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
        totalAmount: String(pricing.totalAmount),
      },
    });

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      cashfreeMode: getCashfreeClientMode(),
      amount: order.order_amount,
      currency: order.order_currency,
      ticketPrice: pricing.ticketPrice,
      platformFee: pricing.platformFee,
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
    } = req.body;

    if (!trekId || !mongoose.Types.ObjectId.isValid(trekId)) {
      return res.status(400).json({ success: false, message: 'Valid trekId is required' });
    }

    const email = String(customerEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid customerEmail is required' });
    }

    const trek = await Trek.findOne({ _id: trekId, status: 'published' }).select(
      'trekName registrationFee registration maxParticipants'
    );
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found or not published' });
    }

    const ticketPricePerPerson = Number(trek.registrationFee) || 0;
    if (ticketPricePerPerson <= 0) {
      return res.status(400).json({ success: false, message: 'This trek does not require payment' });
    }

    const peopleCount = Math.max(1, Number(people) || 1);
    const maxPeople =
      trek.registration?.maxPeoplePerBooking || trek.maxParticipants || 15;
    if (peopleCount > maxPeople) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxPeople} people allowed per booking`,
      });
    }

    // Security: ignore client-supplied baseAmount/amount — server is source of truth
    const baseTicketTotal = ticketPricePerPerson * peopleCount;
    const { platformFee, totalAmount } = buildPriceBreakdown(baseTicketTotal);
    const resolvedTrekName = trek.trekName || trekName || 'Trek Booking';

    const order = await createCashfreeOrder({
      orderAmount: totalAmount,
      currency,
      customerDetails: {
        customerId: `trek_guest_${trekId}`,
        customerName: customerName || 'Trek Guest',
        customerEmail: email,
        customerPhone,
      },
      orderNote: resolvedTrekName,
      orderTags: {
        entityType: 'trek',
        trekId: String(trekId),
        trekName: resolvedTrekName,
        people: String(peopleCount),
        ticketPrice: String(ticketPricePerPerson),
        platformFee: String(platformFee),
        totalAmount: String(totalAmount),
      },
    });

    await PaymentOrder.create({
      orderId: order.order_id,
      entityType: 'trek',
      entityId: trek._id,
      userId: req.user?.userId || null,
      ticketPrice: ticketPricePerPerson,
      platformFee,
      totalAmount,
      people: peopleCount,
      currency,
      status: 'PENDING',
      orderTags: {
        trekId: String(trekId),
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
      totalAmount,
    });
  } catch (err) {
    respondCashfreeError(res, err, 'Failed to create trek payment order');
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
