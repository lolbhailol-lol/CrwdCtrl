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
const { authenticateToken } = require('../middleware/authmiddleware');
const { getJwtSecret } = require('../config/jwtSecret');
const {
    getGenderRegistrationSnapshot,
    validateTrekGenderRegistration,
} = require('../utils/trekGenderRegistration');
const { resolveTrekGroupLink } = require('../utils/resolveTrekGroupLink');
const { findByIdOrSlug } = require('../utils/slug');

function stripTrekGroupLinks(trek) {
    if (!trek) return trek;
    const copy = { ...trek };
    delete copy.groupLink;
    if (copy.communityId && typeof copy.communityId === 'object') {
        const { groupLink: _omit, ...communityRest } = copy.communityId;
        copy.communityId = communityRest;
    }
    return copy;
}

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
}) {
    const link = `/registration-details/${bookingId}?type=trek`;
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

// GET /api/treks — list published treks, supports ?difficulty=easy&city=pune&communityId=...&category=...
router.get('/', async (req, res) => {
    try {
        const filter = { status: 'published' };
        if (req.query.difficulty) filter.difficultyLevel = req.query.difficulty;
        if (req.query.city) filter.city = { $regex: req.query.city, $options: 'i' };
        if (req.query.communityId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.communityId)) {
                return res.status(400).json({ message: 'Invalid community ID' });
            }
            filter.communityId = req.query.communityId;
        }
        if (req.query.category || req.query.trekCategory) {
            filter.trekCategory = req.query.category || req.query.trekCategory;
        }

        const treks = await Trek.find(filter)
            .sort({ communityPriority: 1, trekDate: 1, createdAt: -1 })
            .limit(50)
            .lean();

        res.status(200).json({ treks });
    } catch (error) {
        console.error('publicTrek getAllTreks error:', error);
        res.status(500).json({ message: 'Failed to fetch treks' });
    }
});

// GET /api/treks/:id — single trek detail
router.get('/:idOrSlug', async (req, res) => {
    try {
        const trekMatch = await findByIdOrSlug(Trek, req.params.idOrSlug, {
            baseFilter: { status: 'published' },
            pickName: (row) => row.trekName,
            lean: true,
        });
        if (!trekMatch) return res.status(404).json({ message: 'Trek not found' });
        const trek = await Trek.findOne({ _id: trekMatch._id, status: 'published' })
            .populate('communityId', 'name basedIn contactPhone contactInstagram')
            .lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });
        const genderRegistration = await getGenderRegistrationSnapshot(trek);

        let userBooking = null;
        const userId = getOptionalUserId(req);
        if (userId) {
            const existing = await TrekBooking.findOne({
                trekId: trek._id,
                userId,
                status: 'confirmed',
            }).select('_id').lean();
            if (existing) {
                userBooking = { bookingId: existing._id };
            }
        }

        res.json({ trek: stripTrekGroupLinks(trek), genderRegistration, userBooking });
    } catch (error) {
        console.error('publicTrek getTrekById error:', error);
        res.status(500).json({ message: 'Failed to fetch trek' });
    }
});

// POST /api/treks/:id/register — save booking (login required; payment re-verified server-side for paid treks)
// :id accepts Mongo ObjectId OR trek name slug (same as GET /treks/:idOrSlug)
router.post('/:id/register', authenticateToken, async (req, res) => {
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

        const { formData = {}, bookingDetails = {} } = req.body;
        const people = 1;
        const registrationFee = Number(trek.registrationFee) || 0;

        const genderCheck = await validateTrekGenderRegistration({
            trek,
            userId: req.user.userId,
            formData,
            people,
        });
        if (!genderCheck.ok) {
            return res.status(genderCheck.status || 400).json({ message: genderCheck.message });
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
        if (!EMAIL_REGEX.test(userEmail) && req.user?.userId) {
            try {
                const User = require('../model/usermodel');
                const account = await User.findById(req.user.userId).select('email').lean();
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

        // Idempotent: same user + trek + payment → return the existing booking as
        // success. Must run BEFORE verifyTrekBookingPayment, which 409s on any order
        // reuse. Scoped to this trek + user so an unrelated order id can't match.
        if (paymentOrderId) {
            const existingBooking = await TrekBooking.findOne({
                payment_order_id: paymentOrderId,
                trekId: trek._id,
                userId: req.user.userId,
            }).lean();
            if (existingBooking) {
                // Retry path: booking already saved — still ensure user gets confirmation mail
                dispatchTrekBookingConfirmation({
                    userId: req.user.userId,
                    userEmail: existingBooking.userEmail || userEmail,
                    userName: existingBooking.userName || userName,
                    trekName: trek.trekName || 'your trek',
                    bookingId: existingBooking._id,
                    bookingDetails: existingBooking.bookingDetails || bookingDetails,
                    amountPaid: existingBooking.bookingDetails?.amountPaid ?? 0,
                    groupLink,
                    communityName,
                    sendEmailOnly: true,
                });
                return res.json({
                    success: true,
                    alreadyBooked: true,
                    message: 'Booking already completed',
                    bookingId: existingBooking._id,
                });
            }
        }

        if (registrationFee > 0) {
            // Security: re-verify Cashfree payment — never trust client amountPaid alone
            const paymentCheck = await verifyTrekBookingPayment({
                trek,
                people,
                paymentOrderId,
                paymentId: verifiedPaymentId,
            });

            if (!paymentCheck.ok) {
                return res.status(paymentCheck.status || 400).json({ message: paymentCheck.message });
            }

            amountPaid = paymentCheck.amountPaid;
            verifiedPaymentId = paymentCheck.paymentId;
            paymentOrderId = paymentOrderId || bookingDetails.payment_order_id;
        }

        const userId = req.user.userId;

        const booking = await TrekBooking.create({
            trekId: trek._id,
            userId,
            userName,
            userEmail,
            participantGender: genderCheck.participantGender || null,
            formData,
            payment_order_id: paymentOrderId || undefined,
            bookingDetails: {
                date: bookingDetails.date || '',
                time: bookingDetails.time || '',
                people,
                amountPaid,
                paymentId: verifiedPaymentId,
                payment_order_id: paymentOrderId || '',
            },
            status: 'confirmed',
        });
        if (paymentOrderId) {
            consumeCouponUsageForOrder({ paymentOrderId, userId }).catch(() => {});
        }

        const sheetsUrl = process.env.TREK_REGISTRATION_USE_SHEETS === 'true'
            ? trek.registration?.googleSheetsUrl
            : '';
        if (sheetsUrl) {
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

        res.json({
            success: true,
            message: 'Registration recorded',
            bookingId: booking._id,
        });

        dispatchTrekBookingConfirmation({
            userId,
            userEmail,
            userName,
            trekName: trek.trekName || 'your trek',
            bookingId: booking._id,
            bookingDetails,
            amountPaid,
            groupLink,
            communityName,
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
