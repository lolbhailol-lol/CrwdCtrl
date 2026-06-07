const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminRunClubController');

router.post('/', adminAuth, ctrl.create);
router.get('/', adminAuth, ctrl.getAll);
router.get('/:id', adminAuth, ctrl.getById);
router.put('/:id', adminAuth, ctrl.update);
router.delete('/:id', adminAuth, ctrl.remove);

module.exports = router;
