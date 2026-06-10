const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminSportsController');
const {
  getAdminSportScannerAccess,
  setAdminSportScannerAccess,
} = require('../controllers/sportScannerAccessController');

router.post('/', adminAuth, ctrl.createSportsEvent);
router.get('/', adminAuth, ctrl.getAllSportsEvents);
router.get('/:id/scanner-access', adminAuth, getAdminSportScannerAccess);
router.put('/:id/scanner-access', adminAuth, setAdminSportScannerAccess);
router.get('/:id', adminAuth, ctrl.getSportsEventById);
router.put('/:id', adminAuth, ctrl.updateSportsEvent);
router.delete('/:id', adminAuth, ctrl.deleteSportsEvent);

module.exports = router;
