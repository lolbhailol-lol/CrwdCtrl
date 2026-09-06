/**
 * After Cashfree marks a trek order PAID, create TrekBooking from formData
 * stored on PaymentOrder at checkout. Idempotent by payment_order_id.
 * Covers webhook miss + guest never returning from UPI / GPay.
 */
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const PaymentOrder = require('../model/payment_order_model');
const User = require('../model/usermodel');
const { validateTrekGenderRegistration } = require('../utils/trekGenderRegistration');
const { resolveTrekGroupLink } = require('../utils/resolveTrekGroupLink');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { signTrekBookingAccess } = require('../utils/bookingAccess');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('./pushService');
const { sendTrekRegistrationEmails } = require('./emailService');
const { logger } = require('../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractGuestEmail(data = {}) {
  const direct = String(
    data.email || data.e_mail_id || data.e_mail || data.Email || data['E-mail'] || '',
  ).trim().toLowerCase();
  if (EMAIL_REGEX.test(direct)) return direct;
  for (const value of Object.values(data || {})) {
    if (typeof value !== 'string') continue;
    const v = value.trim().toLowerCase();
    if (EMAIL_REGEX.test(v)) return v;
  }
  return '';
}

function extractGuestName(data = {}) {
  return String(
    data.full_name || data.name || data.Name || data['Full Name'] || '',
  ).trim();
}

async function sumTrekConfirmedSeats(trekId) {
  const seatAgg = await TrekBooking.aggregate([
    { $match: { trekId, status: 'confirmed' } },
    { $group: { _id: null, seats: { $sum: { $ifNull: ['$bookingDetails.people', 1] } } } },
  ]);
  return Number(seatAgg[0]?.seats) || 0;
}

function dispatchConfirmation({
  userId,
  userEmail,
  userName,
  trekName,
  bookingId,
  bookingDetails = {},
  amountPaid = 0,
  groupLink = '',
  communityName = '',
  accessToken = '',
}) {
  const accessQuery = accessToken ? `&access=${encodeURIComponent(accessToken)}` : '';
  const link = `/registration-details/${bookingId}?type=trek${accessQuery}`;
  const ticketLink = `/qr-ticket/${bookingId}?type=trek${accessQuery}`;
  void (async () => {
    try {
      await sendTrekRegistrationEmails({
        userEmail,
        userName,
        trekName,
        bookingId,
        bookingDetails: {
          date: bookingDetails.date || '',
          time: bookingDetails.time || '',
        },
        amountPaid,
        groupLink,
        communityName,
        ticketLink,
      });
      if (!userId) return;
      await createNotification({
        userId,
        title: 'Trek Booking Confirmed!',
        message: `You've successfully registered for ${trekName}.`,
        type: 'registration',
        link,
        metadata: { registrationId: bookingId },
      });
      sendPushNotification(userId, {
        title: 'Trek Booking Confirmed!',
        body: `You've registered for ${trekName}.`,
        link,
        type: 'registration',
      }).catch(() => {});
    } catch (err) {
      logger.error('[trekFulfill.notify]', err.message);
    }
  })();
}

/**
 * @param {object|string} paymentOrderInput
 * @param {{ markPaid?: boolean, paymentId?: string }} [overrides]
 */
async function fulfillTrekFromPaidOrder(paymentOrderInput, overrides = {}) {
  const orderId = paymentOrderInput?.orderId || paymentOrderInput;
  if (!orderId) return { ok: false, error: 'Missing order id' };

  const paymentOrder = typeof paymentOrderInput === 'object' && paymentOrderInput.orderId
    ? paymentOrderInput
    : await PaymentOrder.findOne({ orderId: String(orderId) });

  if (!paymentOrder) return { ok: false, error: 'Payment order not found' };
  if (paymentOrder.entityType !== 'trek') {
    return { ok: false, skipped: true, error: 'Not a trek order' };
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

  const payment_order_id = paymentOrder.orderId;
  const payment_id = paymentOrder.paymentId || overrides.paymentId || null;

  const existingByOrder = await TrekBooking.findOne({ payment_order_id });
  if (existingByOrder) {
    return {
      ok: true,
      alreadyCompleted: true,
      booking: existingByOrder,
    };
  }

  const formData = paymentOrder.orderTags?.formData;
  if (!formData || typeof formData !== 'object' || !Object.keys(formData).length) {
    return { ok: false, error: 'No form data available for this payment' };
  }

  const trekId = paymentOrder.entityId;
  if (!trekId) return { ok: false, error: 'Missing trek id on payment order' };

  const trek = await Trek.findById(trekId)
    .populate('communityId', 'name groupLink')
    .lean();
  if (!trek) return { ok: false, error: 'Trek not found' };

  if ((trek.registration?.mode || 'internal_form') === 'organizer_qr') {
    return { ok: false, skipped: true, error: 'Organizer QR treks are not auto-fulfilled' };
  }

  const people = Math.max(1, Number(paymentOrder.people) || 1);
  const amountPaid = Number(paymentOrder.totalAmount) || 0;
  const userId = paymentOrder.userId || null;

  let userEmail = extractGuestEmail(formData) || String(paymentOrder.customerEmail || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(userEmail) && userId) {
    const account = await User.findById(userId).select('email').lean();
    if (account?.email) userEmail = String(account.email).trim().toLowerCase();
  }
  if (!EMAIL_REGEX.test(userEmail)) {
    return { ok: false, error: 'Valid email required to fulfill trek booking' };
  }

  const userName = extractGuestName(formData) || 'Trek Guest';
  const bookingDraft = paymentOrder.orderTags?.bookingDetails && typeof paymentOrder.orderTags.bookingDetails === 'object'
    ? paymentOrder.orderTags.bookingDetails
    : {};
  const bookingDate = String(bookingDraft.date || '').trim();
  const bookingTime = String(bookingDraft.time || '').trim();

  const genderCheck = await validateTrekGenderRegistration({
    trek,
    userId,
    formData,
    people,
  });
  if (!genderCheck.ok) {
    logger.warn('[trekFulfill] gender validation failed', {
      orderId: payment_order_id,
      message: genderCheck.message,
    });
    return { ok: false, error: genderCheck.message || 'Gender registration not available' };
  }

  const capacity = Math.max(0, Number(trek.maxParticipants) || 0);
  let bookingStatus = 'confirmed';
  let paymentStatus = 'paid';
  let paymentReviewNote = '';

  if (capacity > 0) {
    const seatsHeld = await sumTrekConfirmedSeats(trek._id);
    if (seatsHeld + people > capacity) {
      // Money already captured — hold for organizer rather than losing the guest
      bookingStatus = 'pending';
      paymentStatus = 'paid';
      paymentReviewNote = 'Paid booking exceeded capacity — organizer review';
      logger.warn('[trekFulfill] capacity exceeded after paid fulfillment', {
        orderId: payment_order_id,
        capacity,
        seatsHeld,
        people,
      });
    }
  }

  const gateway = paymentOrder.gateway === 'razorpay' ? 'razorpay' : 'cashfree';
  const bookingFields = {
    userName,
    userEmail,
    participantGender: genderCheck.participantGender || null,
    formData,
    payment_gateway: gateway,
    paymentScreenshotUrl: '',
    transactionId: '',
    paymentStatus,
    paymentReviewNote,
    paymentReviewedAt: null,
    paymentReviewedBy: '',
    bookingDetails: {
      date: bookingDate,
      time: bookingTime,
      people,
      amountPaid,
      paymentId: payment_id || '',
      payment_order_id,
    },
    status: bookingStatus,
  };

  let booking;
  try {
    booking = await TrekBooking.create({
      trekId: trek._id,
      userId: userId || null,
      payment_order_id,
      ...bookingFields,
    });
  } catch (createErr) {
    if (createErr?.code === 11000 && payment_order_id) {
      const raced = await TrekBooking.findOne({ payment_order_id });
      if (raced) {
        return { ok: true, alreadyCompleted: true, booking: raced };
      }
    }
    throw createErr;
  }

  // Post-create capacity race: demote if we oversold
  if (capacity > 0 && bookingStatus === 'confirmed' && booking) {
    const seatsAfter = await sumTrekConfirmedSeats(trek._id);
    if (seatsAfter > capacity) {
      booking.status = 'pending';
      booking.paymentStatus = 'paid';
      booking.paymentReviewNote = 'Paid booking exceeded capacity — organizer review';
      await booking.save();
      bookingStatus = 'pending';
    }
  }

  consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});

  const { groupLink, communityName } = resolveTrekGroupLink(trek);
  const trekName = trek.trekName || 'your trek';
  const accessToken = signTrekBookingAccess({
    bookingId: booking._id,
    trekId: trek._id,
    userEmail,
  });

  if (bookingStatus === 'confirmed') {
    dispatchConfirmation({
      userId,
      userEmail,
      userName,
      trekName,
      bookingId: booking._id,
      bookingDetails: { date: bookingDate, time: bookingTime },
      amountPaid,
      groupLink,
      communityName,
      accessToken,
    });
  }

  logger.info('[trekFulfill] booking created from paid order', {
    orderId: payment_order_id,
    bookingId: booking._id,
    status: bookingStatus,
  });

  return {
    ok: true,
    alreadyCompleted: false,
    booking,
    needsOrganizerReview: bookingStatus === 'pending',
  };
}

module.exports = {
  fulfillTrekFromPaidOrder,
};
