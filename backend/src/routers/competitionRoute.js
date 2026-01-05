const express = require('express');
const multer = require('multer');
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

// Competition registration routes
router.post('/register', upload.single('paymentScreenshot'), registerForCompetition);

// Admin routes for managing registrations
router.get('/registrations', getAllRegistrations);
router.get('/registrations/stats', getRegistrationStats);
router.get('/registrations/:registrationId', getRegistrationById);
router.put('/registrations/:registrationId/status', updateRegistrationStatus);

module.exports = router;