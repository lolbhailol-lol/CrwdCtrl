const express = require('express');
const router = express.Router();
const publicHomeController = require('../controllers/publicHomeController');

const siteSettingController = require('../controllers/siteSettingController');

// GET /api/home — aggregated homepage feed (fests + treks + communities + sports + run clubs + events)
router.get('/', publicHomeController.getHomeFeed);

// GET /api/home/section-labels — editable home carousel headings
router.get('/section-labels', siteSettingController.getHomeSectionLabels);

module.exports = router;
