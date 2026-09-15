const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/authmiddleware');
const { createOrder, getPaymentQuote, verifyPayment, createTrekOrder, verifyTrekPayment, createSportsOrder, verifySportsPayment, validateCoupon } = require('../controllers/paymentController');

// Quote is display-only pricing (coupon preview); auth optional so fee/coupon UI can render before login.
router.post('/quote', optionalAuthenticateToken, getPaymentQuote);
router.post('/order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/coupon-validate', optionalAuthenticateToken, validateCoupon);
router.post('/trek-order', optionalAuthenticateToken, createTrekOrder); // public — enforces trek.registration.requireLogin inside
// Guest-friendly verify: JWT bound to order.userId when present, else customerEmail must match.
router.post('/trek-verify', optionalAuthenticateToken, verifyTrekPayment);
router.post('/sports-order', optionalAuthenticateToken, createSportsOrder);   // public — enforces sports.registration.requireLogin inside
router.post('/sports-verify', optionalAuthenticateToken, verifySportsPayment);

module.exports = router;
