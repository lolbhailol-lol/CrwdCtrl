const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const { appendToGoogleSheets } = require('../services/googleSheetsService');
const { verifyTrekBookingPayment } = require('../utils/trekPaymentVerification');
const { consumeCouponUsageForOrder } = require('../utils/couponPricing');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('../services/pushService');
const { sendTrekRegistrationEmails } = require('../services/emailService');
const { optionalAuthenticateToken } = require('../middleware/authmiddleware');
const { getJwtSecret } = require('../config/jwtSecret');
const {
    getGenderRegistrationSnapshot,
    validateTrekGenderRegistration,
} = require('../utils/trekGenderRegistration');
const { resolveTrekGroupLink } = require('../utils/resolveTrekGroupLink');
const { findByIdOrSlug, ensureUniqueSlug } = require('../utils/slug');
const { isAllowedPaymentScreenshotUrl, normalizeTransactionId } = require('../utils/runClubRegistrationGuards');
const { notifyTrekParticipant } = require('../utils/trekParticipantOutreach');
const { signTrekBookingAccess } = require('../utils/bookingAccess');
const { registrationLimiter } = require('../middleware/rateLimiter');
const uploadCtrl = require('../controllers/uploadController');
const { sanitizePublicTrek } = require('../utils/publicEntitySanitize');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getOptionalUserId(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return null;
        const token = authHeader.substring(7);
        if (!token) return null;
        const decoded = jwt.verify(token, getJwtSecret());
        return decoded.userId || null;
    } catch {
        return null;
    }
}

function extractEmail(formData = {}) {
    const direct = (
        formData.email ||
        formData.e_mail_id ||
        formData.e_mail ||
        formData['Email'] ||
        formData['E-mail'] ||
        ''
    )
        .toString()
        .trim()
        .toLowerCase();
    if (EMAIL_REGEX.test(direct)) return direct;

    // Custom admin field names (e.g. participant_email) — scan values
    for (const value of Object.values(formData || {})) {
        if (typeof value !== 'string') continue;
        const v = value.trim().toLowerCase();
        if (EMAIL_REGEX.test(v)) return v;
    }
    return '';
}

/** Fire-and-forget trek confirmation email + in-app/push after booking is saved. */
function dispatchTrekBookingConfirmation({
    userId,
    userEmail,
    userName,
    trekName,
    bookingId,
    bookingDetails = {},
    amountPaid = 0,
    groupLink = '',
    communityName = '',
    sendEmailOnly = false,
    accessToken = '',
}) {
    const accessQuery = accessToken ? `&access=${encodeURIComponent(accessToken)}` : '';
    const link = `/registration-details/${bookingId}?type=trek${accessQuery}`;
    const ticketLink = `/qr-ticket/${bookingId}?type=trek${accessQuery}`;
    void (async () => {
        try {
            const emailResult = await sendTrekRegistrationEmails({
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
            if (!emailResult?.success) {
                console.error('[Trek Register] Confirmation email failed:', emailResult?.error || emailResult);
            }

            if (sendEmailOnly || !userId) return;

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
            console.error('[Trek Register] Confirmation dispatch error:', err.message);
        }
    })();
}

// GET /api/treks — list published treks, supports ?difficulty=&city=&communityId=&category=&timeframe=upcoming|past
router.get('/', async (req, res) => {
    try {
        const timeframe = String(req.query.timeframe || '').toLowerCase();
        const hasCommunity = Boolean(req.query.communityId);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const and = [];

        if (hasCommunity && timeframe === 'past') {
            and.push({
                $or: [
                    { status: 'completed' },
                    { status: 'published', trekDate: { $lt: startOfToday } },
                ],
            });
        } else if (hasCommunity && timeframe === 'upcoming') {
            and.push({ status: 'published' });
            and.push({
                $or: [
                    { trekDate: null },
                    { trekDate: { $exists: false } },
                    { trekDate: { $gte: startOfToday } },
                ],
            });
        } else {
            and.push({ status: 'published' });
        }

        if (req.query.difficulty) and.push({ difficultyLevel: req.query.difficulty });
        if (req.query.city) and.push({ city: { $regex: req.query.city, $options: 'i' } });
        if (req.query.communityId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.communityId)) {
                return res.status(400).json({ message: 'Invalid community ID' });
            }
            and.push({ communityId: req.query.communityId });
        }
        if (req.query.category || req.query.trekCategory) {
            and.push({ trekCategory: req.query.category || req.query.trekCategory });
        }

        const filter = and.length === 1 ? and[0] : { $and: and };
        const sort = timeframe === 'past'
            ? { trekDate: -1, createdAt: -1 }
            : { communityPriority: 1, trekDate: 1, createdAt: -1 };

        const treks = await Trek.find(filter)
            .sort(sort)
            .limit(50)
            .lean();

        res.status(200).json({ treks: treks.map((t) => sanitizePublicTrek(t)) });
    } catch (error) {
        console.error('publicTrek getAllTreks error:', error);
        res.status(500).json({ message: 'Failed to fetch treks' });
    }
});

// GET /api/treks/:id — single trek detail
router.get('/:idOrSlug', async (req, res) => {
    try {
        const trekMatch = await findByIdOrSlug(Trek, req.params.idOrSlug, {
            baseFilter: { status: { $in: ['published', 'completed'] } },
            pickName: (row) => row.trekName,
            lean: true,
        });
        if (!trekMatch) return res.status(404).json({ message: 'Trek not found' });
        const trek = await Trek.findOne({ _id: trekMatch._id, status: { $in: ['published', 'completed'] } })
            .populate('communityId', 'name basedIn contactPhone contactInstagram paymentGateway')
            .lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });

        // Backfill slug for legacy rows so shared /trek/:slug links stay stable
        if (!trek.slug && trek.trekName) {
            try {
                const slug = await ensureUniqueSlug(Trek, trek.trekName, {
                    excludeId: trek._id,
                });
                if (slug) {
                    trek.slug = slug;
                    await Trek.updateOne({ _id: trek._id }, { $set: { slug } });
                }
            } catch (err) {
                console.warn('publicTrek slug backfill failed:', err?.message || err);
            }
        }

        const genderRegistration = await getGenderRegistrationSnapshot(trek);

        let userBooking = null;
        const userId = getOptionalUserId(req);
        if (userId) {
            // Only surface a pending QR review — confirmed bookings must not block new tickets
            const existing = await TrekBooking.findOne({
                trekId: trek._id,
                userId,
                status: 'pending',
            }).select('_id status').sort({ createdAt: -1 }).lean();
            if (existing) {
                userBooking = { bookingId: existing._id, status: existing.status };
            }
        }

        res.json({ trek: sanitizePublicTrek(trek), genderRegistration, userBooking });
    } catch (error) {
        console.error('publicTrek getTrekById error:', error);
        res.status(500).json({ message: 'Failed to fetch trek' });
    }
});

// POST /api/treks/:id/payment-screenshot — guest QR proof upload (when requireLogin=false or logged in)
router.post(
    '/:id/payment-screenshot',
    registrationLimiter,
    uploadCtrl.uploadSingle,
    uploadCtrl.multerErrorHandler,
    async (req, res) => {
        try {
            const trekMatch = await findByIdOrSlug(Trek, req.params.id, {
                baseFilter: { status: 'published' },
                pickName: (row) => row.trekName || row.title || '',
                lean: true,
            });
            if (!trekMatch) return res.status(404).json({ message: 'Trek not found' });

            const trek = await Trek.findById(trekMatch._id).select('registration status').lean();
            if (!trek || trek.status !== 'published') {
                return res.status(404).json({ message: 'Trek not found' });
            }
            if ((trek.registration?.mode || 'internal_form') !== 'organizer_qr') {
                return res.status(400).json({ message: 'Payment screenshots are only used for UPI / QR treks.' });
            }
            if (trek.registration?.requireLogin !== false && !getOptionalUserId(req)) {
                return res.status(401).json({
                    message: 'Please log in to upload a payment screenshot for this trek.',
                    requireLogin: true,
                });
            }
            if (!req.file) {
                return res.status(400).json({ message: 'Image file is required' });
            }

            return uploadCtrl.uploadImage(req, res);
        } catch (err) {
            console.error('[Trek payment-screenshot] error:', err);
            res.status(500).json({ message: 'Failed to upload payment screenshot' });
        }
    },
);

// POST /api/treks/:id/register — save booking (login required unless registration.requireLogin === false)
// :id accepts Mongo ObjectId OR trek name slug (same as GET /treks/:idOrSlug)
router.post('/:id/register', registrationLimiter, optionalAuthenticateToken, async (req, res) => {
    try {
        const trekMatch = await findByIdOrSlug(Trek, req.params.id, {
            baseFilter: { status: 'published' },
            pickName: (row) => row.trekName || row.title || '',
            lean: true,
        });
        if (!trekMatch) return res.status(404).json({ message: 'Trek not found' });

        const trek = await Trek.findOne({ _id: trekMatch._id, status: 'published' })
            .populate('communityId', 'name groupLink')
            .lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });

        const { groupLink, communityName } = resolveTrekGroupLink(trek);

        if (trek.registration?.status === 'closed') {
            return res.status(400).json({ message: 'Registration is currently closed for this trek' });
        }
        if (trek.registration?.status === 'not_open_yet') {
            return res.status(400).json({ message: 'Registration is not open yet for this trek' });
        }

        const requireLogin = trek.registration?.requireLogin !== false;
        const userId = req.user?.userId || null;
        if (requireLogin && !userId) {
            return res.status(401).json({
                message: 'Please log in to book this trek.',
                requireLogin: true,
            });
        }

        const { formData = {}, bookingDetails = {} } = req.body;
        const configuredMax = Number(trek.registration?.maxPeoplePerBooking);
        const people = Math.max(1, Number(bookingDetails.people) || 1);
        // Enforce only intentional caps (legacy schema default was 10 = unlimited)
        if (Number.isFinite(configuredMax) && configuredMax > 0 && configuredMax !== 10 && people > configuredMax) {
            return res.status(400).json({
                message: `Maximum ${configuredMax} people allowed per booking`,
            });
        }
        const registrationFee = Number(trek.registrationFee) || 0;

        const genderCheck = await validateTrekGenderRegistration({
            trek,
            userId,
            formData,
            people,
        });
        if (!genderCheck.ok) {
            return res.status(genderCheck.status || 400).json({ message: genderCheck.message });
        }

        const capacity = Math.max(0, Number(trek.maxParticipants) || 0);
        if (capacity > 0) {
            const seatAgg = await TrekBooking.aggregate([
                { $match: { trekId: trek._id, status: 'confirmed' } },
                { $group: { _id: null, seats: { $sum: { $ifNull: ['$bookingDetails.people', 1] } } } },
            ]);
            const seatsHeld = Number(seatAgg[0]?.seats) || 0;
            if (seatsHeld >= capacity) {
                return res.status(400).json({ message: 'This trek is full' });
            }
            if (seatsHeld + people > capacity) {
                return res.status(400).json({ message: `Only ${capacity - seatsHeld} seat(s) left` });
            }
        }

        const userName =
            formData.full_name ||
            formData.name ||
            formData.fullname ||
            formData['Full Name'] ||
            formData['Name'] ||
            '';
        let userEmail = extractEmail(formData);

        // Phone-only accounts / custom forms without email — fall back to logged-in user
        if (!EMAIL_REGEX.test(userEmail) && userId) {
            try {
                const User = require('../model/usermodel');
                const account = await User.findById(userId).select('email').lean();
                if (account?.email) userEmail = String(account.email).trim().toLowerCase();
            } catch (_) { /* ignore */ }
        }

        if (!EMAIL_REGEX.test(userEmail)) {
            return res.status(400).json({ message: 'A valid email is required to complete registration. Please fill the E-mail field on the form.' });
        }

        let amountPaid = 0;
        let verifiedPaymentId = bookingDetails.paymentId || '';
        let paymentOrderId =
            bookingDetails.payment_order_id ||
            bookingDetails.paymentOrderId ||
            '';
        const regMode = trek.registration?.mode || 'internal_form';
        const isOrganizerQr = regMode === 'organizer_qr';
        let paymentGateway = null;
        let paymentScreenshotUrl = '';
        let transactionId = '';
        let bookingStatus = 'confirmed';
        let paymentStatus = registrationFee > 0 ? null : 'free';

        // Allow multiple bookings per account (BookMyShow-style).
        // Only reuse an existing pending QR submission so users can update their screenshot.
        const pendingQuery = userId
            ? { trekId: trek._id, userId, status: 'pending' }
            : { trekId: trek._id, userEmail, userId: null, status: 'pending' };
        const activeExisting = isOrganizerQr
            ? await TrekBooking.findOne(pendingQuery).sort({ createdAt: -1 })
            : null;
        const isQrPendingResubmit = Boolean(activeExisting && isOrganizerQr);

        // Idempotent: same trek + payment → return the existing booking as success
        if (paymentOrderId) {
            const existingBookingQuery = {
                payment_order_id: paymentOrderId,
                trekId: trek._id,
            };
            if (userId) existingBookingQuery.userId = userId;
            else {
                existingBookingQuery.userEmail = userEmail;
                existingBookingQuery.userId = null;
            }
            const existingBooking = await TrekBooking.findOne(existingBookingQuery).lean();
            if (existingBooking) {
                const accessToken = signTrekBookingAccess({
                    bookingId: existingBooking._id,
                    trekId: trek._id,
                    userEmail: existingBooking.userEmail || userEmail,
                });
                dispatchTrekBookingConfirmation({
                    userId: existingBooking.userId || userId,
                    userEmail: existingBooking.userEmail || userEmail,
                    userName: existingBooking.userName || userName,
                    trekName: trek.trekName || 'your trek',
                    bookingId: existingBooking._id,
                    bookingDetails: existingBooking.bookingDetails || bookingDetails,
                    amountPaid: existingBooking.bookingDetails?.amountPaid ?? 0,
                    groupLink,
                    communityName,
                    sendEmailOnly: true,
                    accessToken,
                });
                return res.json({
                    success: true,
                    alreadyBooked: true,
                    message: 'Booking already completed',
                    bookingId: existingBooking._id,
                    accessToken,
                });
            }
        }

        if (isOrganizerQr) {
            // UPI / QR path — organizer reviews screenshot (no Cashfree), unless qrAutoConfirm
            amountPaid = registrationFee > 0 ? registrationFee * people : 0;
            paymentGateway = amountPaid > 0 ? 'organizer_qr' : null;
            if (amountPaid > 0) {
                paymentScreenshotUrl = String(bookingDetails.paymentScreenshotUrl || '').trim();
                transactionId = normalizeTransactionId(bookingDetails.transactionId || '');
                if (!String(trek.registration?.paymentQR || '').trim()) {
                    return res.status(400).json({ message: 'Organizer payment QR is not configured yet. Please contact the trek organizer.' });
                }
                if (!paymentScreenshotUrl) {
                    return res.status(400).json({ message: 'Please upload your payment screenshot.' });
                }
                if (!isAllowedPaymentScreenshotUrl(paymentScreenshotUrl)) {
                    return res.status(400).json({ message: 'Invalid payment screenshot URL. Please re-upload from the booking form.' });
                }
                if (transactionId.length < 4) {
                    return res.status(400).json({ message: 'Please enter your UPI / transaction ID (at least 4 characters).' });
                }
                if (trek.registration?.qrAutoConfirm === true) {
                    bookingStatus = 'confirmed';
                    paymentStatus = 'paid';
                } else {
                    bookingStatus = 'pending';
                    paymentStatus = 'pending';
                }
            } else {
                bookingStatus = 'confirmed';
                paymentStatus = 'free';
            }
        } else if (registrationFee > 0) {
            // Security: re-verify Cashfree payment — never trust client amountPaid alone
            const paymentCheck = await verifyTrekBookingPayment({
                trek,
                people,
                paymentOrderId,
                paymentId: verifiedPaymentId,
                signature: bookingDetails.razorpay_signature
                    || bookingDetails.signature
                    || req.body?.razorpay_signature
                    || null,
            });

            if (!paymentCheck.ok) {
                return res.status(paymentCheck.status || 400).json({ message: paymentCheck.message });
            }

            amountPaid = paymentCheck.amountPaid;
            verifiedPaymentId = paymentCheck.paymentId;
            paymentOrderId = paymentOrderId || bookingDetails.payment_order_id;
            paymentGateway = paymentCheck.gateway === 'razorpay' ? 'razorpay' : 'cashfree';
            paymentStatus = 'paid';
            bookingStatus = 'confirmed';
        }

        const bookingFields = {
            userName,
            userEmail,
            participantGender: genderCheck.participantGender || null,
            formData,
            payment_gateway: paymentGateway,
            paymentScreenshotUrl,
            transactionId,
            paymentStatus,
            paymentReviewNote: '',
            paymentReviewedAt: null,
            paymentReviewedBy: '',
            bookingDetails: {
                date: bookingDetails.date || '',
                time: bookingDetails.time || '',
                people,
                amountPaid,
                paymentId: verifiedPaymentId,
                payment_order_id: paymentOrderId || '',
            },
            status: bookingStatus,
        };

        let booking;
        if (isQrPendingResubmit) {
            // Atomic update: only overwrite while still pending (blocks race with approve/reject)
            const pendingFilter = {
                _id: activeExisting._id,
                trekId: trek._id,
                status: 'pending',
            };
            if (userId) pendingFilter.userId = userId;
            else {
                pendingFilter.userEmail = userEmail;
                pendingFilter.userId = null;
            }
            booking = await TrekBooking.findOneAndUpdate(
                pendingFilter,
                { $set: bookingFields },
                { new: true },
            );
            if (!booking) {
                return res.status(409).json({
                    message: 'This registration was already reviewed. Refresh and try again.',
                    bookingId: activeExisting._id,
                });
            }
        } else {
            try {
                booking = await TrekBooking.create({
                    trekId: trek._id,
                    userId: userId || null,
                    payment_order_id: paymentOrderId || undefined,
                    ...bookingFields,
                });
            } catch (createErr) {
                // Concurrent double-submit with the same Cashfree order
                if (createErr?.code === 11000) {
                    const keys = Object.keys(createErr.keyPattern || {});
                    if (keys.includes('payment_order_id') && paymentOrderId) {
                        const raced = await TrekBooking.findOne({
                            payment_order_id: paymentOrderId,
                            trekId: trek._id,
                        }).lean();
                        if (raced) {
                            return res.status(200).json({
                                success: true,
                                alreadyBooked: true,
                                message: 'Booking already completed',
                                bookingId: raced._id,
                            });
                        }
                    }
                    return res.status(409).json({
                        message: 'This payment has already been used for a booking',
                    });
                }
                throw createErr;
            }
        }

        // Capacity race guard — many users can hit register at once; cancel if we oversold
        if (capacity > 0 && bookingStatus === 'confirmed' && booking) {
            const postAgg = await TrekBooking.aggregate([
                { $match: { trekId: trek._id, status: 'confirmed' } },
                { $group: { _id: null, seats: { $sum: { $ifNull: ['$bookingDetails.people', 1] } } } },
            ]);
            const seatsAfter = Number(postAgg[0]?.seats) || 0;
            if (seatsAfter > capacity) {
                booking.status = 'cancelled';
                booking.paymentStatus = registrationFee > 0 ? 'failed' : 'free';
                booking.paymentReviewNote = 'Auto-cancelled: trek became full';
                await booking.save();
                return res.status(400).json({ message: 'This trek is full' });
            }
        }

        if (paymentOrderId) {
            consumeCouponUsageForOrder({ paymentOrderId, userId }).catch(() => {});
        }

        const sheetsUrl = process.env.TREK_REGISTRATION_USE_SHEETS === 'true'
            ? trek.registration?.googleSheetsUrl
            : '';
        if (sheetsUrl && bookingStatus === 'confirmed') {
            try {
                const responses = {
                    'Trek Name': trek.trekName,
                    'Trek Date': bookingDetails.date || '',
                    'Trek Time': bookingDetails.time || '',
                    'No. of People': people,
                    'Amount Paid': amountPaid,
                    'Payment ID': verifiedPaymentId,
                    'Order ID': paymentOrderId || '',
                    'Submitted At': new Date().toLocaleString('en-IN'),
                    ...formData,
                };
                await appendToGoogleSheets(
                    sheetsUrl,
                    responses,
                    { name: trek.trekName, id: trek._id },
                    { name: userName, email: userEmail }
                );
            } catch (sheetErr) {
                console.error('[Trek Register] Sheets error:', sheetErr.message);
            }
        }

        const trekName = trek.trekName || 'your trek';
        const accessToken = signTrekBookingAccess({
            bookingId: booking._id,
            trekId: trek._id,
            userEmail,
        });

        if (bookingStatus === 'pending') {
            res.json({
                success: true,
                pendingReview: true,
                message: 'Payment submitted — waiting for organizer approval',
                bookingId: booking._id,
                accessToken,
            });
            const accessQuery = `&access=${encodeURIComponent(accessToken)}`;
            void notifyTrekParticipant({
                booking: booking.toObject ? booking.toObject() : booking,
                trekId: trek._id,
                trekName,
                title: 'Payment submitted — awaiting approval',
                message: `Thanks! Your payment screenshot for ${trekName} was submitted. The trek organizer will review it and confirm your spot. You’ll get another email once it’s approved.`,
                type: 'registration',
                link: `/registration-details/${booking._id}?type=trek${accessQuery}`,
                emailSubject: `Payment submitted — waiting for approval · ${trekName}`,
                metadata: { registrationId: booking._id, stage: 'pending_review' },
            }).catch((err) => console.error('[Trek Register] Pending notify error:', err.message));
            return;
        }

        res.json({
            success: true,
            message: 'Registration recorded',
            bookingId: booking._id,
            accessToken,
        });

        dispatchTrekBookingConfirmation({
            userId,
            userEmail,
            userName,
            trekName,
            bookingId: booking._id,
            bookingDetails,
            amountPaid,
            groupLink,
            communityName,
            accessToken,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'This payment has already been used for a booking' });
        }
        console.error('[Trek Register] error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

module.exports = router;