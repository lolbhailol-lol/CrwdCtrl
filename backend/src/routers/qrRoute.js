const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const adminAuth = require('../middleware/adminAuth');
const { generateQR, generateTrekQR, verifyQR, verifyQRFromPayload, getCheckinStats } = require('../controllers/qrController');

// User: Generate QR code for their registration
router.get('/registrations/:registrationId/qr', authenticateToken, generateQR);
router.get('/trek-bookings/:bookingId/qr', authenticateToken, generateTrekQR);

// Admin: Verify scanned QR payload or hash and check in
router.post('/checkin', adminAuth, verifyQRFromPayload);
router.post('/checkin/:hash', adminAuth, verifyQR);

// Admin: Get check-in stats for a fest
router.get('/fests/:festId/checkin-stats', adminAuth, getCheckinStats);

module.exports = router;
