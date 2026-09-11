const express = require('express');
const router = express.Router();
const scannerAuth = require('../middleware/scannerAuth');
const trekScannerAuth = require('../middleware/trekScannerAuth');
const {
  loginScanner,
  scannerCheckin,
  scannerCheckinStats,
  exportScannerCheckins,
} = require('../controllers/scannerAccessController');
const {
  trekScannerCheckin,
  trekScannerCheckinStats,
  exportTrekScannerCheckins,
} = require('../controllers/trekScannerAccessController');
const sportScannerAuth = require('../middleware/sportScannerAuth');
const {
  sportScannerCheckin,
  sportScannerCheckinStats,
  exportSportScannerCheckins,
} = require('../controllers/sportScannerAccessController');
const { authLimiter, scannerCheckinLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, loginScanner);

router.post('/sport/:sportEventId/checkin', scannerCheckinLimiter, sportScannerAuth, sportScannerCheckin);
router.get('/sport/:sportEventId/stats', sportScannerAuth, sportScannerCheckinStats);
router.get('/sport/:sportEventId/export', sportScannerAuth, exportSportScannerCheckins);

router.post('/trek/:trekId/checkin', scannerCheckinLimiter, trekScannerAuth, trekScannerCheckin);
router.get('/trek/:trekId/stats', trekScannerAuth, trekScannerCheckinStats);
router.get('/trek/:trekId/export', trekScannerAuth, exportTrekScannerCheckins);

router.post('/:festId/checkin', scannerCheckinLimiter, scannerAuth, scannerCheckin);
router.get('/:festId/stats', scannerAuth, scannerCheckinStats);
router.get('/:festId/export', scannerAuth, exportScannerCheckins);

module.exports = router;
