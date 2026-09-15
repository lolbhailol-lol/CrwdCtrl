const express = require('express');
const router = express.Router();
const siteSettingController = require('../controllers/siteSettingController');

// GET /api/config/public — client-safe copy/config only (no secrets, no admin fields)
router.get('/public', siteSettingController.getPublicConfig);

module.exports = router;
