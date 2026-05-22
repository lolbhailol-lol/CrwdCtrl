const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const { appendToGoogleSheets } = require('../services/googleSheetsService');

// Extract userId from optional Bearer token without blocking the request
function optionalUserId(req) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) return null;
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(auth.split(' ')[1], secret);
        return decoded.userId || decoded.id || null;
    } catch {
        return null;
    }
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

// POST /api/treks/:id/register — save booking to Google Sheets
router.post('/:id/register', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid trek ID' });
        }
        const trek = await Trek.findOne({ _id: req.params.id, status: 'published' }).lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });

        const { formData = {}, bookingDetails = {} } = req.body;

        // Save booking to database (links to user if auth token present)
        const userId = optionalUserId(req);
        const userName  = formData.full_name || formData.name || formData.fullname || formData['Full Name'] || formData['Name'] || '';
        const userEmail = formData.email || formData.e_mail_id || formData.e_mail || formData['Email'] || formData['E-mail'] || '';

        const booking = await TrekBooking.create({
            trekId: trek._id,
            ...(userId ? { userId } : {}),
            userName,
            userEmail,
            formData,
            bookingDetails: {
                date:       bookingDetails.date || '',
                time:       bookingDetails.time || '',
                people:     Number(bookingDetails.people) || 1,
                amountPaid: Number(bookingDetails.amountPaid) || 0,
                paymentId:  bookingDetails.paymentId || '',
            },
            status: 'confirmed',
        });

        // Also append to Google Sheets if configured
        const sheetsUrl = trek.registration?.googleSheetsUrl;
        if (sheetsUrl) {
            try {
                const responses = {
                    'Trek Name':     trek.trekName,
                    'Trek Date':     bookingDetails.date || '',
                    'Trek Time':     bookingDetails.time || '',
                    'No. of People': bookingDetails.people || 1,
                    'Amount Paid':   bookingDetails.amountPaid || 0,
                    'Payment ID':    bookingDetails.paymentId || '',
                    'Submitted At':  new Date().toLocaleString('en-IN'),
                    ...formData,
                };
                await appendToGoogleSheets(sheetsUrl, responses,
                    { name: trek.trekName, id: trek._id },
                    { name: userName, email: userEmail }
                );
            } catch (sheetErr) {
                console.error('[Trek Register] Sheets error:', sheetErr.message);
            }
        }

        res.json({ success: true, message: 'Registration recorded', bookingId: booking._id });
    } catch (err) {
        console.error('[Trek Register] error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

module.exports = router;
