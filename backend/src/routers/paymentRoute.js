const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authmiddleware');
const { createOrder, getPaymentQuote, verifyPayment } = require('../controllers/paymentController');

router.post('/quote', authenticateToken, getPaymentQuote);
router.post('/order', authenticateToken, createOrder);
router.post('/verify', authenticateToken, verifyPayment);

module.exports = router;
