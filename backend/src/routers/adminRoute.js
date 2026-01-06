const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const adminFestCtrl = require('../controllers/adminFestController');
const adminAuthCtrl = require('../controllers/adminAuthController');
const uploadCtrl = require('../controllers/uploadController');

// ===== ADMIN LOGIN =====
router.post('/login', adminAuthCtrl.adminLogin);

// ===== DASHBOARD =====
router.get('/stats', adminAuth, async (req, res) => {
  const User = require('../model/usermodel');
  const Fest = require('../model/fest_organizer_model');
  const Competition = require('../model/competition_model');

  try {
    res.json({
      totalUsers: await User.countDocuments(),
      totalFests: await Fest.countDocuments(),
      totalCompetitions: await Competition.countDocuments(),
      ongoingFests: await Fest.countDocuments({ status: 'ongoing' }),
      upcomingFests: await Fest.countDocuments({ status: 'upcoming' }),
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ===== FEST CRUD =====
router.post('/fests', adminAuth, adminFestCtrl.createFest);
router.get('/fests', adminAuth, adminFestCtrl.getAllFests);
router.put('/fests/:id', adminAuth, adminFestCtrl.updateFest);
router.delete('/fests/:id', adminAuth, adminFestCtrl.deleteFest);

// ===== COMPETITION (ONLY CREATE FOR NOW) =====
router.post(
  '/fests/:festId/competitions',
  adminAuth,
  adminFestCtrl.createCompetition
);

// ===== GET COMPETITIONS FOR A FEST =====
router.get(
  '/fests/:festId/competitions',
  adminAuth,
  async (req, res) => {
    try {
      const { festId } = req.params;
      
      const Competition = require('../model/competition_model');
      const competitions = await Competition.find({ fest: festId });
      
      res.json({
        competitions
      });
    } catch (error) {
      console.error('Admin - Error fetching competitions:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }
  }
);

// ===== TEST ENDPOINT - GET COMPETITION WITH MESSAGE FIELDS =====
router.get(
  '/competitions/:competitionId/test',
  adminAuth,
  async (req, res) => {
    try {
      const { competitionId } = req.params;
      const Competition = require('../model/competition_model');
      
      const competition = await Competition.findById(competitionId);
      
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      res.json({
        id: competition._id,
        name: competition.name,
        commonRulesMessage: competition.commonRulesMessage,
        hasCommonRulesMessage: !!competition.commonRulesMessage,
        rounds: competition.rounds.map(r => ({
          title: r.title,
          roundRulesMessage: r.roundRulesMessage,
          hasRoundRulesMessage: !!r.roundRulesMessage
        }))
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ error: 'Test failed' });
    }
  }
);

// ===== TEST QR CODE ENDPOINT =====
router.get(
  '/competitions/:competitionId/qr-test',
  adminAuth,
  async (req, res) => {
    try {
      const { competitionId } = req.params;
      const Competition = require('../model/competition_model');
      
      const competition = await Competition.findById(competitionId);
      
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      res.json({
        id: competition._id,
        name: competition.name,
        registrationType: competition.registrationType,
        registration: competition.registration,
        qrCode: competition.registration?.qrCode,
        qrCodeMessage: competition.registration?.qrCodeMessage,
        hasQrCode: !!competition.registration?.qrCode,
        rawRegistration: JSON.stringify(competition.registration, null, 2)
      });
    } catch (error) {
      console.error('QR Test error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ===== UPDATE COMPETITION =====
router.put(
  '/competitions/:competitionId',
  adminAuth,
  async (req, res) => {
    try {
      const { competitionId } = req.params;
      
      console.log('Backend - Update competition request body:', JSON.stringify(req.body, null, 2));
      console.log('Backend - commonRulesMessage in update:', req.body.commonRulesMessage);
      console.log('Backend - rounds in update:', req.body.rounds);
      console.log('Backend - registration data in update:', req.body.registration);
      console.log('Backend - QR code in registration:', req.body.registration?.qrCode);
      console.log('Backend - QR code message in registration:', req.body.registration?.qrCodeMessage);
      
      const Competition = require('../model/competition_model');
      
      // First, let's try to find the competition and log its current state
      const existingCompetition = await Competition.findById(competitionId);
      console.log('Backend - Existing competition before update:', {
        id: existingCompetition?._id,
        commonRulesMessage: existingCompetition?.commonRulesMessage,
        hasCommonRulesMessage: existingCompetition?.hasOwnProperty('commonRulesMessage'),
        rounds: existingCompetition?.rounds?.map(r => ({
          title: r.title,
          roundRulesMessage: r.roundRulesMessage,
          hasRoundRulesMessage: r.hasOwnProperty('roundRulesMessage')
        }))
      });
      
      if (!existingCompetition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      // STEP 1: First, let's try to add the fields using direct assignment and save
      existingCompetition.set('commonRulesMessage', req.body.commonRulesMessage || '');
      
      // Process registration data explicitly with deep merge
      if (req.body.registration) {
        console.log('Backend - Processing registration data:', req.body.registration);
        
        // Get existing registration or create new one
        const existingRegistration = existingCompetition.registration || {};
        
        // Handle legacy status migration
        let registrationStatus = req.body.registration.status || existingRegistration.status;
        
        // Migrate old status values to new enum values
        if (registrationStatus === 'STARTED') {
          registrationStatus = 'internal_form'; // or 'external_link' based on your preference
        } else if (registrationStatus === 'CLOSED') {
          registrationStatus = 'registration_closed';
        } else if (registrationStatus === 'NOT_STARTED') {
          registrationStatus = 'not_started';
        }
        
        console.log('Backend - Migrated registration status from', req.body.registration.status, 'to', registrationStatus);
        
        // Deep merge the registration data with migrated status
        const updatedRegistration = {
          ...existingRegistration,
          ...req.body.registration,
          status: registrationStatus
        };
        
        console.log('Backend - Merged registration data:', updatedRegistration);
        
        existingCompetition.registration = updatedRegistration;
        existingCompetition.markModified('registration');
      }
      
      // Process rounds with explicit field setting
      if (req.body.rounds && Array.isArray(req.body.rounds)) {
        const processedRounds = req.body.rounds.map(round => {
          console.log('Backend - Processing round for direct assignment:', {
            title: round.title,
            roundRulesMessage: round.roundRulesMessage,
            hasRoundRulesMessage: !!round.roundRulesMessage
          });
          
          const roundObj = {
            roundNumber: round.roundNumber || 1,
            title: round.title || '',
            description: round.description || '',
            rules: round.rules || [],
            dateTime: round.dateTime || '',
            venue: round.venue || ''
          };
          
          // Explicitly set the roundRulesMessage
          roundObj.roundRulesMessage = round.roundRulesMessage || '';
          
          return roundObj;
        });
        
        existingCompetition.set('rounds', processedRounds);
      }
      
      // Update other fields including new registration system
      const updateFields = {
        ...req.body,
        registrationType: req.body.registrationType || 'fest',
        registration: req.body.registration || { 
          status: 'not_started',
          externalUrl: '',
          googleSheetsUrl: '',
          formSchema: [],
          settings: {
            allowMultipleRegistrations: true,
            requireEmailVerification: false,
            autoConfirmation: true,
            maxRegistrations: null,
            registrationDeadline: null
          }
        },
        legacyRegistration: req.body.legacyRegistration || { status: 'NOT_STARTED' }
      };
      
      Object.keys(updateFields).forEach(key => {
        if (key !== 'rounds' && key !== 'commonRulesMessage' && key !== 'registration') {
          existingCompetition.set(key, updateFields[key]);
        }
      });
      
      console.log('Backend - Competition before save with direct assignment:', {
        commonRulesMessage: existingCompetition.get('commonRulesMessage'),
        registration: existingCompetition.get('registration'),
        qrCode: existingCompetition.get('registration')?.qrCode,
        rounds: existingCompetition.get('rounds')?.map(r => ({
          title: r.title,
          roundRulesMessage: r.roundRulesMessage,
          hasRoundRulesMessage: !!r.roundRulesMessage
        }))
      });
      
      // Mark the fields as modified to ensure they're saved
      existingCompetition.markModified('commonRulesMessage');
      existingCompetition.markModified('rounds');
      
      // Add validation debugging
      console.log('Backend - About to save competition with registration:', {
        registrationType: existingCompetition.registrationType,
        registrationStatus: existingCompetition.registration?.status,
        hasExternalUrl: !!existingCompetition.registration?.externalUrl,
        hasGoogleSheetsUrl: !!existingCompetition.registration?.googleSheetsUrl,
        formSchemaLength: existingCompetition.registration?.formSchema?.length || 0
      });
      
      // Validate before saving
      const validationError = existingCompetition.validateSync();
      if (validationError) {
        console.error('Backend - Validation error:', validationError);
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationError.message,
          validationErrors: validationError.errors 
        });
      }
      
      // Save the competition
      const savedCompetition = await existingCompetition.save();
      
      
      // STEP 2: If direct assignment didn't work, try raw MongoDB update
      if ((!savedCompetition.commonRulesMessage && req.body.commonRulesMessage) || 
          (!savedCompetition.registration?.qrCode && req.body.registration?.qrCode)) {
        console.log('Backend - Direct assignment failed, trying raw MongoDB update...');
        
        const updateDoc = {};
        
        if (req.body.commonRulesMessage) {
          updateDoc.commonRulesMessage = req.body.commonRulesMessage;
        }
        
        if (req.body.registration) {
          updateDoc.registration = req.body.registration;
        }
        
        if (req.body.rounds?.[0]?.roundRulesMessage) {
          updateDoc['rounds.0.roundRulesMessage'] = req.body.rounds[0].roundRulesMessage;
        }
        
        console.log('Backend - Raw update document:', updateDoc);
        
        const rawUpdateResult = await Competition.collection.updateOne(
          { _id: existingCompetition._id },
          { $set: updateDoc }
        );
        
        
        // Fetch the competition again to verify
        const finalCompetition = await Competition.findById(competitionId);
        
        res.json({
          message: 'Competition updated successfully',
          competition: finalCompetition
        });
      } else {
        res.json({
          message: 'Competition updated successfully',
          competition: savedCompetition
        });
      }
      
    } catch (error) {
      console.error('Admin - Error updating competition:', error);
      
      // Check if it's a validation error
      if (error.name === 'ValidationError') {
        console.error('Backend - Mongoose validation error details:', error.errors);
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: error.message,
          validationErrors: Object.keys(error.errors).map(key => ({
            field: key,
            message: error.errors[key].message,
            value: error.errors[key].value
          }))
        });
      }
      
      res.status(500).json({ error: 'Failed to update competition', details: error.message });
    }
  }
);

// ===== DELETE COMPETITION =====
router.delete(
  '/competitions/:competitionId',
  adminAuth,
  async (req, res) => {
    try {
      const { competitionId } = req.params;
      
      const Competition = require('../model/competition_model');
      const competition = await Competition.findById(competitionId);
      
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      // Remove competition from fest's competitions array
      const FestOrganizer = require('../model/fest_organizer_model');
      await FestOrganizer.findByIdAndUpdate(
        competition.fest,
        { $pull: { competitions: competitionId } }
      );
      
      // Delete the competition
      await Competition.findByIdAndDelete(competitionId);
      
      res.json({
        message: 'Competition deleted successfully'
      });
    } catch (error) {
      console.error('Admin - Error deleting competition:', error);
      res.status(500).json({ error: 'Failed to delete competition' });
    }
  }
);

// ===== IMAGE UPLOAD =====
router.post(
  '/upload/image',
  adminAuth,
  uploadCtrl.uploadSingle,
  uploadCtrl.uploadImage
);

router.post(
  '/upload/images',
  adminAuth,
  uploadCtrl.uploadMultiple,
  uploadCtrl.uploadMultipleImages
);

// ===== TEST GOOGLE SHEETS INTEGRATION =====
router.post('/test-google-sheets', adminAuth, async (req, res) => {
  try {
    const { googleSheetsUrl } = req.body;
    
    if (!googleSheetsUrl) {
      return res.status(400).json({ error: 'Google Sheets URL is required' });
    }
    
    const { appendToGoogleSheets } = require('../services/googleSheetsService');
    
    // Test data
    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890'
    };
    
    const festData = {
      festName: 'Test Fest',
      collegeName: 'Test College'
    };
    
    const userData = {
      name: 'Test User',
      email: 'test@example.com'
    };
    
    const result = await appendToGoogleSheets(googleSheetsUrl, testData, festData, userData);
    
    res.json({
      success: true,
      result,
      message: 'Google Sheets integration test completed'
    });
    
  } catch (error) {
    console.error('Google Sheets test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== GET GOOGLE APPS SCRIPT TEMPLATE =====
router.get('/google-script-template', adminAuth, (req, res) => {
  const { getGoogleAppsScriptTemplate } = require('../services/googleSheetsService');
  
  res.json({
    template: getGoogleAppsScriptTemplate(),
    instructions: [
      '1. Create a new Google Sheet',
      '2. Go to Extensions → Apps Script',
      '3. Replace the default code with the template above',
      '4. Save the project (Ctrl+S)',
      '5. Click Deploy → New Deployment',
      '6. Choose type: Web app',
      '7. Execute as: Me',
      '8. Who has access: Anyone',
      '9. Click Deploy and authorize permissions',
      '10. Copy the Web app URL and use it in the fest form'
    ]
  });
});

module.exports = router;
