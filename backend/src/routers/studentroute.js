const express = require('express');
const {
    createOrUpdateStudent,
    getStudentProfile,
    getRegisteredFests,
    getRegisteredEvents,
    getRegisteredCompetitions,
} = require('../controllers/studentController');
const { authenticateToken, authorizeRoles } = require('../middleware/authmiddleware');

const router = express.Router();

// All student routes require authentication and student role
router.use(authenticateToken);
router.use(authorizeRoles('student'));

// Student profile routes
router.post('/profile', createOrUpdateStudent); // Create or update student profile
router.put('/profile', createOrUpdateStudent); // Same function handles both create and update
router.get('/profile', getStudentProfile); // Get current student profile

// Student fest registration routes
router.get('/registered-fests', getRegisteredFests); // Get all registered fests
router.get('/registered-events', getRegisteredEvents); // Get all registered events
router.get('/registered-competitions', getRegisteredCompetitions); // Get all registered competitions

module.exports = router;