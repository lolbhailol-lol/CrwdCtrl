const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminRunClubOrganizerController');

const router = express.Router();

router.get('/', adminAuth, ctrl.listOrganizers);
router.post('/', adminAuth, ctrl.createOrganizer);
router.put('/:id', adminAuth, ctrl.updateOrganizer);
router.delete('/:id', adminAuth, ctrl.deleteOrganizer);

module.exports = router;
