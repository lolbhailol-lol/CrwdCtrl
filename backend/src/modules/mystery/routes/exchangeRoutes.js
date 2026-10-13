const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/authmiddleware');
const { requireOwnTeam, requirePlayable } = require('../middleware/teamSession');
const ctrl = require('../controllers/exchangeController');

router.post('/offer', authenticateToken, requireOwnTeam, requirePlayable, ctrl.offerExchange);
router.post('/:exchangeId/respond', authenticateToken, requireOwnTeam, requirePlayable, ctrl.respondToExchange);
router.get('/team/:teamId', authenticateToken, requireOwnTeam, ctrl.listExchangesForTeam);

module.exports = router;
