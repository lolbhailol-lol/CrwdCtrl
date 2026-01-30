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
        
        // ✅ CRITICAL FIX: Ensure fest registration data is always complete
        if (competitionData.fest && competitionData.fest.registration) {
            // Make sure fest registration has all required fields with proper defaults
            competitionData.fest.registration = {
                mode: competitionData.fest.registration.mode || 'NOT_STARTED',
                externalLink: competitionData.fest.registration.externalLink || '',
                paymentQR: competitionData.fest.registration.paymentQR || '',
                paymentQRMessage: competitionData.fest.registration.paymentQRMessage || '',
                googleSheetsUrl: competitionData.fest.registration.googleSheetsUrl || '',
                formInstructions: competitionData.fest.registration.formInstructions || '',
                organizerEmail: competitionData.fest.registration.organizerEmail || '',
                formSchema: competitionData.fest.registration.formSchema || []
            };
        } else if (competitionData.fest) {
            // If fest exists but registration is missing, create default registration object
            console.warn(`⚠️ Fest ${competitionData.fest._id} missing registration data, creating defaults`);
            competitionData.fest.registration = {
                mode: 'NOT_STARTED',
                externalLink: '',
                paymentQR: '',
                paymentQRMessage: '',
                googleSheetsUrl: '',
                formInstructions: '',
                organizerEmail: '',
                formSchema: []
            };
        }
        
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
                formType: competitionData.registration.formType || 'SINGLE_STEP',
                steps: competitionData.registration.steps || [],
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

        console.log('🔍 Competition API Response:', {
            competitionId: competitionData._id,
            festId: competitionData.fest?._id,
            festRegistrationMode: competitionData.fest?.registration?.mode,
            registrationType: competitionData.registrationType
        });

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
        const mongoose = require('mongoose');
        
        console.log(`🔍 DEBUG: Checking fest with ID: ${id}`);
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.json({ 
                error: 'Invalid ObjectId format', 
                id,
                message: 'The provided ID is not a valid MongoDB ObjectId format'
            });
        }
        
        const FestOrganizer = require('../model/fest_organizer_model');
        const fest = await FestOrganizer.findById(id);
        
        if (fest) {
            res.json({
                exists: true,
                isApproved: fest.isApproved,
                festName: fest.festName,
                collegeName: fest.collegeName,
                festType: fest.festType,
                id: fest._id,
                hasCompetitions: fest.competitions?.length || 0,
                hasGalleryImages: fest.galleryImages?.length || 0,
                createdAt: fest.createdAt,
                status: 'Fest found in database'
            });
        } else {
            res.json({
                exists: false,
                id,
                status: 'Fest NOT found in database'
            });
        }
    } catch (err) {
        res.json({ error: err.message, status: 'Database error' });
    }
});

module.exports = router;