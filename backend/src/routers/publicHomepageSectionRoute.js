const express = require('express');
const homepageSectionCtrl = require('../controllers/homepageSectionController');

const router = express.Router();

router.get('/', homepageSectionCtrl.listPublic);

module.exports = router;
