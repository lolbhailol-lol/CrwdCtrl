const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authMiddleware');
const ctrl = require('../controllers/exchangeController');

router.post('/offer', authenticateToken, ctrl.offerExchange);
router.post('/:exchangeId/respond', authenticateToken, ctrl.respondToExchange);
router.get('/team/:teamId', authenticateToken, ctrl.listExchangesForTeam);

module.exports = router;