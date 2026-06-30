const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const { appendToGoogleSheets } = require('../services/googleSheetsService');
const { verifyTrekBookingPayment } = require('../utils/trekPaymentVerification');
const { createNotification } = require('../controllers/notificationController');
const { sendPushNotification } = require('../services/pushService');
const { authenticateToken } = require('../middleware/authmiddleware');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmail(formData = {}) {
    return (
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
            .sort({ trekDate: 1, createdAt: -1 })
            .limit(50)
            .lean();

        res.status(200).json({ treks });
    } catch (error) {
        console.error('publicTrek getAllTreks error:', error);
        res.status(500).json({ message: 'Failed to fetch treks' });
    }
});

// GET /api/treks/:id — single trek detail
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid trek ID' });
        }
        const trek = await Trek.findOne({ _id: id, status: 'published' }).lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });
        res.json({ trek });
    } catch (error) {
        console.error('publicTrek getTrekById error:', error);
        res.status(500).json({ message: 'Failed to fetch trek' });
    }
});

// POST /api/treks/:id/register — save booking (login required; payment re-verified server-side for paid treks)
router.post('/:id/register', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid trek ID' });
        }
        const trek = await Trek.findOne({ _id: req.params.id, status: 'published' }).lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });

        if (trek.registration?.status === 'closed') {
            return res.status(400).json({ message: 'Registration is currently closed for this trek' });
        }

        const { formData = {}, bookingDetails = {} } = req.body;
        const people = Math.max(1, Number(bookingDetails.people) || 1);
        const registrationFee = Number(trek.registrationFee) || 0;

        const userName =
            formData.full_name ||
            formData.name ||
            formData.fullname ||
            formData['Full Name'] ||
            formData['Name'] ||
            '';
        const userEmail = extractEmail(formData);

        if (!EMAIL_REGEX.test(userEmail)) {
            return res.status(400).json({ message: 'A valid email is required to complete registration' });
        }

        let amountPaid = 0;
        let verifiedPaymentId = bookingDetails.paymentId || '';
        let paymentOrderId =
            bookingDetails.payment_order_id ||
            bookingDetails.paymentOrderId ||
            '';

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

        const sheetsUrl = trek.registration?.googleSheetsUrl;
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

        res.json({ success: true, message: 'Registration recorded', bookingId: booking._id });

        const trekName = trek.trekName || 'your trek';
        const link = `/registration-details/${booking._id}?type=trek`;
        setImmediate(async () => {
            try {
                await createNotification({
                    userId,
                    title: 'Trek Booking Confirmed!',
                    message: `You've successfully registered for ${trekName}.`,
                    type: 'registration',
                    link,
                    metadata: { registrationId: booking._id },
                });
                sendPushNotification(userId, {
                    title: 'Trek Booking Confirmed!',
                    body: `You've registered for ${trekName}`,
                    link,
                    type: 'registration',
                }).catch(() => {});
            } catch (notifErr) {
                console.error('[Trek Register] Notification error:', notifErr.message);
            }
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
