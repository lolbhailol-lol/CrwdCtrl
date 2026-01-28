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
  authenticateToken, // Authenticate FIRST
  uploadCtrl.uploadSingle, // THEN parse file
  uploadCtrl.uploadImage // THEN handle upload
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
