const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/authmiddleware');
const { createOrder, getPaymentQuote, verifyPayment, createTrekOrder, verifyTrekPayment, createSportsOrder, verifySportsPayment, validateCoupon } = require('../controllers/paymentController');

router.post('/quote', authenticateToken, getPaymentQuote);
router.post('/order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/coupon-validate', optionalAuthenticateToken, validateCoupon);
router.post('/trek-order', optionalAuthenticateToken, createTrekOrder); // public — enforces trek.registration.requireLogin inside
router.post('/trek-verify', verifyTrekPayment);    // public — no auth
router.post('/sports-order', optionalAuthenticateToken, createSportsOrder);   // public — enforces sports.registration.requireLogin inside
router.post('/sports-verify', verifySportsPayment); // public — no auth

module.exports = router;
