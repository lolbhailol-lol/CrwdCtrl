const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTheatreController');

router.post('/', adminAuth, ctrl.createTheatre);
router.get('/', adminAuth, ctrl.getAllTheatre);
router.get('/:id', adminAuth, ctrl.getTheatreById);
router.put('/:id', adminAuth, ctrl.updateTheatre);
router.delete('/:id', adminAuth, ctrl.deleteTheatre);

module.exports = router;
