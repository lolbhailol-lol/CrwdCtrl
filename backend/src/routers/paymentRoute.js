const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const { createOrder, getPaymentQuote, verifyPayment, createTrekOrder, verifyTrekPayment } = require('../controllers/paymentController');

router.post('/quote', authenticateToken, getPaymentQuote);
router.post('/order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);
router.post('/trek-order', createTrekOrder);       // public — no auth
router.post('/trek-verify', verifyTrekPayment);    // public — no auth

module.exports = router;
