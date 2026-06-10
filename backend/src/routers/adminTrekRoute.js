const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTrekController');
const {
  getAdminTrekScannerAccess,
  setAdminTrekScannerAccess,
} = require('../controllers/trekScannerAccessController');

router.post('/', adminAuth, ctrl.createTrek);
router.get('/', adminAuth, ctrl.getAllTreks);
router.get('/:id/scanner-access', adminAuth, getAdminTrekScannerAccess);
router.put('/:id/scanner-access', adminAuth, setAdminTrekScannerAccess);
router.get('/:id', adminAuth, ctrl.getTrekById);
router.put('/:id', adminAuth, ctrl.updateTrek);
router.delete('/:id', adminAuth, ctrl.deleteTrek);

module.exports = router;
