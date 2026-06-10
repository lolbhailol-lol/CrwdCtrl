const express = require('express');
const router = express.Router();
const searchKeywordsController = require('../controllers/searchKeywordsController');

router.get('/keywords', searchKeywordsController.getKeywords);

module.exports = router;
