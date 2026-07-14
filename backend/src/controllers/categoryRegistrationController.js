const mongoose = require('mongoose');
const CategoryRegistration = require('../model/category_registration_model');
const SportsEvent = require('../model/sports_model');
const Trek = require('../model/trek_model');
const EventShow = require('../model/event_show_model');
const { verifySportsBookingPayment } = require('../utils/sportsPaymentVerification');
const { consumeCouponUsageForOrder, consumeCouponUsageForRegistration, validateAndPriceCoupon } = require('../utils/couponPricing');
const { buildPriceBreakdown } = require('../utils/platformFee');
const { findByIdOrSlug } = require('../utils/slug');
const {
    expireStalePendingRegistrations,
    isAllowedPaymentScreenshotUrl,
    sumSeatsHeld,
    PENDING_TTL_HOURS,
} = require('../utils/runClubRegistrationGuards');
const {
    encryptRegistrationPii,
    decryptRegistrationPii,
    redactRegistrationPii,
    isPiiEncryptionEnabled,
} = require('../utils/runClubPiiCrypto');
const { notifyRunClubParticipant } = require('../utils/runClubParticipantOutreach');

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
    try {
        const { category, eventId } = req.params;

        if (!MODEL_MAP[category]) {
            return res.status(400).json({ message: 'Invalid category. Use: sports, trek, events' });
        }

        const Model = MODEL_MAP[category];
        const event = await findByIdOrSlug(Model, eventId, {
            pickName: SLUG_NAME_PICKERS[category],
            lean: true,
        });
        if (!event) {
            return res.status(404).json({ message: `${category} event not found` });
        }

        // Always store the real ObjectId on registrations (URL may be a slug)
        const resolvedEventId = event._id;

        if (category === 'sports') {
            await expireStalePendingRegistrations(resolvedEventId);
        }

        if (event.registration?.status === 'closed') {
            return res.status(400).json({ message: 'Registration is currently closed for this event' });
        }

        const userId = req.user?.userId || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const responses = { ...(req.body.responses || req.body.formData || {}) };
        const bookingDetails = req.body.bookingDetails || {};
        const registrationFee = Number(event.registrationFee) || 0;
        const regMode = event.registration?.mode || 'internal_form';
        const isOrganizerQr = category === 'sports' && regMode === 'organizer_qr';
        const maxPeople = Math.max(1, Number(event.registration?.maxPeoplePerBooking) || 10);
        const people = Math.min(maxPeople, Math.max(1, Number(bookingDetails.people) || 1));
        const bookingDate = String(bookingDetails.date || '').trim();
        const bookingTime = String(bookingDetails.time || '').trim();

        // Persist slot into responses so organizer sheets stay consistent
        responses.people = people;
        if (bookingDate) responses.date = bookingDate;
        if (bookingTime) responses.time = bookingTime;

        // Idempotent payment retry: the SAME payment must not create a second
        // registration, but must succeed (not 409) so a resume/double-submit
        // after a redirect payment lands on the success screen instead of the
        // form. Repeat registrations with a new payment are allowed.
        const retryOrderId = bookingDetails.payment_order_id || bookingDetails.paymentOrderId || null;
        if (retryOrderId) {
            const existing = await CategoryRegistration.findOne({
                category,
                eventId: resolvedEventId,
                user: userId,
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

        // One active (pending|confirmed) registration per user per event
        const activeExisting = await CategoryRegistration.findOne({
            category,
            eventId: resolvedEventId,
            user: userId,
            status: { $in: ['pending', 'confirmed'] },
        }).lean();
        if (activeExisting) {
            return res.status(409).json({
                message: activeExisting.status === 'pending'
                    ? 'You already have a registration awaiting payment approval for this event'
                    : 'You are already registered for this event',
                registration: activeExisting,
            });
        }

        // Capacity: pending + confirmed hold seats (people count)
        const capacity = Math.max(0, Number(event.maxParticipants) || 0);
        if (capacity > 0) {
            const seatsHeld = await sumSeatsHeld(resolvedEventId);
            if (seatsHeld + people > capacity) {
                return res.status(400).json({
                    message: seatsHeld >= capacity
                        ? 'This run is full'
                        : `Only ${capacity - seatsHeld} seat(s) left`,
                });
            }
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
        const transactionId = String(bookingDetails.transactionId || '').trim();
        let appliedCouponCode = '';
        let appliedCouponDiscount = 0;
        let appliedAmountBeforeDiscount = 0;

        if (isOrganizerQr) {
            const baseAmount = registrationFee * people;
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
                    return res.status(400).json({ message: 'Payment QR is not configured for this run' });
                }
                if (!paymentScreenshotUrl) {
                    return res.status(400).json({ message: 'Please upload a payment screenshot' });
                }
                if (!isAllowedPaymentScreenshotUrl(paymentScreenshotUrl)) {
                    return res.status(400).json({
                        message: 'Invalid payment screenshot. Please upload the image again in the app.',
                    });
                }
                if (transactionId.trim().length < 4) {
                    return res.status(400).json({
                        message: 'Please enter your UPI / transaction ID (helps the club verify faster)',
                    });
                }
                paymentStatus = 'pending';
                regStatus = 'pending';
                paymentGateway = 'organizer_qr';
            } else {
                amountPaid = 0;
                paymentStatus = 'free';
                regStatus = 'confirmed';
                paymentGateway = appliedCouponCode ? 'organizer_qr' : null;
            }
        } else if (registrationFee > 0) {
            // Cashfree / online — full coupon can skip payment_order entirely
            if (!paymentOrderId) {
                const rawCoupon = bookingDetails.couponCode || req.body.couponCode || '';
                const ticketBase = registrationFee * people;
                const { totalAmount: gross } = buildPriceBreakdown(ticketBase);
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

        const runClubId = category === 'sports' && event.runClubId ? event.runClubId : null;
        let regPayload = {
            category,
            eventId: resolvedEventId,
            user: userId,
            responses,
            paymentStatus,
            amountPaid,
            couponCode: appliedCouponCode,
            couponDiscount: appliedCouponDiscount,
            amountBeforeDiscount: appliedAmountBeforeDiscount || amountPaid,
            payment_order_id: paymentOrderId || null,
            payment_id: paymentId || null,
            payment_gateway: paymentGateway,
            paymentScreenshotUrl,
            transactionId,
            bookingDate,
            bookingTime,
            bookingPeople: people,
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

        const registration = new CategoryRegistration(regPayload);

        await registration.save();

        // Capacity race guard: if parallel submits overbooked, roll this one back
        if (capacity > 0) {
            const seatsHeld = await sumSeatsHeld(resolvedEventId);
            if (seatsHeld > capacity) {
                registration.status = 'cancelled';
                registration.paymentStatus = registrationFee > 0 ? 'failed' : 'free';
                registration.paymentReviewNote = 'Auto-cancelled: run became full';
                await registration.save();
                return res.status(400).json({ message: 'This run is full' });
            }
        }

        if (paymentOrderId) {
            consumeCouponUsageForOrder({ paymentOrderId, userId }).catch(() => {});
        } else if (appliedCouponCode) {
            consumeCouponUsageForRegistration({ registration, userId }).catch(() => {});
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
                                message: `Your spot is held while the organizer checks your payment. Holds for ${PENDING_TTL_HOURS} hours if not reviewed.`,
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

        res.status(201).json({
            message: regStatus === 'pending'
                ? 'Registration submitted — waiting for organizer payment approval'
                : 'Registration successful',
            registration: safeReg,
        });
    } catch (error) {
        console.error('categoryRegistration registerForEvent error:', error);
        if (error.code === 11000) {
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

        const reg = await CategoryRegistration.findByIdAndUpdate(
            registrationId,
            { status },
            { new: true }
        );
        if (!reg) return res.status(404).json({ message: 'Registration not found' });

        res.json({ message: 'Registration status updated', registration: redactRegistrationPii(reg) });
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
