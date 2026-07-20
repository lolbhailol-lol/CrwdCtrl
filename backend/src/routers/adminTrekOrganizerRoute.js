const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTrekOrganizerController');

const router = express.Router();

router.get('/profile-invites', adminAuth, ctrl.listProfileInvites);
router.post('/profile-invites', adminAuth, ctrl.addProfileInvite);
router.delete('/profile-invites/:inviteId', adminAuth, ctrl.removeProfileInvite);

router.get('/', adminAuth, ctrl.listOrganizers);
router.post('/', adminAuth, ctrl.createOrganizer);
router.post('/:id/approve', adminAuth, ctrl.approveOrganizer);
router.post('/:id/reject', adminAuth, ctrl.rejectOrganizer);
router.put('/:id', adminAuth, ctrl.updateOrganizer);
router.delete('/:id', adminAuth, ctrl.deleteOrganizer);

module.exports = router;
