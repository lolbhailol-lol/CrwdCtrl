/**
 * Fest Organizer Controller
 * 
 * This controller handles all fest-related operations including:
 * - CRUD operations for fests
 * - Event and competition management
 * - Public fest discovery and search
 * - Statistics and analytics
 * - Admin approval management
 * 
 * All routes require authentication except public discovery routes
 */

const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const User = require('../model/usermodel');
const Event = require('../model/event_model');
const Competition = require('../model/competition_model');

// ✅ In-memory cache for fests (free, no external service needed)
const festsCache = {
    data: null,
    timestamp: 0,
    duration: 5 * 60 * 1000 // 5 minutes cache duration
};

// Helper function to check if cache is valid
const isCacheValid = () => {
    return festsCache.data && (Date.now() - festsCache.timestamp) < festsCache.duration;
};

// Helper function to clear cache (call when fests are modified)
const clearFestsCache = () => {
    festsCache.data = null;
    festsCache.timestamp = 0;
    console.log('🗑️ Fests cache cleared');
};

// ✅ Create a new fest
exports.createFest = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const {
            collegeName,
            festName,
            festType,
            description,
            startDate,
            endDate,
            location,
            highlights,
            coverImage,
            gallery,
            websiteLink,
            registrationLink,
        } = req.body;

        // Validation
        if (!collegeName || !festName || !festType || !description || !startDate || !endDate || !location) {
            return res.status(400).json({
                error: 'Missing required fields: collegeName, festName, festType, description, startDate, endDate, location'
            });
        }

        // Date validation
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();

        if (start < now) {
            return res.status(400).json({ error: 'Start date cannot be in the past' });
        }

        if (end <= start) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        // Check if festType is valid
        const validFestTypes = ['cultural', 'technical', 'sports', 'management', 'other'];
        if (!validFestTypes.includes(festType)) {
            return res.status(400).json({
                error: 'Invalid fest type. Must be one of: cultural, technical, sports, management, other'
            });
        }

        // Check if organizer already has a fest with the same name
        const existingFest = await FestOrganizer.findOne({
            organizer: organizerId,
            festName: { $regex: new RegExp(`^${festName}$`, 'i') }
        });

        if (existingFest) {
            return res.status(400).json({ error: 'You already have a fest with this name' });
        }

        const fest = new FestOrganizer({
            organizer: organizerId,
            collegeName: collegeName.trim(),
            festName: festName.trim(),
            festType,
            description: description.trim(),
            startDate: start,
            endDate: end,
            location: location.trim(),
            highlights: highlights || [],
            coverImage,
            gallery: gallery || [],
            websiteLink,
            registrationLink,
        });

        await fest.save();

        // Clear cache when new fest is created
        clearFestsCache();

        // Populate organizer info before sending response
        await fest.populate('organizer', 'name email college');

        res.status(201).json({
            message: 'Fest created successfully',
            fest
        });
    } catch (err) {
        console.error('Error in createFest:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Update fest details
exports.updateFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({ message: 'Invalid fest ID' });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        const updateData = { ...req.body };

        // Date validation if dates are being updated
        if (updateData.startDate || updateData.endDate) {
            const start = updateData.startDate ? new Date(updateData.startDate) : fest.startDate;
            const end = updateData.endDate ? new Date(updateData.endDate) : fest.endDate;
            const now = new Date();

            if (start < now && updateData.startDate) {
                return res.status(400).json({ error: 'Start date cannot be in the past' });
            }

            if (end <= start) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }

            updateData.startDate = start;
            updateData.endDate = end;
        }

        // Validate festType if being updated
        if (updateData.festType) {
            const validFestTypes = ['cultural', 'technical', 'sports', 'management', 'other'];
            if (!validFestTypes.includes(updateData.festType)) {
                return res.status(400).json({
                    error: 'Invalid fest type. Must be one of: cultural, technical, sports, management, other'
                });
            }
        }

        // Trim string fields
        if (updateData.collegeName) updateData.collegeName = updateData.collegeName.trim();
        if (updateData.festName) updateData.festName = updateData.festName.trim();
        if (updateData.description) updateData.description = updateData.description.trim();
        if (updateData.location) updateData.location = updateData.location.trim();

        // Check for duplicate fest name if festName is being updated
        if (updateData.festName && updateData.festName !== fest.festName) {
            const existingFest = await FestOrganizer.findOne({
                organizer: organizerId,
                festName: { $regex: new RegExp(`^${updateData.festName}$`, 'i') },
                _id: { $ne: festId }
            });

            if (existingFest) {
                return res.status(400).json({ error: 'You already have a fest with this name' });
            }
        }

        // Don't allow updating organizer, events, competitions, or isApproved through this endpoint
        delete updateData.organizer;
        delete updateData.events;
        delete updateData.competitions;
        delete updateData.isApproved;

        const updatedFest = await FestOrganizer.findByIdAndUpdate(
            festId,
            updateData,
            { new: true, runValidators: true }
        ).populate('organizer', 'name email college');

        // Clear cache when fest is updated
        clearFestsCache();

        res.status(200).json({ message: 'Fest updated successfully', fest: updatedFest });
    } catch (err) {
        console.error('Error in updateFest:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get all fests by organizer
exports.getMyFests = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const fests = await FestOrganizer.find({ organizer: organizerId }).sort({ createdAt: -1 });
        res.status(200).json(fests);
    } catch (err) {
        console.error('Error in getMyFests:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get single fest details
exports.getFestById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate if the provided ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided ID is not a valid MongoDB ObjectId'
            });
        }

        // Handle case where organizer might be null (admin-created fests)
        let fest = await FestOrganizer.findById(id)
            .populate({
                path: 'organizer',
                select: 'name email college',
                // Don't fail if organizer is null
                options: { strictPopulate: false }
            });

        if (fest && fest.competitions && fest.competitions.length > 0) {
            // Manually populate competitions to ensure they're loaded correctly
            try {
                const Competition = require('../model/competition_model');
                
                const populatedCompetitions = await Competition.find({
                    _id: { $in: fest.competitions }
                });
                
                fest.competitions = populatedCompetitions;
            } catch (populateError) {
                console.error('getFestById - Error populating competitions:', populateError);
                fest.competitions = [];
            }
        }

        if (!fest) {
            return res.status(404).json({ message: 'Fest not found' });
        }
        
        // For public access, only return approved fests
        if (!fest.isApproved) {
            return res.status(404).json({ message: 'Fest not found' });
        }
        
        // Debug: Log contacts data
        console.log('🔍 Public fest - contacts data:', fest.contacts);
        console.log('🔍 Public fest - artistsHeading:', fest.artistsHeading);
        console.log('🔍 Public fest - competitionsHeading:', fest.competitionsHeading);
        
        res.status(200).json(fest);
    } catch (err) {
        console.error('Error in getFestById:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// ✅ Delete fest
exports.deleteFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided ID is not a valid MongoDB ObjectId'
            });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        await FestOrganizer.findByIdAndDelete(festId);
        
        // Clear cache when fest is deleted
        clearFestsCache();
        
        res.status(200).json({ message: 'Fest deleted successfully' });
    } catch (err) {
        console.error('Error in deleteFest:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get all fests (public) - for discovery page
exports.getAllFests = async (req, res) => {
    try {
        const { page = 1, limit = 20, festType, college, search, sortBy = 'createdAt' } = req.query;

        // Create cache key based on query parameters
        const cacheKey = JSON.stringify({ page, limit, festType, college, search, sortBy });
        
        // Check if we have valid cached data for this specific query
        if (isCacheValid() && festsCache.data && festsCache.data[cacheKey]) {
            console.log('✅ Returning cached fests data');
            return res.status(200).json(festsCache.data[cacheKey]);
        }

        console.log('🔄 Fetching fresh fests data from database');

        // Build filter object
        const filter = {};
        if (festType) filter.festType = festType;
        if (college) filter.collegeName = { $regex: college, $options: 'i' };
        if (search) {
            filter.$or = [
                { festName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { collegeName: { $regex: search, $options: 'i' } }
            ];
        }

        // Only show approved fests for public view
        filter.isApproved = true;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Optimized query: removed .populate(), added .lean(), selected only needed fields
        const fests = await FestOrganizer.find(filter)
            .select('festName collegeName festType festDate venue coverImage images festImages description status ticketPrice highlights startDate endDate duration estimatedParticipants')
            .lean() // Returns plain JS objects, 40-60% faster
            .sort({ [sortBy]: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await FestOrganizer.countDocuments(filter);

        const responseData = {
            fests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalFests: total,
                limit: parseInt(limit)
            }
        };

        // Update cache
        if (!festsCache.data) {
            festsCache.data = {};
        }
        festsCache.data[cacheKey] = responseData;
        festsCache.timestamp = Date.now();
        console.log('💾 Cached fests data for 5 minutes');

        res.status(200).json(responseData);
    } catch (err) {
        console.error('Error in getAllFests:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Search fests
exports.searchFests = async (req, res) => {
    try {
        const { query, festType, location, startDate, endDate } = req.query;

        const filter = { isApproved: true };

        if (query) {
            filter.$or = [
                { festName: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { collegeName: { $regex: query, $options: 'i' } },
                { highlights: { $in: [new RegExp(query, 'i')] } }
            ];
        }

        if (festType) filter.festType = festType;
        if (location) filter.location = { $regex: location, $options: 'i' };

        if (startDate || endDate) {
            filter.startDate = {};
            if (startDate) filter.startDate.$gte = new Date(startDate);
            if (endDate) filter.startDate.$lte = new Date(endDate);
        }

        const fests = await FestOrganizer.find(filter)
            .populate('organizer', 'name email college')
            .sort({ startDate: 1 });

        res.status(200).json(fests);
    } catch (err) {
        console.error('Error in searchFests:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Add event to fest
exports.addEventToFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;
        const { eventId } = req.body;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Validate event ObjectId if provided
        if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                error: 'Invalid event ID format',
                message: 'The provided event ID is not a valid MongoDB ObjectId'
            });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        if (!fest.events.includes(eventId)) {
            fest.events.push(eventId);
            await fest.save();
        }

        res.status(200).json({ message: 'Event added to fest successfully', fest });
    } catch (err) {
        console.error('Error in addEventToFest:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Remove event from fest
exports.removeEventFromFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;
        const { eventId } = req.body;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Validate event ObjectId if provided
        if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                error: 'Invalid event ID format',
                message: 'The provided event ID is not a valid MongoDB ObjectId'
            });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        fest.events = fest.events.filter(id => id.toString() !== eventId);
        await fest.save();

        res.status(200).json({ message: 'Event removed from fest successfully', fest });
    } catch (err) {
        console.error('Error in removeEventFromFest:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Add competition to fest
exports.addCompetitionToFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;
        const { competitionId } = req.body;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Validate competition ObjectId if provided
        if (competitionId && !mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({
                error: 'Invalid competition ID format',
                message: 'The provided competition ID is not a valid MongoDB ObjectId'
            });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        if (!fest.competitions.includes(competitionId)) {
            fest.competitions.push(competitionId);
            await fest.save();
        }

        res.status(200).json({ message: 'Competition added to fest successfully', fest });
    } catch (err) {
        console.error('Error in addCompetitionToFest:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Remove competition from fest
exports.removeCompetitionFromFest = async (req, res) => {
    try {
        const festId = req.params.id;
        const organizerId = req.user.userId;
        const { competitionId } = req.body;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Validate competition ObjectId if provided
        if (competitionId && !mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({
                error: 'Invalid competition ID format',
                message: 'The provided competition ID is not a valid MongoDB ObjectId'
            });
        }

        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) return res.status(404).json({ message: 'Fest not found or unauthorized' });

        fest.competitions = fest.competitions.filter(id => id.toString() !== competitionId);
        await fest.save();

        res.status(200).json({ message: 'Competition removed from fest successfully', fest });
    } catch (err) {
        console.error('Error in removeCompetitionFromFest:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Toggle fest approval status (Admin only)
exports.toggleFestApproval = async (req, res) => {
    try {
        const festId = req.params.id;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided ID is not a valid MongoDB ObjectId'
            });
        }

        // Note: Add admin role check in middleware
        const fest = await FestOrganizer.findById(festId);
        if (!fest) return res.status(404).json({ message: 'Fest not found' });

        fest.isApproved = !fest.isApproved;
        await fest.save();

        res.status(200).json({
            message: `Fest ${fest.isApproved ? 'approved' : 'unapproved'} successfully`,
            fest
        });
    } catch (err) {
        console.error('Error in toggleFestApproval:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get upcoming fests
exports.getUpcomingFests = async (req, res) => {
    try {
        const currentDate = new Date();
        const { limit = 5 } = req.query;

        const fests = await FestOrganizer.find({
            startDate: { $gte: currentDate },
            isApproved: true
        })
            .populate('organizer', 'name email college')
            .sort({ startDate: 1 })
            .limit(parseInt(limit));

        res.status(200).json(fests);
    } catch (err) {
        console.error('Error in getUpcomingFests:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get fest statistics for organizer
exports.getFestStats = async (req, res) => {
    try {
        const organizerId = req.user.userId;

        const stats = await FestOrganizer.aggregate([
            { $match: { organizer: mongoose.Types.ObjectId(organizerId) } },
            {
                $group: {
                    _id: null,
                    totalFests: { $sum: 1 },
                    approvedFests: { $sum: { $cond: ['$isApproved', 1, 0] } },
                    pendingFests: { $sum: { $cond: ['$isApproved', 0, 1] } },
                    totalEvents: { $sum: { $size: '$events' } },
                    totalCompetitions: { $sum: { $size: '$competitions' } }
                }
            }
        ]);

        const result = stats[0] || {
            totalFests: 0,
            approvedFests: 0,
            pendingFests: 0,
            totalEvents: 0,
            totalCompetitions: 0
        };

        res.status(200).json(result);
    } catch (err) {
        console.error('Error in getFestStats:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Create Event for a Fest
exports.createEvent = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { festId } = req.params;
        const {
            name,
            description,
            eventType,
            startTime,
            endTime,
            venue,
            maxParticipants,
            registrationFee,
            requirements,
            speakers,
            coverImage,
            gallery,
            registrationDeadline,
            tags,
            resources
        } = req.body;

        // Validate required fields
        if (!name || !description || !eventType || !startTime || !endTime || !venue) {
            return res.status(400).json({
                error: 'Missing required fields: name, description, eventType, startTime, endTime, venue'
            });
        }

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Check if fest exists and user owns it
        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) {
            return res.status(404).json({ message: 'Fest not found or unauthorized' });
        }

        // Date validation
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (start >= end) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        if (start < fest.startDate || end > fest.endDate) {
            return res.status(400).json({
                error: 'Event times must be within fest duration',
                festStart: fest.startDate,
                festEnd: fest.endDate
            });
        }

        // Create the event
        const newEvent = new Event({
            name,
            description,
            eventType,
            fest: festId,
            organizer: organizerId,
            startTime,
            endTime,
            venue,
            maxParticipants: maxParticipants || 0,
            registrationFee: registrationFee || 0,
            requirements: requirements || [],
            speakers: speakers || [],
            coverImage,
            gallery: gallery || [],
            registrationDeadline,
            tags: tags || [],
            resources: resources || []
        });

        await newEvent.save();

        // Add event to fest's events array
        fest.events.push(newEvent._id);
        await fest.save();

        res.status(201).json({
            message: 'Event created successfully',
            event: newEvent
        });

    } catch (err) {
        console.error('Error in createEvent:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Create Competition for a Fest
exports.createCompetition = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { festId } = req.params;
        const {
            name,
            description,
            competitionType,
            startTime,
            endTime,
            venue,
            maxParticipants,
            minTeamSize,
            maxTeamSize,
            registrationFee,
            prizePool,
            prizes,
            rules,
            requirements,
            judgingCriteria,
            judges,
            coverImage,
            gallery,
            registrationDeadline,
            tags,
            resources,
            submissionGuidelines,
            submissionDeadline,
            submissionFormat
        } = req.body;

        // Validate required fields
        if (!name || !description || !competitionType || !startTime || !endTime || !venue) {
            return res.status(400).json({
                error: 'Missing required fields: name, description, competitionType, startTime, endTime, venue'
            });
        }

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        // Check if fest exists and user owns it
        const fest = await FestOrganizer.findOne({ _id: festId, organizer: organizerId });
        if (!fest) {
            return res.status(404).json({ message: 'Fest not found or unauthorized' });
        }

        // Date validation
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (start >= end) {
            return res.status(400).json({ error: 'End time must be after start time' });
        }

        if (start < fest.startDate || end > fest.endDate) {
            return res.status(400).json({
                error: 'Competition times must be within fest duration',
                festStart: fest.startDate,
                festEnd: fest.endDate
            });
        }

        // Team size validation
        const minSize = minTeamSize || 1;
        const maxSize = maxTeamSize || 1;

        if (minSize > maxSize) {
            return res.status(400).json({ error: 'Maximum team size must be greater than or equal to minimum team size' });
        }

        // Create the competition
        const newCompetition = new Competition({
            name,
            description,
            competitionType,
            fest: festId,
            organizer: organizerId,
            startTime,
            endTime,
            venue,
            maxParticipants: maxParticipants || 0,
            minTeamSize: minSize,
            maxTeamSize: maxSize,
            registrationFee: registrationFee || 0,
            prizePool: prizePool || 0,
            prizes: prizes || [],
            rules: rules || [],
            requirements: requirements || [],
            judgingCriteria: judgingCriteria || [],
            judges: judges || [],
            coverImage,
            gallery: gallery || [],
            registrationDeadline,
            tags: tags || [],
            resources: resources || [],
            submissionGuidelines,
            submissionDeadline,
            submissionFormat
        });

        await newCompetition.save();

        // Add competition to fest's competitions array
        fest.competitions.push(newCompetition._id);
        await fest.save();

        res.status(201).json({
            message: 'Competition created successfully',
            competition: newCompetition
        });

    } catch (err) {
        console.error('Error in createCompetition:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get all events for a fest
exports.getFestEvents = async (req, res) => {
    try {
        const { festId } = req.params;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        const events = await Event.find({ fest: festId })
            .populate('organizer', 'name email')
            .sort({ startTime: 1 });

        res.status(200).json({
            message: 'Events retrieved successfully',
            events
        });

    } catch (err) {
        console.error('Error in getFestEvents:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Get all competitions for a fest
exports.getFestCompetitions = async (req, res) => {
    try {
        const { festId } = req.params;

        // Validate fest ObjectId
        if (!mongoose.Types.ObjectId.isValid(festId)) {
            return res.status(400).json({
                error: 'Invalid fest ID format',
                message: 'The provided fest ID is not a valid MongoDB ObjectId'
            });
        }

        const competitions = await Competition.find({ fest: festId })
            .populate('organizer', 'name email')
            .sort({ startTime: 1 });

        res.status(200).json({
            message: 'Competitions retrieved successfully',
            competitions
        });

    } catch (err) {
        console.error('Error in getFestCompetitions:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Update Event
exports.updateEvent = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { eventId } = req.params;

        // Validate event ObjectId
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                error: 'Invalid event ID format',
                message: 'The provided event ID is not a valid MongoDB ObjectId'
            });
        }

        // Find event and check ownership
        const event = await Event.findOne({ _id: eventId, organizer: organizerId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        // Update event with provided fields
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                event[key] = req.body[key];
            }
        });

        await event.save();

        res.status(200).json({
            message: 'Event updated successfully',
            event
        });

    } catch (err) {
        console.error('Error in updateEvent:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Update Competition
exports.updateCompetition = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { competitionId } = req.params;

        // Validate competition ObjectId
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({
                error: 'Invalid competition ID format',
                message: 'The provided competition ID is not a valid MongoDB ObjectId'
            });
        }

        // Find competition and check ownership
        const competition = await Competition.findOne({ _id: competitionId, organizer: organizerId });
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found or unauthorized' });
        }

        // Update competition with provided fields
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                competition[key] = req.body[key];
            }
        });

        await competition.save();

        res.status(200).json({
            message: 'Competition updated successfully',
            competition
        });

    } catch (err) {
        console.error('Error in updateCompetition:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Delete Event
exports.deleteEvent = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { eventId } = req.params;

        // Validate event ObjectId
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                error: 'Invalid event ID format',
                message: 'The provided event ID is not a valid MongoDB ObjectId'
            });
        }

        // Find event and check ownership
        const event = await Event.findOne({ _id: eventId, organizer: organizerId });
        if (!event) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        // Remove event from fest's events array
        await FestOrganizer.findByIdAndUpdate(
            event.fest,
            { $pull: { events: eventId } }
        );

        // Delete the event
        await Event.findByIdAndDelete(eventId);

        res.status(200).json({
            message: 'Event deleted successfully'
        });

    } catch (err) {
        console.error('Error in deleteEvent:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Delete Competition
exports.deleteCompetition = async (req, res) => {
    try {
        const organizerId = req.user.userId;
        const { competitionId } = req.params;

        // Validate competition ObjectId
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({
                error: 'Invalid competition ID format',
                message: 'The provided competition ID is not a valid MongoDB ObjectId'
            });
        }

        // Find competition and check ownership
        const competition = await Competition.findOne({ _id: competitionId, organizer: organizerId });
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found or unauthorized' });
        }

        // Remove competition from fest's competitions array
        await FestOrganizer.findByIdAndUpdate(
            competition.fest,
            { $pull: { competitions: competitionId } }
        );

        // Delete the competition
        await Competition.findByIdAndDelete(competitionId);

        res.status(200).json({
            message: 'Competition deleted successfully'
        });

    } catch (err) {
        console.error('Error in deleteCompetition:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
