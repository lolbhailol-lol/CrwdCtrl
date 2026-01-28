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
// Handle preflight requests
router.options('/upload/image', (req, res) => {
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  res.sendStatus(200);
});

// IMPORTANT: uploadSingle must come BEFORE authenticateToken to parse file properly
router.post(
  '/upload/image',
  uploadCtrl.uploadSingle, // Parse file first
  (req, res, next) => {
    console.log('🎯 PAYMENT RECEIPT UPLOAD: File parsed');
    console.log('📋 File received:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    next();
  },
  authenticateToken, // Then authenticate
  (req, res, next) => {
    console.log('🎯 PAYMENT RECEIPT UPLOAD: User authenticated');
    console.log('👤 User ID:', req.user?.userId);
    console.log('📌 Auth header:', req.get('Authorization') ? 'Present' : 'Missing');
    next();
  },
  uploadCtrl.multerErrorHandler, // Handle multer errors
  uploadCtrl.uploadImage // Finally upload
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
