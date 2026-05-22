const Razorpay = require('razorpay');
const crypto = require('crypto');
const Event = require('../model/event_model');
const Competition = require('../model/competition_model');
const FestOrganizer = require('../model/fest_organizer_model');
const { buildPriceBreakdown, parseTicketPrice } = require('../utils/platformFee');

let _razorpay;
const getRazorpay = () => {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
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
    console.error('Razorpay quote error:', err);
    res.status(500).json({ message: 'Failed to calculate payment quote' });
  }
};

// POST /api/payment/order
// Body: { eventId | competitionId | festId, currency?, notes? }
// Auth: Required
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

    const order = await getRazorpay().orders.create({
      amount: Math.round(pricing.totalAmount * 100),
      currency,
      notes: {
        ...notes,
        ...pricing.notes,
        entityType: pricing.entityType,
        ticketPrice: pricing.ticketPrice,
        platformFee: pricing.platformFee,
        totalAmount: pricing.totalAmount,
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      ticketPrice: pricing.ticketPrice,
      platformFee: pricing.platformFee,
      totalAmount: pricing.totalAmount,
    });
  } catch (err) {
    console.error('Razorpay createOrder error:', err);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

// POST /api/payment/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Auth: Required
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment fields', verified: false });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed', verified: false });
    }

    res.json({ verified: true, razorpay_payment_id, razorpay_order_id });
  } catch (err) {
    console.error('Razorpay verifyPayment error:', err);
    res.status(500).json({ message: 'Verification error' });
  }
};

// POST /api/payment/trek-order  (no auth — public trek booking)
// Body: { baseAmount, trekId, trekName, people }
exports.createTrekOrder = async (req, res) => {
  try {
    const { buildPriceBreakdown } = require('../utils/platformFee');
    const { baseAmount, amount, trekId, trekName = 'Trek Booking', people = 1, currency = 'INR' } = req.body;
    const ticketPrice = Number(baseAmount || amount || 0);
    if (!ticketPrice || ticketPrice <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const { platformFee, totalAmount } = buildPriceBreakdown(ticketPrice * Number(people || 1));
    const order = await getRazorpay().orders.create({
      amount: Math.round(totalAmount * 100),
      currency,
      notes: { trekId, trekName, people: String(people), ticketPrice, platformFee, totalAmount },
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      ticketPrice,
      platformFee,
      totalAmount,
    });
  } catch (err) {
    console.error('Trek order error:', err);
    res.status(500).json({ message: 'Failed to create trek payment order' });
  }
};

// POST /api/payment/trek-verify  (no auth — public)
exports.verifyTrekPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ verified: false, message: 'Signature mismatch' });
    }
    res.json({ verified: true, razorpay_payment_id, razorpay_order_id });
  } catch (err) {
    res.status(500).json({ verified: false, message: 'Verification error' });
  }
};
