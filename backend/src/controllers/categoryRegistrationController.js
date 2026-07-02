const mongoose = require('mongoose');
const CategoryRegistration = require('../model/category_registration_model');
const SportsEvent = require('../model/sports_model');
const Trek = require('../model/trek_model');
const EventShow = require('../model/event_show_model');
const { verifySportsBookingPayment } = require('../utils/sportsPaymentVerification');

const MODEL_MAP = {
    sports: SportsEvent,
    trek: Trek,
    events: EventShow,
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
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const Model = MODEL_MAP[category];
        const event = await Model.findById(eventId).lean();
        if (!event) {
            return res.status(404).json({ message: `${category} event not found` });
        }

        if (event.registration?.status === 'closed') {
            return res.status(400).json({ message: 'Registration is currently closed for this event' });
        }

        const userId = req.user?.userId || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const responses = req.body.responses || req.body.formData || {};
        const bookingDetails = req.body.bookingDetails || {};
        const registrationFee = Number(event.registrationFee) || 0;

        // Idempotent payment retry: the SAME payment must not create a second
        // registration, but must succeed (not 409) so a resume/double-submit
        // after a redirect payment lands on the success screen instead of the
        // form. Repeat registrations with a new payment are allowed.
        const retryOrderId = bookingDetails.payment_order_id || bookingDetails.paymentOrderId || null;
        if (retryOrderId) {
            const existing = await CategoryRegistration.findOne({
                category,
                eventId,
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

        // Paid runs: re-verify the Cashfree payment server-side before confirming.
        let paymentStatus = 'free';
        let amountPaid = 0;
        let paymentOrderId = bookingDetails.payment_order_id || bookingDetails.paymentOrderId || null;
        let paymentId = bookingDetails.paymentId || null;

        if (registrationFee > 0) {
            const people = Math.max(1, Number(bookingDetails.people) || 1);
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
        }

        const registration = new CategoryRegistration({
            category,
            eventId,
            user: userId,
            responses,
            paymentStatus,
            amountPaid,
            payment_order_id: paymentOrderId || null,
            payment_id: paymentId || null,
            payment_gateway: registrationFee > 0 ? 'cashfree' : null,
            status: 'confirmed',
        });

        await registration.save();

        res.status(201).json({ message: 'Registration successful', registration });
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
                    .select('title eventDate venue city sportType images status')
                    .lean();
                const eventMap = Object.fromEntries(events.map((e) => [String(e._id), e]));
                registrations.forEach((reg) => {
                    if (reg.category === 'sports') {
                        reg.event = eventMap[String(reg.eventId)] || null;
                    }
                });
            }
        }

        res.json({ registrations });
    } catch (error) {
        console.error('categoryRegistration getMyRegistrations error:', error);
        res.status(500).json({ message: 'Failed to fetch registrations' });
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
        if (req.query.eventId) filter.eventId = req.query.eventId;
        if (req.query.status) filter.status = req.query.status;

        const total = await CategoryRegistration.countDocuments(filter);
        const registrations = await CategoryRegistration.find(filter)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            registrations,
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

        res.json({ message: 'Registration status updated', registration: reg });
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
