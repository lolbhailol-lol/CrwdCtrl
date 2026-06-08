const User = require('../model/usermodel');
const Event = require('../model/event_model');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const { buildPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');
const { createCashfreeOrder, verifyCashfreePayment } = require('../services/cashfreeService');
const { extractPaymentFields } = require('../utils/paymentVerification');

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

const resolvePricedEntity = async ({ eventId, competitionId, festId, notes = {} }) => {
  const resolvedEventId = eventId || notes.eventId;
  const resolvedCompetitionId = competitionId || notes.competitionId;
  const resolvedFestId = festId || notes.festId;

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
  const { eventId, competitionId, festId, notes = {} } = req.body;
  const pricedEntity = await resolvePricedEntity({ eventId, competitionId, festId, notes });

  if (!pricedEntity) return null;

  return {
    ...pricedEntity,
    ...buildPriceBreakdown(pricedEntity.ticketPrice),
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

// POST /api/payment/trek-order
exports.createTrekOrder = async (req, res) => {
  try {
    const {
      baseAmount,
      amount,
      trekId,
      trekName = 'Trek Booking',
      people = 1,
      currency = 'INR',
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    let ticketPrice = Number(baseAmount || amount || 0);

    if (trekId) {
      const trek = await Trek.findById(trekId).select('trekName registrationFee');
      if (!trek) {
        return res.status(404).json({ success: false, message: 'Trek not found' });
      }
      ticketPrice = Number(trek.registrationFee || 0);
    }

    if (!ticketPrice || ticketPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const resolvedTrekName = trekName || 'Trek Booking';
    const { platformFee, totalAmount } = buildPriceBreakdown(ticketPrice * Number(people || 1));
    const order = await createCashfreeOrder({
      orderAmount: totalAmount,
      currency,
      customerDetails: {
        customerId: trekId || `trek_${Date.now()}`,
        customerName,
        customerEmail,
        customerPhone,
      },
      orderNote: resolvedTrekName,
      orderTags: {
        trekId: String(trekId || ''),
        trekName: resolvedTrekName,
        people: String(people),
        ticketPrice: String(ticketPrice),
        platformFee: String(platformFee),
        totalAmount: String(totalAmount),
      },
    });

    res.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      amount: order.order_amount,
      currency: order.order_currency,
      ticketPrice,
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

    res.json({
      verified: true,
      payment_order_id: result.orderId,
      payment_id: result.paymentId,
    });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification error' });
  }
};
