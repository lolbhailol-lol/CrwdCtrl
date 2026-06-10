const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const adminAuth = require('../middleware/adminAuth');
const {
  generateQR,
  generateTrekQR,
  generateSportsQR,
  verifyQR,
  verifyQRFromPayload,
  getCheckinStats,
} = require('../controllers/qrController');

// User: Generate QR code for their registration
router.get('/registrations/:registrationId/qr', authenticateToken, generateQR);
router.get('/trek-bookings/:bookingId/qr', authenticateToken, generateTrekQR);
router.get('/sports-registrations/:registrationId/qr', authenticateToken, generateSportsQR);

// Admin: Verify scanned QR payload or hash and check in
router.post('/checkin', adminAuth, verifyQRFromPayload);
router.post('/checkin/:hash', adminAuth, verifyQR);

// Admin: Get check-in stats for a fest
router.get('/fests/:festId/checkin-stats', adminAuth, getCheckinStats);

module.exports = router;
