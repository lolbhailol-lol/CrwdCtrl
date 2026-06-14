const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminEventShowController');

router.post('/', adminAuth, ctrl.createEventShow);
router.get('/', adminAuth, ctrl.getAllEventShows);
router.get('/:id', adminAuth, ctrl.getEventShowById);
router.put('/:id', adminAuth, ctrl.updateEventShow);
router.delete('/:id', adminAuth, ctrl.deleteEventShow);

module.exports = router;
