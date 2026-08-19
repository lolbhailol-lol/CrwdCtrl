const mongoose = require('mongoose');
const CategoryRegistration = require('../model/category_registration_model');
const SportsEvent = require('../model/sports_model');
const Trek = require('../model/trek_model');
const EventShow = require('../model/event_show_model');
const { verifySportsBookingPayment } = require('../utils/sportsPaymentVerification');
const {
    consumeCouponUsageForOrder,
    validateAndPriceCoupon,
    reserveCouponUsage,
} = require('../utils/couponPricing');
const { findByIdOrSlug } = require('../utils/slug');
const {
    listingHubForRunClubId,
    hubSourceFromListing,
    sportsActivityNoun,
} = require('../utils/listingHubCopy');
const { resolveSportsTicketTotal } = require('../utils/sportsPricing');
const { validateSportsGenderRegistration } = require('../utils/trekGenderRegistration');
const { mergeSportsFormResponses } = require('../utils/sportsBookingDraft');
const { firstValidCustomerPhone } = require('../services/cashfreeService');
const {
    expireStalePendingRegistrations,
    isAllowedPaymentScreenshotUrl,
    sumSeatsHeld,
    assertSportsCapacityAvailable,
    assertUserPendingQrRateLimit,
    findDuplicateTransactionId,
    normalizeTransactionId,
} = require('../utils/runClubRegistrationGuards');
const {
    encryptRegistrationPii,
    decryptRegistrationPii,
    redactRegistrationPii,
    isPiiEncryptionEnabled,
} = require('../utils/runClubPiiCrypto');
const { notifyRunClubParticipant } = require('../utils/runClubParticipantOutreach');
const User = require('../model/usermodel');
const PaymentOrder = require('../model/payment_order_model');

const MODEL_MAP = {
    sports: SportsEvent,
    trek: Trek,
    events: EventShow,
};

const SLUG_NAME_PICKERS = {
    sports: (row) => row.title || row.name || '',
    trek: (row) => row.trekName || row.title || row.name || '',
    events: (row) => row.displayName || row.title || row.name || '',
};

/* =========================
   USER: REGISTER FOR EVENT
========================= */
exports.registerForEvent = async (req, res) => {
    let category;
    let eventId;
    let resolvedEventId;
    let userId = null;
    let guestEmail = '';
    let event = null;
    try {
        ({ category, eventId } = req.params);

        if (!MODEL_MAP[category]) {
            return res.status(400).json({ message: 'Invalid category. Use: sports, trek, events' });
        }

        const Model = MODEL_MAP[category];
        event = await findByIdOrSlug(Model, eventId, {
            pickName: SLUG_NAME_PICKERS[category],
            lean: true,
        });
        if (!event) {
            return res.status(404).json({ message: `${category} event not found` });
        }

        // Always store the real ObjectId on registrations (URL may be a slug)
        resolvedEventId = event._id;

        if (category === 'sports') {
            await expireStalePendingRegistrations(resolvedEventId);
        }

        if (event.registration?.status === 'closed') {
            return res.status(400).json({ message: 'Registration is currently closed for this event' });
        }

        userId = req.user?.userId || req.user?._id || null;
        // Guest checkout only for sports when registration.requireLogin === false
        const requireLogin = category === 'sports'
            ? event.registration?.requireLogin !== false
            : true;
        let sportsNoun = 'run';
        if (category === 'sports') {
            const listingHub = await listingHubForRunClubId(event.runClubId);
            sportsNoun = sportsActivityNoun(hubSourceFromListing(listingHub));
        }
        if (requireLogin && !userId) {
            return res.status(401).json({
                message: category === 'sports'
                    ? `Please log in to book this ${sportsNoun}.`
                    : 'Please log in to complete this booking.',
                requireLogin: true,
            });
        }

        const responses = { ...(req.body.responses || req.body.formData || {}) };
        const bookingDetails = req.body.bookingDetails || {};
        const incomingPaymentOrderId = String(
            bookingDetails.payment_order_id || bookingDetails.paymentOrderId || req.body.payment_order_id || '',
        ).trim();
        if (category === 'sports' && incomingPaymentOrderId) {
            const storedOrder = await PaymentOrder.findOne({ orderId: incomingPaymentOrderId })
                .select('orderTags customerPhone')
                .lean();
            const storedForm = storedOrder?.orderTags?.formData;
            if (storedForm && typeof storedForm === 'object') {
                Object.assign(responses, mergeSportsFormResponses(responses, storedForm));
            }
            if (!String(responses.gender || responses.sex || '').trim() && storedOrder?.orderTags?.gender) {
                responses.gender = storedOrder.orderTags.gender;
            }
            const phone = firstValidCustomerPhone([
                responses.contact_no,
                responses.phone,
                responses.mobile,
                responses.contact,
                storedOrder?.customerPhone,
                storedForm?.contact_no,
                storedForm?.phone,
            ]);
            if (phone) {
                responses.contact_no = phone;
                responses.phone = phone;
            }
        }

        // Logged-in free/quick book: fill missing contact fields from Google/profile
        // so organizer guest list always shows name / email / phone.
        if (userId && category === 'sports') {
            try {
                const profile = await User.findById(userId).select('name email phoneNumber').lean();
                if (profile) {
                    const name = String(profile.name || '').trim();
                    const email = String(profile.email || '').trim();
                    const phone = String(profile.phoneNumber || '').trim();
                    if (name) {
                        if (!String(responses.full_name || '').trim()) responses.full_name = name;
                        if (!String(responses.name || '').trim()) responses.name = name;
                    }
                    if (email && !String(responses.email || responses.e_mail || responses.e_mail_id || '').trim()) {
                        responses.email = email;
                    }
                    if (phone) {
                        if (!String(responses.contact_no || '').trim()) responses.contact_no = phone;
                        if (!String(responses.phone || '').trim()) responses.phone = phone;
                    }
                }
            } catch (profileErr) {
                console.warn('[registerForEvent.profileFill]', profileErr.message);
            }
        }

        let registrationFee = Number(event.registrationFee) || 0;
        let selectedTier = null;
        let addOnSelected = false;
        let addOnMeta = null;
        if (category === 'sports') {
            try {
                const ticket = resolveSportsTicketTotal(event, {
                    tierId: bookingDetails.tierId || req.body.tierId,
                    people: bookingDetails.people,
                    addOnSelected: bookingDetails.addOnSelected || req.body.addOnSelected,
                });
                registrationFee = ticket.ticketPricePerPerson;
                selectedTier = ticket.tier;
                addOnSelected = ticket.addOnSelected;
                addOnMeta = ticket.addOn;
            } catch (tierErr) {
                return res.status(tierErr.status || 400).json({ message: tierErr.message || 'Invalid tier' });
            }
        }
        const regMode = event.registration?.mode || 'internal_form';
        const isOrganizerQr = category === 'sports' && regMode === 'organizer_qr';
        const maxPeople = Math.max(1, Number(event.registration?.maxPeoplePerBooking) || 10);
        const addOnFeePerPerson = addOnSelected && addOnMeta ? addOnMeta.fee : 0;
        const chargePerPerson = registrationFee + addOnFeePerPerson;
        // Free runs: hard-cap at 1 seat per booking (matches “1 person per login”)
        const people = chargePerPerson <= 0
            ? 1
            : Math.min(maxPeople, Math.max(1, Number(bookingDetails.people) || 1));
        const bookingDate = String(bookingDetails.date || '').trim();
        const bookingTime = String(bookingDetails.time || '').trim();

        // Persist slot into responses so organizer sheets stay consistent
        responses.people = people;
        if (bookingDate) responses.date = bookingDate;
        if (bookingTime) responses.time = bookingTime;
        if (selectedTier) {
            responses.tierId = selectedTier.id;
            responses.tierName = selectedTier.name;
        }
        if (category === 'sports') {
            responses.addOnSelected = addOnSelected;
            if (addOnSelected && addOnMeta) {
                responses.addOnLabel = addOnMeta.label;
                responses.addOnFee = addOnMeta.fee;
            }
            const incomingForm = {
                ...(req.body.formData && typeof req.body.formData === 'object' ? req.body.formData : {}),
                ...(req.body.responses && typeof req.body.responses === 'object' ? req.body.responses : {}),
            };
            for (const field of event.registration?.formSchema || []) {
                const name = String(field?.fieldName || '').trim();
                if (!name) continue;
                const value = incomingForm[name];
                if (value === undefined || value === null || String(value).trim() === '') continue;
                if (!String(responses[name] || '').trim()) responses[name] = value;
            }
        }

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const extractGuestEmail = (data = {}) => String(
            data.email || data.e_mail_id || data.e_mail || data.Email || data['E-mail'] || data['E-mail Id'] || '',
        ).trim().toLowerCase();
        const extractGuestName = (data = {}) => String(
            data.full_name || data.name || data.Name || data['Full Name'] || '',
        ).trim();

        // Always denormalize name/email onto the registration for organizer lists
        // (works for Google free-book even when formSchema is empty).
        let guestName = extractGuestName(responses);
        guestEmail = extractGuestEmail(responses);
        if (!userId) {
            if (!EMAIL_REGEX.test(guestEmail)) {
                return res.status(400).json({
                    message: 'A valid email is required to complete registration. Please fill the email field on the form.',
                });
            }
        } else {
            // Logged-in free book: name+email must land in responses for organizer guest list
            if (chargePerPerson <= 0) {
                if (!extractGuestName(responses) || !EMAIL_REGEX.test(extractGuestEmail(responses))) {
                    return res.status(400).json({
                        message: 'Sign in with Google so we can save your name and email for the organizer guest list.',
                    });
                }
            }
            // Keep PII in encrypted responses + User ref (not plaintext guest fields)
            guestName = '';
            guestEmail = '';
        }

        const ownerFilter = userId
            ? { user: userId }
            : { user: null, guestEmail };

        // Idempotent payment retry: the SAME payment must not create a second
        // registration, but must succeed (not 409) so a resume/double-submit
        // after a redirect payment lands on the success screen instead of the
        // form. Repeat registrations with a new payment are allowed.
        const retryOrderId = bookingDetails.payment_order_id || bookingDetails.paymentOrderId || null;
        if (retryOrderId) {
            const existing = await CategoryRegistration.findOne({
                category,
                eventId: resolvedEventId,
                ...ownerFilter,
                payment_order_id: retryOrderId,
            }).lean();
            if (existing) {
                return res.status(200).json({
                    success: true,
                    alreadyRegistered: true,
                    message: 'Registration already completed',
                    registration: existing,
                });
            }
        }

        // One active (pending|confirmed) registration per user/guest email per event.
        // Confirmed → idempotent 200. Pending QR before review → allow resubmit (update).
        let pendingRegistrationToUpdate = null;
        const activeExisting = await CategoryRegistration.findOne({
            category,
            eventId: resolvedEventId,
            ...ownerFilter,
            status: { $in: ['pending', 'confirmed'] },
        }).lean();
        if (activeExisting) {
            const clubIdForPii = category === 'sports' ? event.runClubId : null;
            if (activeExisting.status === 'confirmed') {
                return res.status(200).json({
                    success: true,
                    alreadyRegistered: true,
                    message: 'You are already registered for this event',
                    registration: decryptRegistrationPii(activeExisting, clubIdForPii),
                });
            }

            const canResubmitPendingQr = isOrganizerQr && !activeExisting.paymentReviewedAt;
            if (canResubmitPendingQr) {
                pendingRegistrationToUpdate = activeExisting;
            } else {
                return res.status(200).json({
                    success: true,
                    alreadyRegistered: true,
                    resumable: true,
                    message: 'You already have a registration awaiting payment approval for this event',
                    registration: decryptRegistrationPii(activeExisting, clubIdForPii),
                });
            }
        }

        const excludeRegId = pendingRegistrationToUpdate?._id || null;

        // Capacity: confirmed seats hard-block; pending QR has its own pool cap
        const capacity = Math.max(0, Number(event.maxParticipants) || 0);
        // resolved after we know if this will be pending QR — preliminary confirmed check
        {
            const pre = await assertSportsCapacityAvailable(resolvedEventId, people, {
                capacity,
                forPendingQr: false,
                excludeId: excludeRegId,
                noun: sportsNoun,
            });
            if (!pre.ok) {
                return res.status(400).json({ message: pre.message });
            }
        }

        let participantGender = '';
        if (category === 'sports') {
            const genderCheck = await validateSportsGenderRegistration({
                event,
                formData: responses,
                people,
                excludeId: excludeRegId,
            });
            if (!genderCheck.ok) {
                return res.status(genderCheck.status || 400).json({ message: genderCheck.message });
            }
            participantGender = genderCheck.participantGender || '';
            if (participantGender) responses.gender = participantGender;
        }

        // Paid runs: re-verify the Cashfree payment server-side before confirming.
        // Organizer QR mode skips Cashfree — screenshot proof is reviewed by organizer.
        let paymentStatus = 'free';
        let amountPaid = 0;
        let paymentOrderId = bookingDetails.payment_order_id || bookingDetails.paymentOrderId || null;
        let paymentId = bookingDetails.paymentId || null;
        let paymentGateway = null;
        let regStatus = 'confirmed';
        const paymentScreenshotUrl = String(bookingDetails.paymentScreenshotUrl || '').trim();
        const transactionId = normalizeTransactionId(bookingDetails.transactionId || '');
        let appliedCouponCode = '';
        let appliedCouponDiscount = 0;
        let appliedAmountBeforeDiscount = 0;
        let couponReservedAt = null;

        if (isOrganizerQr) {
            const baseAmount = chargePerPerson * people;
            appliedAmountBeforeDiscount = baseAmount;

            const rawCoupon = bookingDetails.couponCode || req.body.couponCode || '';
            try {
                const couponResult = await validateAndPriceCoupon({
                    couponCode: rawCoupon,
                    entityType: 'sports',
                    userId,
                    amountBeforeDiscount: baseAmount,
                    people,
                    failOnMissingCode: false,
                });
                appliedCouponCode = couponResult.couponCode || '';
                appliedCouponDiscount = Number(couponResult.discountAmount) || 0;
                appliedAmountBeforeDiscount = Number(couponResult.amountBeforeDiscount) || baseAmount;
                amountPaid = Number(couponResult.amountAfterDiscount);
                if (!Number.isFinite(amountPaid) || amountPaid < 0) amountPaid = baseAmount;
            } catch (couponErr) {
                return res.status(400).json({ message: couponErr.message || 'Invalid coupon' });
            }

            if (amountPaid > 0) {
                if (!String(event.registration?.paymentQR || '').trim()) {
                    return res.status(400).json({ message: `Payment QR is not configured for this ${sportsNoun}` });
                }
                if (!paymentScreenshotUrl) {
                    return res.status(400).json({ message: 'Please upload a payment screenshot' });
                }
                if (!isAllowedPaymentScreenshotUrl(paymentScreenshotUrl)) {
                    return res.status(400).json({
                        message: 'Invalid payment screenshot. Please upload the image again in the app.',
                    });
                }
                if (transactionId.length < 4) {
                    return res.status(400).json({
                        message: `Please enter your UPI / transaction ID (helps the ${sportsNoun === 'event' ? 'community' : 'club'} verify faster)`,
                    });
                }

                const rate = await assertUserPendingQrRateLimit(userId, excludeRegId);
                if (!rate.ok) return res.status(429).json({ message: rate.message });

                const dup = await findDuplicateTransactionId({
                    eventId: resolvedEventId,
                    transactionId,
                    excludeId: excludeRegId,
                });
                if (dup) {
                    return res.status(409).json({
                        message: `This UPI / transaction ID was already used for this ${sportsNoun}. Enter a unique ID from your payment app.`,
                    });
                }

                const qrAutoConfirm = event.registration?.qrAutoConfirm === true;

                const capCheck = await assertSportsCapacityAvailable(resolvedEventId, people, {
                    capacity,
                    forPendingQr: !qrAutoConfirm,
                    excludeId: excludeRegId,
                    noun: sportsNoun,
                });
                if (!capCheck.ok) {
                    return res.status(400).json({ message: capCheck.message });
                }

                if (qrAutoConfirm) {
                    paymentStatus = 'paid';
                    regStatus = 'confirmed';
                } else {
                    paymentStatus = 'pending';
                    regStatus = 'pending';
                }
                paymentGateway = 'organizer_qr';
            } else {
                amountPaid = 0;
                paymentStatus = 'free';
                regStatus = 'confirmed';
                paymentGateway = appliedCouponCode ? 'organizer_qr' : null;
            }

            if (appliedCouponCode && userId) {
                const reserved = await reserveCouponUsage({ couponCode: appliedCouponCode, userId });
                if (!reserved.ok) {
                    return res.status(400).json({ message: reserved.message || 'Coupon could not be applied' });
                }
                couponReservedAt = new Date();
            } else if (appliedCouponCode && !userId) {
                couponReservedAt = new Date();
            }
        } else if (chargePerPerson > 0) {
            // Cashfree / online — full coupon can skip payment_order entirely
            if (!paymentOrderId) {
                const rawCoupon = bookingDetails.couponCode || req.body.couponCode || '';
                const ticketBase = chargePerPerson * people;
                const gross = ticketBase;
                try {
                    const couponResult = await validateAndPriceCoupon({
                        couponCode: rawCoupon,
                        entityType: 'sports',
                        userId,
                        amountBeforeDiscount: gross,
                        people,
                        failOnMissingCode: false,
                    });
                    if (couponResult.couponApplied && Number(couponResult.amountAfterDiscount) === 0) {
                        appliedCouponCode = couponResult.couponCode || '';
                        appliedCouponDiscount = Number(couponResult.discountAmount) || 0;
                        appliedAmountBeforeDiscount = Number(couponResult.amountBeforeDiscount) || gross;
                        if (userId) {
                            const reserved = await reserveCouponUsage({ couponCode: appliedCouponCode, userId });
                            if (!reserved.ok) {
                                return res.status(400).json({ message: reserved.message || 'Coupon could not be applied' });
                            }
                        }
                        couponReservedAt = new Date();
                        amountPaid = 0;
                        paymentStatus = 'free';
                        regStatus = 'confirmed';
                        paymentGateway = null;
                    } else {
                        return res.status(400).json({ message: 'payment_order_id is required for paid runs' });
                    }
                } catch (couponErr) {
                    return res.status(400).json({ message: couponErr.message || 'Invalid coupon' });
                }
            } else {
                const check = await verifySportsBookingPayment({
                    event,
                    people,
                    paymentOrderId,
                    paymentId,
                });
                if (!check.ok) {
                    return res.status(check.status || 400).json({ message: check.message });
                }
                paymentStatus = 'paid';
                amountPaid = check.amountPaid;
                paymentId = check.paymentId;
                paymentGateway = 'cashfree';
                appliedCouponCode = check.couponCode || appliedCouponCode;
                appliedCouponDiscount = check.couponDiscount || appliedCouponDiscount;
                appliedAmountBeforeDiscount = check.amountBeforeDiscount || appliedAmountBeforeDiscount;
            }
        }

        // Reserve / consume coupon usage BEFORE persisting so a limit failure
        // cannot leave a registration with a coupon that was never counted.
        if (paymentOrderId) {
            const consumed = await consumeCouponUsageForOrder({ paymentOrderId, userId });
            if (!consumed.ok) {
                return res.status(400).json({
                    message: consumed.message || 'Coupon could not be applied',
                });
            }
            if (appliedCouponCode && !couponReservedAt) {
                couponReservedAt = new Date();
            }
        } else if (appliedCouponCode && !couponReservedAt) {
            if (userId) {
                const reserved = await reserveCouponUsage({
                    couponCode: appliedCouponCode,
                    userId,
                });
                if (!reserved.ok) {
                    return res.status(400).json({
                        message: reserved.message || 'Coupon could not be applied',
                    });
                }
            }
            couponReservedAt = new Date();
        }

        const runClubId = category === 'sports' && event.runClubId ? event.runClubId : null;
        let regPayload = {
            category,
            eventId: resolvedEventId,
            user: userId || null,
            guestEmail: userId ? '' : (guestEmail || ''),
            guestName: userId ? '' : (guestName || ''),
            responses,
            paymentStatus,
            amountPaid,
            couponCode: appliedCouponCode,
            couponDiscount: appliedCouponDiscount,
            amountBeforeDiscount: appliedAmountBeforeDiscount || amountPaid,
            couponConsumedAt: couponReservedAt || null,
            payment_order_id: paymentOrderId || null,
            payment_id: paymentId || null,
            payment_gateway: paymentGateway,
            paymentScreenshotUrl,
            transactionId,
            bookingDate,
            bookingTime,
            bookingPeople: people,
            participantGender,
            tierId: selectedTier?.id || '',
            tierName: selectedTier?.name || '',
            tierFee: selectedTier ? registrationFee : (category === 'sports' ? registrationFee : 0),
            addOnSelected: Boolean(addOnSelected),
            addOnLabel: addOnSelected && addOnMeta ? addOnMeta.label : '',
            addOnFee: addOnSelected && addOnMeta ? addOnMeta.fee : 0,
            status: regStatus,
            runClubId: runClubId || null,
        };

        // Encrypt participant PII for run-club sports — organizer portal decrypts; admin sees redacted
        if (runClubId && isPiiEncryptionEnabled()) {
            try {
                const encrypted = encryptRegistrationPii({
                    responses,
                    paymentScreenshotUrl,
                    transactionId,
                    runClubId,
                });
                regPayload = { ...regPayload, ...encrypted };
            } catch (encErr) {
                console.error('[registerForEvent.piiEncrypt]', encErr.message);
                return res.status(500).json({ message: 'Failed to secure registration data' });
            }
        }

        const isResubmit = Boolean(pendingRegistrationToUpdate);
        let registration;
        if (pendingRegistrationToUpdate) {
            registration = await CategoryRegistration.findByIdAndUpdate(
                pendingRegistrationToUpdate._id,
                { $set: regPayload },
                { new: true, runValidators: true },
            );
        } else {
            registration = new CategoryRegistration(regPayload);
            await registration.save();
        }

        const savedPhone = firstValidCustomerPhone([
            responses.contact_no,
            responses.phone,
            responses.mobile,
        ]);
        if (userId && savedPhone) {
            await User.updateOne(
                {
                    _id: userId,
                    $or: [
                        { phoneNumber: { $exists: false } },
                        { phoneNumber: null },
                        { phoneNumber: '' },
                    ],
                },
                { $set: { phoneNumber: savedPhone } },
            ).catch(() => {});
        }

        // Capacity race guard for confirmed seats only (pending soft-held separately)
        if (capacity > 0 && regStatus === 'confirmed') {
            const confirmedHeld = await sumSeatsHeld(resolvedEventId, { statuses: ['confirmed'] });
            if (confirmedHeld > capacity) {
                registration.status = 'cancelled';
                registration.paymentStatus = chargePerPerson > 0 ? 'failed' : 'free';
                registration.paymentReviewNote = 'Auto-cancelled: run became full';
                await registration.save();
                return res.status(400).json({ message: 'This run is full' });
            }
        }

        const safeReg = decryptRegistrationPii(
            registration.toObject ? registration.toObject() : registration,
            runClubId,
        );

        // Notify runner: pending QR review vs confirmed booking
        if (category === 'sports') {
            const eventTitle = event.title || event.name || 'your run';
            const detailsLink = `/registration-details/${registration._id}?type=sports`;
            CategoryRegistration.findById(registration._id)
                .populate('user', 'name email phoneNumber notificationPreferences')
                .then((populated) => {
                    const lean = decryptRegistrationPii(
                        populated?.toObject ? populated.toObject() : populated || safeReg,
                        runClubId,
                    );
                    if (regStatus === 'pending') {
                        return notifyRunClubParticipant({
                            registration: lean,
                            eventId: resolvedEventId,
                            eventTitle,
                            title: 'Payment submitted — awaiting approval',
                            message: `Thanks! Your payment screenshot for ${eventTitle} was submitted. The run club organizer will review it and confirm your spot. You’ll get another email once it’s approved.`,
                            type: 'registration',
                            link: detailsLink,
                            emailSubject: `Payment submitted — waiting for club approval · ${eventTitle}`,
                            metadata: { registrationId: String(registration._id), stage: 'pending_review' },
                            paymentContext: {
                                status: 'pending',
                                message: 'Your spot is held while the organizer checks your payment. You’ll get another update once it’s approved — no time limit.',
                            },
                        });
                    }
                    return notifyRunClubParticipant({
                        registration: lean,
                        eventId: resolvedEventId,
                        eventTitle,
                        title: 'Booking confirmed!',
                        message: `You’re in for ${eventTitle}. Download your ticket and join the club WhatsApp for updates.`,
                        type: 'registration',
                        link: detailsLink,
                        emailSubject: `Booking confirmed — ${eventTitle}`,
                        metadata: { registrationId: String(registration._id), stage: 'confirmed' },
                        includeGroupLink: true,
                        paymentContext: {
                            status: paymentStatus === 'paid' ? 'paid' : 'free',
                            method: paymentGateway || '',
                        },
                    });
                })
                .catch((err) => console.error('[registerForEvent.notify]', err.message));
        }

        res.status(isResubmit ? 200 : 201).json({
            success: true,
            alreadyRegistered: isResubmit,
            message: regStatus === 'pending'
                ? (isResubmit
                    ? 'Payment details updated — still waiting for organizer approval'
                    : 'Registration submitted — waiting for organizer payment approval')
                : (isResubmit ? 'You are already registered for this event' : 'Registration successful'),
            registration: safeReg,
        });
    } catch (error) {
        console.error('categoryRegistration registerForEvent error:', error);
        if (error.code === 11000) {
            try {
                const dupFilter = userId
                    ? { user: userId }
                    : { user: null, guestEmail: guestEmail || undefined };
                const dup = await CategoryRegistration.findOne({
                    category,
                    eventId: resolvedEventId,
                    ...dupFilter,
                    status: { $in: ['pending', 'confirmed'] },
                }).lean();
                if (dup) {
                    const clubIdForPii = category === 'sports' ? event?.runClubId : null;
                    return res.status(200).json({
                        success: true,
                        alreadyRegistered: true,
                        message: dup.status === 'pending'
                            ? 'You already have a registration awaiting payment approval for this event'
                            : 'You are already registered for this event',
                        registration: decryptRegistrationPii(dup, clubIdForPii),
                    });
                }
            } catch (_) { /* fall through */ }
            return res.status(409).json({ message: 'You are already registered for this event' });
        }
        res.status(500).json({ message: 'Registration failed' });
    }
};

/* =========================
   USER: GET MY REGISTRATIONS
========================= */
exports.getMyRegistrations = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?._id;
        const filter = { user: userId };
        if (req.query.category) filter.category = req.query.category;

        const registrations = await CategoryRegistration.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        if (registrations.length > 0) {
            const sportsIds = [
                ...new Set(
                    registrations
                        .filter((r) => r.category === 'sports')
                        .map((r) => String(r.eventId)),
                ),
            ];
            if (sportsIds.length > 0) {
                const events = await SportsEvent.find({ _id: { $in: sportsIds } })
                    .select('title eventDate venue city sportType images status coverImage registrationFee runClubId')
                    .lean();
                const eventMap = Object.fromEntries(events.map((e) => [String(e._id), e]));
                const clubIds = [...new Set(events.map((e) => e.runClubId).filter(Boolean).map(String))];
                let clubMap = {};
                if (clubIds.length > 0) {
                    const RunClub = require('../model/run_club_model');
                    const clubs = await RunClub.find({ _id: { $in: clubIds } }).select('name').lean();
                    clubMap = Object.fromEntries(clubs.map((c) => [String(c._id), c]));
                }
                registrations.forEach((reg) => {
                    if (reg.category === 'sports') {
                        const event = eventMap[String(reg.eventId)] || null;
                        reg.event = event;
                        const clubId = event?.runClubId || reg.runClubId;
                        reg.clubName = clubId ? (clubMap[String(clubId)]?.name || '') : '';
                    }
                });
            }
        }

        // Owner can see their own decrypted form/payment fields
        const decrypted = registrations.map((reg) => decryptRegistrationPii(reg, reg.runClubId));
        res.json({ registrations: decrypted });
    } catch (error) {
        console.error('categoryRegistration getMyRegistrations error:', error);
        res.status(500).json({ message: 'Failed to fetch registrations' });
    }
};

/* =========================
   USER: GET ONE REGISTRATION (sports / trek / events category)
========================= */
exports.getRegistrationDetails = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?._id;
        const { registrationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ message: 'Invalid registration ID' });
        }

        const registration = await CategoryRegistration.findOne({
            _id: registrationId,
            user: userId,
        }).lean();

        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        if (registration.category === 'sports') {
            const event = await SportsEvent.findById(registration.eventId)
                .select('title eventDate venue city sportType images coverImage status registrationFee reportingTime registration.formSchema registration.formInstructions runClubId')
                .lean();
            registration.event = event || null;
            const clubId = event?.runClubId || registration.runClubId;
            if (clubId) {
                const RunClub = require('../model/run_club_model');
                const club = await RunClub.findById(clubId).select('name groupLink contactPhone').lean();
                if (club) {
                    registration.groupLink = String(club.groupLink || '').trim();
                    registration.clubName = club.name || '';
                    if (!registration.groupLink) {
                        const digits = String(club.contactPhone || '').replace(/\D/g, '');
                        if (digits.length >= 10) {
                            const phone = digits.length === 10 ? `91${digits}` : digits;
                            registration.groupLink = `https://wa.me/${phone}`;
                        }
                    }
                }
            }
        } else if (registration.category === 'trek') {
            const event = await Trek.findById(registration.eventId)
                .select('trekName city coverImage images trekDate')
                .lean();
            registration.event = event || null;
        } else if (registration.category === 'events') {
            const event = await EventShow.findById(registration.eventId)
                .select('title displayName venue city coverImage banner showTimings')
                .lean();
            registration.event = event || null;
        }

        res.json(decryptRegistrationPii(registration, registration.runClubId));
    } catch (error) {
        console.error('categoryRegistration getRegistrationDetails error:', error);
        res.status(500).json({ message: 'Failed to fetch registration details' });
    }
};

/* =========================
   ADMIN: GET ALL REGISTRATIONS (with category filter)
========================= */
exports.adminGetAllRegistrations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.eventId) {
            const resolved = await findByIdOrSlug(SportsEvent, req.query.eventId, {
                pickName: (row) => row.title || '',
                lean: true,
                select: '_id title',
            });
            // Sports slug → ObjectId; otherwise keep as-is for trek/events ObjectIds
            filter.eventId = resolved?._id || req.query.eventId;
        }
        if (req.query.status) filter.status = req.query.status;

        const total = await CategoryRegistration.countDocuments(filter);
        const registrations = await CategoryRegistration.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const sportsEventIds = [
            ...new Set(
                registrations
                    .filter((r) => r.category === 'sports')
                    .map((r) => String(r.eventId)),
            ),
        ];
        let runClubEventIds = new Set();
        if (sportsEventIds.length > 0) {
            const events = await SportsEvent.find({ _id: { $in: sportsEventIds } })
                .select('sportType runClubId')
                .lean();
            runClubEventIds = new Set(
                events
                    .filter((e) => e.sportType === 'run_club' || e.runClubId)
                    .map((e) => String(e._id)),
            );
        }

        // Run-club participant form/payment PII is organizer-only — redact for admin
        const safe = registrations.map((reg) => {
            const isRunClubSports =
                reg.category === 'sports'
                && (reg.piiEncrypted || reg.runClubId || runClubEventIds.has(String(reg.eventId)));
            if (isRunClubSports) return redactRegistrationPii(reg);
            return reg;
        });

        res.status(200).json({
            registrations: safe,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error('categoryRegistration adminGetAllRegistrations error:', error);
        res.status(500).json({ message: 'Failed to fetch registrations' });
    }
};

/* =========================
   ADMIN: UPDATE REGISTRATION STATUS
========================= */
exports.adminUpdateStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ message: 'Invalid registration ID' });
        }
        if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'status must be: pending, confirmed, or cancelled' });
        }

        const existing = await CategoryRegistration.findById(registrationId);
        if (!existing) return res.status(404).json({ message: 'Registration not found' });

        if (status === 'confirmed' && existing.status !== 'confirmed') {
            if (existing.paymentStatus === 'pending') {
                return res.status(400).json({
                    message: 'Cannot confirm while payment is still pending. Approve the screenshot from the organizer dashboard or mark payment paid first.',
                });
            }
            if (existing.category === 'sports') {
                const event = await SportsEvent.findById(existing.eventId).select('maxParticipants runClubId').lean();
                const capacity = Math.max(0, Number(event?.maxParticipants) || 0);
                if (capacity > 0) {
                    const people = Math.max(1, Number(existing.bookingPeople) || 1);
                    const listingHub = await listingHubForRunClubId(event?.runClubId);
                    const check = await assertSportsCapacityAvailable(existing.eventId, people, {
                        excludeId: existing._id,
                        capacity,
                        forPendingQr: false,
                        noun: sportsActivityNoun(hubSourceFromListing(listingHub)),
                    });
                    if (!check.ok) {
                        return res.status(400).json({ message: check.message });
                    }
                }
            }
        }

        existing.status = status;
        if (status === 'cancelled' && existing.paymentStatus === 'pending') {
            existing.paymentStatus = 'failed';
        }
        await existing.save();

        res.json({ message: 'Registration status updated', registration: redactRegistrationPii(existing) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update registration status', error: error.message });
    }
};

/* =========================
   ADMIN: CATEGORY SUMMARY (for analytics)
========================= */
exports.getCategorySummary = async (req, res) => {
    try {
        const summary = await CategoryRegistration.aggregate([
            {
                $group: {
                    _id: '$category',
                    total: { $sum: 1 },
                    confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    revenue: { $sum: '$amountPaid' },
                },
            },
        ]);

        res.json({ summary });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch category summary', error: error.message });
    }
};
