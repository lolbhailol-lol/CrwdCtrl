const express = require('express');
const ctrl = require('../controllers/mindsparkPaymentsController');
const { authenticateFestOrganizer, requireMindSparkPaymentsAccess } = require('../middleware/festOrganizerAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const requireAccess = [authenticateFestOrganizer, requireMindSparkPaymentsAccess];

router.post('/auth/login', authLimiter, ctrl.login);
router.get('/me', ...requireAccess, ctrl.getMe);
router.get('/summary', ...requireAccess, ctrl.getSummary);
router.get('/history', ...requireAccess, ctrl.getHistory);
router.get('/export', ...requireAccess, ctrl.exportPayments);
router.post('/settlements/sync', ...requireAccess, ctrl.syncSettlements);

module.exports = router;
