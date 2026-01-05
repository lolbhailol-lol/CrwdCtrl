const express = require('express');
const router = express.Router();
const festOrganizerController = require('../controllers/festOrganizerController');

// ✅ Public routes (no authentication required)

// ✅ Get all public fests with pagination and filtering
router.get('/all', festOrganizerController.getAllFests);

// ✅ Search fests
router.get('/search', festOrganizerController.searchFests);

// ✅ Get upcoming fests
router.get('/upcoming', festOrganizerController.getUpcomingFests);

// ✅ Get single fest details (public view)
router.get('/:id/public', festOrganizerController.getFestById);

// ✅ Get single competition details (public view)
router.get('/competitions/:competitionId/public', async (req, res) => {
    try {
        const { competitionId } = req.params;

        // Validate ObjectId
        if (!require('mongoose').Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({
                error: 'Invalid competition ID format',
                message: 'The provided ID is not a valid MongoDB ObjectId'
            });
        }

        const Competition = require('../model/competition_model');
        const competition = await Competition.findById(competitionId)
            .populate({
                path: 'fest',
                select: 'festName collegeName isApproved registration',
                options: { strictPopulate: false }
            });

        if (!competition) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        // Only return competitions from approved fests
        if (!competition.fest?.isApproved) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        // Ensure competition has proper registration configuration
        const competitionData = competition.toObject();
        
        // Handle new registration system vs legacy
        if (!competitionData.registrationType) {
            // Legacy competition - set default values
            competitionData.registrationType = 'fest';
            competitionData.registration = competitionData.registration || { status: 'not_started' };
            competitionData.legacyRegistration = { status: 'STARTED' }; // For backward compatibility
        }
        
        // Ensure registration object has proper structure
        if (competitionData.registrationType === 'custom' && competitionData.registration) {
            // Make sure custom registration has all required fields
            competitionData.registration = {
                status: competitionData.registration.status || 'not_started',
                externalUrl: competitionData.registration.externalUrl || '',
                googleSheetsUrl: competitionData.registration.googleSheetsUrl || '',
                formSchema: competitionData.registration.formSchema || [],
                qrCode: competitionData.registration.qrCode || '',
                qrCodeMessage: competitionData.registration.qrCodeMessage || '',
                confirmationEmail: competitionData.registration.confirmationEmail || '',
                settings: competitionData.registration.settings || {
                    allowMultipleRegistrations: true,
                    requireEmailVerification: false,
                    autoConfirmation: true,
                    maxRegistrations: null,
                    registrationDeadline: null
                }
            };
        }


        res.status(200).json(competitionData);
    } catch (err) {
        console.error('Error in public competition fetch:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Debug route to check if fest exists
router.get('/:id/debug', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!require('mongoose').Types.ObjectId.isValid(id)) {
            return res.json({ error: 'Invalid ObjectId format', id });
        }
        
        const FestOrganizer = require('../model/fest_organizer_model');
        const fest = await FestOrganizer.findById(id);
        
        res.json({
            exists: !!fest,
            isApproved: fest?.isApproved,
            festName: fest?.festName,
            id: fest?._id,
            allFields: fest ? Object.keys(fest.toObject()) : []
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

module.exports = router;