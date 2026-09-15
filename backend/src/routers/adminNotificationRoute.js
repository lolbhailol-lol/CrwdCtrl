const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminNotificationController');

const router = express.Router();

router.use(adminAuth);

router.get('/audiences/options', ctrl.getOptions);
router.get('/event-card', ctrl.getEventCard);
router.post('/preview-email', ctrl.previewEmail);
router.post('/preview', ctrl.previewAudience);
router.post('/test-send', ctrl.testSend);
router.post('/send', ctrl.sendCampaign);
router.get('/campaigns', ctrl.listCampaigns);
router.get('/campaigns/:id', ctrl.getCampaign);
router.get('/presets', ctrl.listPresets);
router.post('/presets', ctrl.createPreset);
router.delete('/presets/:id', ctrl.deletePreset);

module.exports = router;
