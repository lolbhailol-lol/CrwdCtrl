const express = require('express');
const {
  verifyWhatsAppWebhook,
  handleWhatsAppWebhook,
} = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/webhook', verifyWhatsAppWebhook);
router.post('/webhook', handleWhatsAppWebhook);

module.exports = router;
