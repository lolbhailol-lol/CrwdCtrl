const express = require('express');
const { campusHuntAnswerLimiter } = require('../../../middleware/rateLimiter');
const gridController = require('../controllers/gridController');

const router = express.Router();

router.post('/join', campusHuntAnswerLimiter, gridController.join);
router.get('/session/:sessionToken', gridController.getSession);
router.post('/session/:sessionToken/submit', campusHuntAnswerLimiter, gridController.submitLevel);
router.post('/session/:sessionToken/timeout', campusHuntAnswerLimiter, gridController.timeoutLevel);
router.post('/session/:sessionToken/hint', campusHuntAnswerLimiter, gridController.hint);

module.exports = router;
