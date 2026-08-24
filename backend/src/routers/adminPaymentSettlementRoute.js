const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminPaymentSettlementController');
const { multerErrorHandler } = require('../controllers/uploadController');

const router = express.Router();

router.get('/summary', adminAuth, ctrl.getSummary);
router.get('/history', adminAuth, ctrl.getHistory);
router.get('/export', adminAuth, ctrl.exportPayments);
router.post('/settlements/sync', adminAuth, ctrl.syncSettlements);
router.post(
  '/reconcile',
  adminAuth,
  ctrl.csvUploadMiddleware,
  multerErrorHandler,
  ctrl.reconcileUpload,
);
router.get('/reconcile/:id', adminAuth, ctrl.getReconciliation);
router.get('/payouts', adminAuth, ctrl.listPayouts);
router.patch('/payouts', adminAuth, ctrl.updatePayout);
router.post('/monday-clear/mark-paid', adminAuth, ctrl.markMondayClearPaid);
router.post('/batch/mark-paid', adminAuth, ctrl.markEventBatchPaid);

module.exports = router;
