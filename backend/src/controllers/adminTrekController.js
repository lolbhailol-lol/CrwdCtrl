const mongoose = require('mongoose');
const Trek = require('../model/trek_model');
const TrekBooking = require('../model/trek_booking_model');
const { sanitizeTrekFilters } = require('../constants/trekFilterOptions');
const { sanitizeCoverImages, primaryCoverUrl } = require('../utils/sanitizeCoverImages');

function normalizeTrekPayload(body) {
    const payload = { ...body };
    if (payload.trekFilters !== undefined) {
        payload.trekFilters = sanitizeTrekFilters(payload.trekFilters);
    }
    if (payload.coverImages !== undefined) {
        payload.coverImages = sanitizeCoverImages(payload.coverImages);
        payload.coverImage = primaryCoverUrl(payload.coverImages, payload.coverImage) || null;
    }
    return payload;
}

exports.createTrek = async (req, res) => {
    try {
        const { trekName, difficultyLevel } = req.body;
        if (!trekName || !difficultyLevel) {
            return res.status(400).json({ message: 'trekName and difficultyLevel are required' });
        }
        const trek = new Trek({
            ...normalizeTrekPayload(req.body),
            communityId: req.body.communityId || null,
            createdBy: req.user?._id || null,
        });
        await trek.save();
        res.status(201).json({ message: 'Trek created successfully', trek });
    } catch (error) {
        console.error('adminTrek createTrek error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed', details: error.message });
        }
        res.status(500).json({ message: 'Failed to create trek', error: error.message });
    }
};

exports.getAllTreks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.difficultyLevel) filter.difficultyLevel = req.query.difficultyLevel;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.communityId) filter.communityId = req.query.communityId;

        const total = await Trek.countDocuments(filter);
        const treks = await Trek.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            treks,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error('adminTrek getAllTreks error:', error);
        res.status(500).json({ message: 'Failed to fetch treks' });
    }
};

exports.getTrekById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const trek = await Trek.findById(id).lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });
        res.json({ trek });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch trek', error: error.message });
    }
};

exports.updateTrek = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const body = normalizeTrekPayload(req.body);
        // Coerce empty strings to null so enum validation doesn't fail
        if (body.featuredSection === '') body.featuredSection = null;
        if (body.homeSection === '') body.homeSection = null;
        if (body.trekCategory === '') body.trekCategory = null;
        const trek = await Trek.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: false });
        if (!trek) return res.status(404).json({ message: 'Trek not found' });
        res.json({ message: 'Trek updated successfully', trek });
    } catch (error) {
        console.error('adminTrek updateTrek error:', error);
        res.status(500).json({ message: 'Failed to update trek', error: error.message });
    }
};

exports.getTrekBookings = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid trek ID' });
        }
        const trek = await Trek.findById(id).select('trekName').lean();
        if (!trek) return res.status(404).json({ message: 'Trek not found' });

        const { status } = req.query;
        const filter = { trekId: id };
        if (status) filter.status = status;

        const bookings = await TrekBooking.find(filter)
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ bookings, total: bookings.length, trek });
    } catch (error) {
        console.error('adminTrek getTrekBookings error:', error);
        res.status(500).json({ message: 'Failed to fetch trek bookings' });
    }
};

exports.updateTrekBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }
        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'status must be confirmed or cancelled' });
        }
        const booking = await TrekBooking.findByIdAndUpdate(
            bookingId,
            { status },
            { new: true },
        ).populate('userId', 'name email phone');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        res.json({ message: 'Booking status updated', booking });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update booking status' });
    }
};

exports.deleteTrek = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const trek = await Trek.findByIdAndDelete(id);
        if (!trek) return res.status(404).json({ message: 'Trek not found' });
        res.json({ message: 'Trek deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete trek' });
    }
};
