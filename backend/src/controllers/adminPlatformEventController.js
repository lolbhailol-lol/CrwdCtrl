const mongoose = require('mongoose');
const PlatformEvent = require('../model/platform_event_model');

/* =========================
   CREATE EVENT (ADMIN)
========================= */
exports.createEvent = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            venue,
            city,
            startDate,
            endDate,
            organizer,
            images,
            registrationLink,
            price,
            status,
        } = req.body;

        if (!title || !description || !category) {
            return res.status(400).json({ message: 'title, description, and category are required' });
        }

        const event = new PlatformEvent({
            title,
            description,
            category,
            venue: venue || '',
            city: city || '',
            startDate: startDate || null,
            endDate: endDate || null,
            organizer: organizer || '',
            images: images || [],
            registrationLink: registrationLink || '',
            price: price || 0,
            status: status || 'published',
            createdBy: req.user?._id || null,
        });

        await event.save();

        res.status(201).json({ message: 'Event created successfully', event });
    } catch (error) {
        console.error('Admin createEvent error:', error);
        res.status(500).json({ message: 'Failed to create event', error: error.message });
    }
};

/* =========================
   GET ALL EVENTS (ADMIN)
========================= */
exports.getAllEvents = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) {
            filter.category = req.query.category;
        }

        const total = await PlatformEvent.countDocuments(filter);
        const events = await PlatformEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            events,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
                limit,
            },
        });
    } catch (error) {
        console.error('Admin getAllEvents error:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
};

/* =========================
   UPDATE EVENT
========================= */
exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await PlatformEvent.findByIdAndUpdate(id, req.body, { new: true });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({ message: 'Event updated successfully', event });
    } catch (error) {
        console.error('Admin updateEvent error:', error);
        res.status(500).json({ message: 'Failed to update event', error: error.message });
    }
};

/* =========================
   DELETE EVENT
========================= */
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid event ID' });
        }

        const event = await PlatformEvent.findByIdAndDelete(id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Admin deleteEvent error:', error);
        res.status(500).json({ message: 'Failed to delete event' });
    }
};
