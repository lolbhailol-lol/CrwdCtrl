const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTrekController');

router.post('/', adminAuth, ctrl.createTrek);
router.get('/', adminAuth, ctrl.getAllTreks);
router.get('/:id', adminAuth, ctrl.getTrekById);
router.put('/:id', adminAuth, ctrl.updateTrek);
router.delete('/:id', adminAuth, ctrl.deleteTrek);

module.exports = router;
