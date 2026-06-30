const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/siteSettingController');

router.get('/home-section-labels', adminAuth, ctrl.getHomeSectionLabels);
router.put('/home-section-labels', adminAuth, ctrl.updateHomeSectionLabels);

module.exports = router;
