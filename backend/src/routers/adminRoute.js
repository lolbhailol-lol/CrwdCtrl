const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const devOnly = require('../middleware/devOnly');
const { adminAuthLimiter } = require('../middleware/rateLimiter');
const adminFestCtrl = require('../controllers/adminFestController');
const adminAuthCtrl = require('../controllers/adminAuthController');
const adminSectionCtrl = require('../controllers/adminSectionController');
const homepageSectionCtrl = require('../controllers/homepageSectionController');
const uploadCtrl = require('../controllers/uploadController');
const { parseTicketPrice } = require('../utils/platformFee');

const getCompetitionBaseFee = (registrationFee, feeAmount) => {
  const numericFeeAmount = parseTicketPrice(feeAmount);
  return numericFeeAmount || parseTicketPrice(registrationFee);
};

// ===== ADMIN HEALTH CHECK (public liveness only — no config leakage) =====
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is operational',
    timestamp: new Date().toISOString(),
  });
});

// Dev-only admin config diagnostics (never expose hash details publicly)
router.get('/health/config', devOnly, adminAuth, (req, res) => {
  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  res.json({
    success: true,
    adminConfig: {
      emailSet: Boolean(process.env.ADMIN_EMAIL?.trim()),
      hashConfigured: hash.length > 0,
      hashLooksValid: /^\$2[aby]\$\d{2}\$.{53}$/.test(hash),
    },
  });
});

// ===== CLEAR ALL CACHES (call after admin saves) =====
router.post('/clear-cache', adminAuth, (req, res) => {
  try {
    const { clearAllCaches } = require('../controllers/festOrganizerController');
    clearAllCaches();
    console.log('🗑️ Admin triggered cache clear');
    res.json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear cache' });
  }
});

// ===== ADMIN LOGIN =====
router.post('/login', adminAuthLimiter, adminAuthCtrl.adminLogin);

// ===== REFRESH TOKEN ENDPOINT =====
router.post('/refresh-token', adminAuthLimiter, adminAuthCtrl.refreshAdminToken);

// ===== VERIFY SESSION (for admin SPA) =====
router.get('/verify', adminAuth, (req, res) => {
  res.json({
    success: true,
    admin: { email: req.user.email, role: req.user.role },
  });
});

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

// ===== FEST PRIORITY MANAGEMENT (must come BEFORE generic :id routes) =====
router.put('/fests/:id/priority', adminAuth, adminFestCtrl.updateFestPriority);
router.post('/fests/reorder', adminAuth, adminFestCtrl.reorderFests);
router.post('/sections/reorder', adminAuth, adminSectionCtrl.batchReorder);

// ===== CUSTOM HOMEPAGE SECTIONS =====
router.get('/homepage-sections', adminAuth, homepageSectionCtrl.listAdmin);
router.post('/homepage-sections', adminAuth, homepageSectionCtrl.create);
router.put('/homepage-sections/:id', adminAuth, homepageSectionCtrl.update);
router.delete('/homepage-sections/:id', adminAuth, homepageSectionCtrl.remove);
router.post('/homepage-sections/reorder', adminAuth, homepageSectionCtrl.reorder);

// ===== FEST CRUD =====
router.post('/fests/broadcast-announcement', adminAuth, adminFestCtrl.triggerEventAnnouncement);
router.post('/fests', adminAuth, adminFestCtrl.createFest);
router.get('/fests', adminAuth, adminFestCtrl.getAllFests);
const {
  getAdminScannerAccess,
  setAdminScannerAccess,
} = require('../controllers/scannerAccessController');

router.get('/fests/:festId/scanner-access', adminAuth, getAdminScannerAccess);
router.put('/fests/:festId/scanner-access', adminAuth, setAdminScannerAccess);

// Generic ID routes at the bottom of the section
router.put('/fests/:id', (req, res, next) => {
  console.log('🟡 Generic PUT route matched! ID:', req.params.id);
  next();
}, adminAuth, adminFestCtrl.updateFest);

router.delete('/fests/:id', adminAuth, adminFestCtrl.deleteFest);
// ===== COMPETITION (ONLY CREATE FOR NOW) =====
router.post(
  '/fests/:festId/competitions',
  adminAuth,
  adminFestCtrl.createCompetition
);

// ===== LIST ALL COMPETITIONS =====
router.get('/competitions', adminAuth, async (req, res) => {
  try {
    const Competition = require('../model/competition_model');
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const competitions = await Competition.find()
      .populate('fest', 'festName collegeName festType')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ competitions });
  } catch (error) {
    console.error('Admin - list competitions error:', error);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

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
  devOnly,
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
  devOnly,
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
        feeAmount: getCompetitionBaseFee(req.body.registrationFee, req.body.feeAmount),
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

        // ✅ Clear caches after competition update
        try {
          const { clearAllCaches } = require('../controllers/festOrganizerController');
          clearAllCaches();
          console.log('✅ Cleared all caches after competition update');
        } catch (cacheError) {
          console.warn('⚠️ Could not clear caches:', cacheError.message);
        }

        res.json({
          message: 'Competition updated successfully',
          competition: finalCompetition
        });
      } else {
        // ✅ Clear caches after competition update
        try {
          const { clearAllCaches } = require('../controllers/festOrganizerController');
          clearAllCaches();
          console.log('✅ Cleared all caches after competition update');
        } catch (cacheError) {
          console.warn('⚠️ Could not clear caches:', cacheError.message);
        }

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

      // ✅ Clear caches after competition deletion
      try {
        const { clearAllCaches } = require('../controllers/festOrganizerController');
        clearAllCaches();
        console.log('✅ Cleared all caches after competition deletion');
      } catch (cacheError) {
        console.warn('⚠️ Could not clear caches:', cacheError.message);
      }

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

// ===== TEST REGISTRATION WITH PAYMENT RECEIPT =====
router.post('/test-registration-payment', devOnly, adminAuth, async (req, res) => {
  try {
    const { googleSheetsUrl, festId } = req.body;

    if (!googleSheetsUrl) {
      return res.status(400).json({ error: 'Google Sheets URL is required' });
    }

    // Simulate a registration with payment receipt
    const mockResponses = {
      'name': 'Test User With Receipt',
      'email': 'test-receipt@example.com',
      'phone': '9876543210',
      'Payment Receipt': 'https://res.cloudinary.com/dyonimhgb/image/upload/v1234567890/test-payment-receipt.jpg'
    };

    const mockFestData = {
      festName: 'Test Fest',
      festId: festId || 'test-fest-id'
    };

    const mockUserData = {
      name: 'Test User With Receipt',
      email: 'test-receipt@example.com'
    };

    console.log('🧪 Testing registration with payment receipt...');
    console.log('📊 Mock responses:', mockResponses);
    console.log('💳 Payment Receipt in responses:', mockResponses['Payment Receipt']);

    const { appendToGoogleSheets } = require('../services/googleSheetsService');
    const result = await appendToGoogleSheets(googleSheetsUrl, mockResponses, mockFestData, mockUserData);

    res.json({
      success: true,
      message: 'Test registration with payment receipt completed',
      mockData: {
        responses: mockResponses,
        hasPaymentReceipt: !!mockResponses['Payment Receipt']
      },
      result: result
    });

  } catch (error) {
    console.error('Test registration with payment receipt error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== DEBUG FEST PAYMENT QR ENDPOINT =====
router.get('/debug-fest-payment/:festId', devOnly, adminAuth, async (req, res) => {
  try {
    const { festId } = req.params;
    const FestOrganizer = require('../model/fest_organizer_model');

    const fest = await FestOrganizer.findById(festId);

    if (!fest) {
      return res.status(404).json({ error: 'Fest not found' });
    }

    res.json({
      festId: fest._id,
      festName: fest.festName,
      hasRegistration: !!fest.registration,
      hasPaymentQR: !!fest.registration?.paymentQR,
      paymentQR: fest.registration?.paymentQR,
      registrationConfig: fest.registration,
      formType: fest.registration?.formType,
      hasFormSchema: !!fest.registration?.formSchema,
      hasSteps: !!fest.registration?.steps,
      stepsCount: fest.registration?.steps?.length || 0
    });

  } catch (error) {
    console.error('Debug fest payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== DEBUG PAYMENT RECEIPT ENDPOINT =====
router.post('/debug-payment-receipt', devOnly, adminAuth, async (req, res) => {
  try {
    console.log('🔍 Debug payment receipt request:');
    console.log('📋 Request body:', req.body);
    console.log('📁 Request files:', req.files);
    console.log('🔑 Body keys:', Object.keys(req.body));
    console.log('💳 Payment receipt URL:', req.body.paymentReceiptUrl);

    // Test Google Sheets integration with payment receipt
    if (req.body.googleSheetsUrl && req.body.paymentReceiptUrl) {
      const { appendToGoogleSheets } = require('../services/googleSheetsService');

      const testResponses = {
        'Payment Receipt': req.body.paymentReceiptUrl,
        'name': 'Debug Test User',
        'email': 'debug@test.com'
      };

      const festData = {
        festName: 'Debug Test Fest',
        festId: 'debug123'
      };

      const userData = {
        name: 'Debug Test User',
        email: 'debug@test.com'
      };

      console.log('🧪 Testing Google Sheets with payment receipt...');
      const result = await appendToGoogleSheets(req.body.googleSheetsUrl, testResponses, festData, userData);

      res.json({
        success: true,
        debug: {
          bodyKeys: Object.keys(req.body),
          hasPaymentReceipt: !!req.body.paymentReceiptUrl,
          paymentReceiptUrl: req.body.paymentReceiptUrl
        },
        googleSheetsResult: result
      });
    } else {
      res.json({
        success: true,
        debug: {
          bodyKeys: Object.keys(req.body),
          hasPaymentReceipt: !!req.body.paymentReceiptUrl,
          paymentReceiptUrl: req.body.paymentReceiptUrl,
          message: 'Provide googleSheetsUrl and paymentReceiptUrl to test Google Sheets integration'
        }
      });
    }

  } catch (error) {
    console.error('Debug payment receipt error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== DIRECT GOOGLE SHEETS TEST WITH PAYMENT RECEIPT =====
router.post('/test-google-sheets-direct', devOnly, adminAuth, async (req, res) => {
  try {
    const { googleSheetsUrl } = req.body;

    if (!googleSheetsUrl) {
      return res.status(400).json({ error: 'Google Sheets URL is required' });
    }

    const { google } = require('googleapis');

    // Extract spreadsheet ID from URL
    const extractSpreadsheetId = (url) => {
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    };

    const getGoogleAuth = async () => {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: 'keen-incline-483004-g5',
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      return auth;
    };

    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL format');
    }

    // Initialize Google Sheets API
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet metadata
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetName = firstSheet.properties.title;

    // Create headers with payment receipt
    const headers = ['Timestamp', 'User Name', 'User Email', 'Name', 'Email', 'Phone', 'Payment Receipt'];

    // Update headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!1:1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headers],
      },
    });

    // Prepare test row data with payment receipt
    const rowData = [
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      'Direct Test User',
      'direct@test.com',
      'Direct Test User',
      'direct@test.com',
      '9876543210',
      '=HYPERLINK("https://res.cloudinary.com/dyonimhgb/image/upload/v1234567890/test-receipt.jpg","🔗 View Receipt")'
    ];

    // Append the test row
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED', // This processes formulas
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData],
      },
    });

    res.json({
      success: true,
      message: 'Direct Google Sheets test with payment receipt completed',
      updatedRange: appendResponse.data.updates.updatedRange,
      rowsAdded: appendResponse.data.updates.updatedRows
    });

  } catch (error) {
    console.error('Direct Google Sheets test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== TEST GOOGLE SHEETS INTEGRATION =====
router.post('/test-google-sheets', devOnly, adminAuth, async (req, res) => {
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
      phone: '1234567890',
      'Payment Receipt': 'https://res.cloudinary.com/dyonimhgb/image/upload/v1234567890/test-receipt.jpg'
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
