const CategoryRegistration = require('../model/category_registration_model');
const PaymentOrder = require('../model/payment_order_model');
const SportsEvent = require('../model/sports_model');
const User = require('../model/usermodel');
const { findByIdOrSlug } = require('../utils/slug');
const { resolveSportsTicketTotal } = require('../utils/sportsPricing');
const { validateSportsGenderRegistration } = require('../utils/trekGenderRegistration');
const { mergeSportsFormResponses } = require('../utils/sportsBookingDraft');
const { firstValidCustomerPhone } = require('../services/cashfreeService');
const {
  expireStalePendingRegistrations,
  assertSportsCapacityAvailable,
  sumSeatsHeld,
} = require('../utils/runClubRegistrationGuards');
const {
  encryptRegistrationPii,
  decryptRegistrationPii,
  isPiiEncryptionEnabled,
} = require('../utils/runClubPiiCrypto');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { queueRunClubRegistrationConfirmation } = require('../utils/runClubParticipantOutreach');
const { logger } = require('../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractGuestEmail(data = {}) {
  return String(
    data.email || data.e_mail_id || data.e_mail || data.Email || data['E-mail'] || data['E-mail Id'] || '',
  ).trim().toLowerCase();
}

function extractGuestName(data = {}) {
  return String(
    data.full_name || data.name || data.Name || data['Full Name'] || '',
  ).trim();
}

async function saveCategoryRegistrationIdempotent(registration, paymentOrderId) {
  if (paymentOrderId) {
    const byOrder = await CategoryRegistration.findOne({ payment_order_id: paymentOrderId });
    if (byOrder) return { registration: byOrder, created: false };
  }
  try {
    await registration.save();
    return { registration, created: true };
  } catch (err) {
    if (err?.code !== 11000 || !paymentOrderId) throw err;
    const existing = await CategoryRegistration.findOne({ payment_order_id: paymentOrderId });
    if (existing) return { registration: existing, created: false };
    throw err;
  }
}

/**
 * After Cashfree marks a sports order PAID, create CategoryRegistration from
 * formData stored on PaymentOrder at checkout. Idempotent by payment_order_id.
 */
async function fulfillSportsFromPaidOrder(paymentOrderInput, overrides = {}) {
  const orderId = paymentOrderInput?.orderId || paymentOrderInput;
  if (!orderId) return { ok: false, error: 'Missing order id' };

  const paymentOrder = typeof paymentOrderInput === 'object' && paymentOrderInput.orderId
    ? paymentOrderInput
    : await PaymentOrder.findOne({ orderId: String(orderId) });

  if (!paymentOrder) return { ok: false, error: 'Payment order not found' };
  if (paymentOrder.entityType !== 'sports') {
    return { ok: false, skipped: true, error: 'Not a sports order' };
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

  const existingByOrder = await CategoryRegistration.findOne({ payment_order_id });
  if (existingByOrder) {
    return {
      ok: true,
      alreadyCompleted: true,
      registration: existingByOrder,
    };
  }

  const formData = paymentOrder.orderTags?.formData;
  if (!formData || typeof formData !== 'object' || !Object.keys(formData).length) {
    return { ok: false, error: 'No form data available for this payment' };
  }

  const eventId = paymentOrder.entityId || paymentOrder.orderTags?.eventId;
  if (!eventId) return { ok: false, error: 'Missing event id on payment order' };

  const event = await findByIdOrSlug(SportsEvent, eventId, {
    pickName: (row) => row.title || row.name || '',
    lean: false,
  });
  if (!event) return { ok: false, error: 'Event not found' };

  if (event.registration?.mode === 'organizer_qr') {
    return { ok: false, skipped: true, error: 'Organizer QR events skip Cashfree fulfillment' };
  }

  const userId = overrides.userId || paymentOrder.userId || null;
  let responses = mergeSportsFormResponses(formData, {});

  const phone = firstValidCustomerPhone([
    paymentOrder.customerPhone,
    responses.contact_no,
    responses.phone,
  ]);
  if (phone) {
    responses.contact_no = phone;
    responses.phone = phone;
  }

  if (userId) {
    try {
      const profile = await User.findById(userId).select('name email phoneNumber').lean();
      if (profile) {
        const name = String(profile.name || '').trim();
        const email = String(profile.email || '').trim();
        const profilePhone = String(profile.phoneNumber || '').trim();
        if (name) {
          if (!String(responses.full_name || '').trim()) responses.full_name = name;
          if (!String(responses.name || '').trim()) responses.name = name;
        }
        if (email && !String(responses.email || '').trim()) responses.email = email;
        if (profilePhone) {
          if (!String(responses.contact_no || '').trim()) responses.contact_no = profilePhone;
          if (!String(responses.phone || '').trim()) responses.phone = profilePhone;
        }
      }
    } catch (profileErr) {
      logger.warn('[sportsFulfill.profileFill]', profileErr.message);
    }
  }

  const tierId = String(
    overrides.tierId
    || paymentOrder.orderTags?.tierId
    || responses.tierId
    || '',
  ).trim();
  let addOnSelected = overrides.addOnSelected;
  if (addOnSelected === undefined) {
    addOnSelected = paymentOrder.orderTags?.addOnSelected === '1'
      || Boolean(responses.addOnSelected);
  }

  let registrationFee = Number(event.registrationFee) || 0;
  let selectedTier = null;
  let addOnMeta = null;
  try {
    const ticket = resolveSportsTicketTotal(event, { tierId, people: paymentOrder.people, addOnSelected });
    registrationFee = ticket.ticketPricePerPerson;
    selectedTier = ticket.tier;
    addOnSelected = ticket.addOnSelected;
    addOnMeta = ticket.addOn;
  } catch (tierErr) {
    return { ok: false, error: tierErr.message || 'Invalid tier' };
  }

  const maxPeople = Math.max(1, Number(event.registration?.maxPeoplePerBooking) || 10);
  const addOnFeePerPerson = addOnSelected && addOnMeta ? addOnMeta.fee : 0;
  const chargePerPerson = registrationFee + addOnFeePerPerson;
  const people = Math.min(
    maxPeople,
    Math.max(1, Number(paymentOrder.people) || Number(responses.people) || 1),
  );

  responses.people = people;
  if (selectedTier) {
    responses.tierId = selectedTier.id;
    responses.tierName = selectedTier.name;
  }
  responses.addOnSelected = addOnSelected;
  if (addOnSelected && addOnMeta) {
    responses.addOnLabel = addOnMeta.label;
    responses.addOnFee = addOnMeta.fee;
  }

  let guestName = extractGuestName(responses);
  let guestEmail = extractGuestEmail(responses) || String(paymentOrder.customerEmail || '').trim().toLowerCase();
  if (!userId) {
    if (!EMAIL_REGEX.test(guestEmail)) {
      return { ok: false, error: 'Guest email missing on paid order' };
    }
  } else {
    guestName = '';
    guestEmail = '';
  }

  await expireStalePendingRegistrations(event._id);

  const genderCheck = await validateSportsGenderRegistration({
    event,
    formData: responses,
    people,
  });
  if (!genderCheck.ok) {
    return { ok: false, error: genderCheck.message || 'Gender quota validation failed' };
  }
  const participantGender = genderCheck.participantGender || '';
  if (participantGender) responses.gender = participantGender;

  const capacity = Math.max(0, Number(event.maxParticipants) || 0);
  if (capacity > 0) {
    const capCheck = await assertSportsCapacityAvailable(event._id, people, {
      capacity,
      forPendingQr: false,
      noun: 'event',
    });
    if (!capCheck.ok) {
      return { ok: false, error: capCheck.message || 'Event is full' };
    }
  }

  const amountPaid = Number(paymentOrder.totalAmount) || 0;
  const runClubId = event.runClubId || null;

  let regPayload = {
    category: 'sports',
    eventId: event._id,
    user: userId || null,
    guestEmail: userId ? '' : guestEmail,
    guestName: userId ? '' : guestName,
    responses,
    paymentStatus: 'paid',
    amountPaid,
    couponCode: String(paymentOrder.couponCode || '').trim().toUpperCase(),
    couponDiscount: Number(paymentOrder.couponDiscount) || 0,
    amountBeforeDiscount: Number(paymentOrder.amountBeforeDiscount) || amountPaid,
    couponConsumedAt: paymentOrder.couponCode ? new Date() : null,
    payment_order_id,
    payment_id,
    payment_gateway: 'cashfree',
    paymentScreenshotUrl: '',
    transactionId: '',
    bookingDate: String(responses.date || '').trim(),
    bookingTime: String(responses.time || '').trim(),
    bookingPeople: people,
    participantGender,
    tierId: selectedTier?.id || '',
    tierName: selectedTier?.name || '',
    tierFee: selectedTier ? registrationFee : registrationFee,
    addOnSelected: Boolean(addOnSelected),
    addOnLabel: addOnSelected && addOnMeta ? addOnMeta.label : '',
    addOnFee: addOnSelected && addOnMeta ? addOnMeta.fee : 0,
    status: 'confirmed',
    runClubId: runClubId || null,
  };

  if (runClubId && isPiiEncryptionEnabled()) {
    try {
      const encrypted = encryptRegistrationPii({
        responses,
        paymentScreenshotUrl: '',
        transactionId: '',
        runClubId,
      });
      regPayload = { ...regPayload, ...encrypted };
    } catch (encErr) {
      logger.error('[sportsFulfill.piiEncrypt]', encErr.message);
      return { ok: false, error: 'Failed to secure registration data' };
    }
  }

  const ownerFilter = userId
    ? { user: userId }
    : { user: null, guestEmail };

  const activeExisting = await CategoryRegistration.findOne({
    category: 'sports',
    eventId: event._id,
    ...ownerFilter,
    status: { $in: ['pending', 'confirmed'] },
  });

  if (activeExisting && activeExisting.payment_order_id === payment_order_id) {
    return {
      ok: true,
      alreadyCompleted: true,
      registration: activeExisting,
    };
  }

  if (activeExisting && activeExisting.payment_order_id !== payment_order_id) {
    const upgraded = await CategoryRegistration.findByIdAndUpdate(
      activeExisting._id,
      { $set: regPayload },
      { new: true, runValidators: true },
    );

    consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});

    const eventTitle = event.title || event.name || 'your event';
    CategoryRegistration.findById(upgraded._id)
      .populate('user', 'name email phoneNumber notificationPreferences')
      .then((populated) => queueRunClubRegistrationConfirmation({
        registration: decryptRegistrationPii(
          populated?.toObject ? populated.toObject() : populated || upgraded,
          runClubId,
        ),
        eventId: event._id,
        eventTitle,
        runClubId,
        paymentStatus: 'paid',
        paymentGateway: 'cashfree',
        stage: 'confirmed',
      }))
      .catch((err) => logger.error('[sportsFulfill.notify.upgrade]', err.message));

    logger.debug(
      '✅ Sports registration upgraded from payment:',
      payment_order_id,
      upgraded._id,
    );

    return {
      ok: true,
      alreadyCompleted: false,
      upgraded: true,
      registration: upgraded,
      event,
      amountPaid,
    };
  }

  const registration = new CategoryRegistration(regPayload);
  const saved = await saveCategoryRegistrationIdempotent(registration, payment_order_id);

  if (capacity > 0 && saved.created) {
    const confirmedHeld = await sumSeatsHeld(event._id, { statuses: ['confirmed'] });
    if (confirmedHeld > capacity) {
      saved.registration.status = 'cancelled';
      saved.registration.paymentStatus = 'failed';
      saved.registration.paymentReviewNote = 'Auto-cancelled: event became full';
      await saved.registration.save();
      return { ok: false, error: 'Event became full during fulfillment' };
    }
  }

  consumeCouponUsageForOrder({ paymentOrderId: payment_order_id, userId }).catch(() => {});

  if (saved.created) {
    const eventTitle = event.title || event.name || 'your event';
    CategoryRegistration.findById(saved.registration._id)
      .populate('user', 'name email phoneNumber notificationPreferences')
      .then((populated) => queueRunClubRegistrationConfirmation({
        registration: decryptRegistrationPii(
          populated?.toObject ? populated.toObject() : populated || saved.registration,
          runClubId,
        ),
        eventId: event._id,
        eventTitle,
        runClubId,
        paymentStatus: 'paid',
        paymentGateway: 'cashfree',
        stage: 'confirmed',
      }))
      .catch((err) => logger.error('[sportsFulfill.notify]', err.message));
  }

  logger.debug(
    '✅ Sports registration fulfilled from payment:',
    payment_order_id,
    saved.registration._id,
    saved.created ? 'created' : 'existing',
  );

  return {
    ok: true,
    alreadyCompleted: !saved.created,
    registration: saved.registration,
    event,
    amountPaid,
  };
}

module.exports = {
  fulfillSportsFromPaidOrder,
};
