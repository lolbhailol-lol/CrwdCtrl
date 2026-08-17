const express = require('express');
const {
    register,
    login,
    socialAuth,
    getUserProfile,
    updateUserProfile,
    checkEmailExists,
    validateToken,
    refreshSession,
    deleteAccount,
} = require('../controllers/usercontroller');
const { authenticateToken, authorizeRoles } = require('../middleware/authmiddleware');
const { verifyRecaptcha } = require('../middleware/recaptcha');
const uploadCtrl = require('../controllers/uploadController');

const router = express.Router();

// Public routes (no authentication required)
// reCAPTCHA v3 is enforced only when RECAPTCHA_SECRET_KEY is set (otherwise a no-op).
router.post('/register', verifyRecaptcha('register'), register);
router.post('/login', verifyRecaptcha('login'), login);
router.post('/social-auth', verifyRecaptcha('social_auth'), socialAuth);
router.post('/check-email', checkEmailExists);

// Protected routes (authentication required)
router.get('/profile', authenticateToken, getUserProfile);
router.put('/profile', authenticateToken, updateUserProfile);

// Account deletion (soft delete + anonymize)
router.delete('/account', authenticateToken, deleteAccount);

// ✅ Token validation + silent refresh for returning users
router.get('/validate', authenticateToken, validateToken);
router.post('/session/refresh', refreshSession);

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
router.post('/upload/image', authenticateToken, uploadCtrl.uploadSingle, uploadCtrl.multerErrorHandler, uploadCtrl.uploadImage);

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
