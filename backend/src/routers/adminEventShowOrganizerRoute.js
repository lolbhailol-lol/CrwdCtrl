const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminEventShowOrganizerController');

const router = express.Router();

router.get('/', adminAuth, ctrl.listOrganizers);
router.post('/', adminAuth, ctrl.createOrganizer);
router.post('/:id/approve', adminAuth, ctrl.approveOrganizer);
router.post('/:id/reject', adminAuth, ctrl.rejectOrganizer);
router.put('/:id', adminAuth, ctrl.updateOrganizer);
router.delete('/:id', adminAuth, ctrl.deleteOrganizer);

module.exports = router;
