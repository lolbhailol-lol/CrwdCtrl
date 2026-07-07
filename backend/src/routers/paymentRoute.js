const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const { createOrder, getPaymentQuote, verifyPayment, createTrekOrder, verifyTrekPayment, createSportsOrder, verifySportsPayment, validateCoupon } = require('../controllers/paymentController');

router.post('/quote', authenticateToken, getPaymentQuote);
router.post('/order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/coupon-validate', validateCoupon);
router.post('/trek-order', authenticateToken, createTrekOrder);
router.post('/trek-verify', verifyTrekPayment);    // public — no auth
router.post('/sports-order', createSportsOrder);   // public — no auth
router.post('/sports-verify', verifySportsPayment); // public — no auth

module.exports = router;
