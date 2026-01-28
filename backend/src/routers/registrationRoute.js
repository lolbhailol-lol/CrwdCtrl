const express = require('express');
const router = express.Router();

const {
  submitRegistration,
  submitCompetitionRegistration,
  submitCustomCompetitionRegistration,
  getUserRegistration,
  getFestRegistrations,
  updateRegistrationStatus,
  getUserRegistrations,
  getRegistrationDetails,
  testGoogleSheets,
  diagnoseGoogleSheets, // ✅ NEW: Import the diagnostic function
  upload
} = require('../controllers/registrationController');

const { authenticateToken } = require('../middleware/authmiddleware');
const authenticateAdmin = require('../middleware/adminAuth');

/* ======================
   USER ROUTES
====================== */

// Fest registration (dynamic form + files)
router.post(
  '/fests/:festId/register',
  authenticateToken,
  upload.any(),
  (req, res, next) => {
    console.log('🎯 FEST REGISTRATION ENDPOINT HIT:', req.params.festId);
    console.log('🔍 Request body keys:', Object.keys(req.body));
    console.log('💳 Payment receipt in body:', req.body.paymentReceiptUrl);
    next();
  },
  submitRegistration
);

// Competition registration (FIXED)
router.post(
  '/competitions/:competitionId/register',
  authenticateToken,
  upload.any(),
  submitCompetitionRegistration
);

// Custom competition registration (new system)
router.post(
  '/competitions/:competitionId/custom',
  authenticateToken,
  submitCustomCompetitionRegistration
);

// File upload for registrations
router.post('/upload', authenticateToken, upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { uploadToCloudinary } = require('../services/cloudinaryService');
    const urls = [];

    for (const file of req.files) {
      const result = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        'competition-registration',
        `temp_${Date.now()}`,
        req.user.userId,
        file.fieldname
      );
      
      console.log('📤 Cloudinary upload result:', result);
      
      if (result.success) {
        urls.push({ url: result.cloudinaryLink, fieldName: file.fieldname });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    }

    res.json({ success: true, urls });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

router.get('/fests/:festId/registration', authenticateToken, getUserRegistration);
router.get('/my-registrations', authenticateToken, getUserRegistrations);
router.get('/details/:registrationId', authenticateToken, getRegistrationDetails);

/* ======================
   ADMIN ROUTES
====================== */

router.get('/admin/fests/:festId/registrations', authenticateAdmin, getFestRegistrations);
router.put('/admin/registrations/:registrationId/status', authenticateAdmin, updateRegistrationStatus);
router.post('/admin/test-google-sheets', authenticateAdmin, testGoogleSheets);
// ✅ NEW: Diagnostic endpoint for Google Sheets integration
router.get('/admin/fests/:festId/diagnose-google-sheets', authenticateAdmin, diagnoseGoogleSheets);

/* ======================
   DEBUG (OPTIONAL)
====================== */

router.get('/admin/debug/registration/:registrationId', authenticateAdmin, async (req, res) => {
  try {
    const Registration = require('../model/registration_model');
    const registration = await Registration.findById(req.params.registrationId);

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      id: registration._id,
      responses: registration.responses,
      responseKeys: Object.keys(registration.responses),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for user registrations
router.get('/debug/user-registrations', authenticateToken, async (req, res) => {
  try {
    const Registration = require('../model/registration_model');
    const userId = req.user.userId;

    const registrations = await Registration.find({ user: userId })
      .populate('fest')
      .populate('competitionId');

    const debugData = registrations.map(reg => ({
      _id: reg._id,
      hasCompetitionId: !!reg.competitionId,
      competitionId: reg.competitionId?._id,
      competitionName: reg.competitionId?.name,
      festName: reg.fest?.festName,
      rawCompetitionData: reg.competitionId,
      rawFestData: {
        _id: reg.fest?._id,
        festName: reg.fest?.festName,
        coverImage: reg.fest?.coverImage
      }
    }));

    res.json({
      userId,
      totalRegistrations: registrations.length,
      debugData
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
