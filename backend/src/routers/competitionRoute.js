const express = require('express');
const multer = require('multer');
const Competition = require('../model/competition_model');
const {
    registerForCompetition,
    getAllRegistrations,
    getRegistrationById,
    updateRegistrationStatus,
    getRegistrationStats
} = require('../controllers/competitionController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, JPG, and GIF files are allowed'), false);
        }
    }
});

// Competition search endpoint
router.get('/search', async (req, res) => {
    try {
        const { query, festType, location, limit = 10 } = req.query;
        
        // Build search criteria
        const searchCriteria = {
            isApproved: true // Only show approved competitions
        };
        
        if (query && query.trim()) {
            const searchRegex = new RegExp(query.trim(), 'i');
            searchCriteria.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { competitionType: searchRegex },
                { subtitle: searchRegex }
            ];
        }
        
        // Find competitions and populate fest data
        const competitions = await Competition.find(searchCriteria)
            .populate('fest', 'festName collegeName venue festType')
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        // Transform data for frontend
        const transformedCompetitions = competitions.map(comp => ({
            _id: comp._id,
            competitionName: comp.name,
            name: comp.name,
            description: comp.description,
            competitionType: comp.competitionType,
            category: comp.competitionType,
            venue: comp.venue,
            location: comp.venue,
            image: comp.coverImage,
            coverImage: comp.coverImage,
            festName: comp.fest?.festName,
            organizingBody: comp.fest?.collegeName,
            collegeName: comp.fest?.collegeName,
            competitionDate: comp.dateTime,
            startDate: comp.createdAt,
            endDate: comp.createdAt
        }));
        
        res.json(transformedCompetitions);
    } catch (error) {
        console.error('Competition search error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to search competitions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Competition registration routes
router.post('/register', upload.single('paymentScreenshot'), registerForCompetition);

// Admin routes for managing registrations
router.get('/registrations', getAllRegistrations);
router.get('/registrations/stats', getRegistrationStats);
router.get('/registrations/:registrationId', getRegistrationById);
router.put('/registrations/:registrationId/status', updateRegistrationStatus);

module.exports = router;