const express = require('express');
const {
    register,
    login,
    socialAuth,
    getUserProfile,
    updateUserProfile,
    checkEmailExists,
    validateToken,
} = require('../controllers/usercontroller');
const { authenticateToken, authorizeRoles } = require('../middleware/authmiddleware');
const uploadCtrl = require('../controllers/uploadController');

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/social-auth', socialAuth);
router.post('/check-email', checkEmailExists);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', authenticateToken, updateUserProfile);

// ✅ NEW: Token validation endpoint
router.get('/validate', authenticateToken, validateToken);

// Debug route to check authentication status
router.get('/auth-status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    userId: req.user.userId,
    timestamp: new Date().toISOString()
  });
});

// ===== FILE UPLOAD =====
router.post(
  '/upload/file',
  authenticateToken,
  uploadCtrl.uploadFileMiddleware,
  uploadCtrl.multerErrorHandler, // Add multer error handler
  uploadCtrl.uploadFile
);

// ===== IMAGE UPLOAD (for payment receipts, etc.) =====
router.post(
  '/upload/image',
  (req, res, next) => {
    console.log('🎯 UPLOAD/IMAGE ROUTE HIT');
    console.log('📋 Method:', req.method);
    console.log('📋 Path:', req.path);
    console.log('📋 Content-Type:', req.get('content-type'));
    console.log('📋 Auth Header:', req.get('authorization') ? 'Present' : 'Missing');
    next();
  },
  authenticateToken, // Authenticate
  (req, res, next) => {
    console.log('✅ User authenticated. User ID:', req.user?.userId);
    next();
  },
  uploadCtrl.uploadSingle, // Parse file
  (req, res, next) => {
    console.log('✅ File parsed:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    next();
  },
  uploadCtrl.multerErrorHandler, // Handle multer errors
  uploadCtrl.uploadImage // Upload
);

// Example of role-based access (only organizers can access)
router.get('/organizer-only', authenticateToken, authorizeRoles('organizer'), (req, res) => {
    res.json({
        success: true,
        message: 'This is an organizer-only endpoint',
    });
});

// Example of multiple roles access
router.get('/organizer-sponsor', authenticateToken, authorizeRoles('organizer', 'sponsor'), (req, res) => {
    res.json({
        success: true,
        message: 'This endpoint is accessible by organizers and sponsors',
    });
});

module.exports = router;
