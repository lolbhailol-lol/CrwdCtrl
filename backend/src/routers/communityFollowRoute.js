const express = require('express');
const router = express.Router();
const {
    authenticateToken,
    optionalAuthenticateToken,
} = require('../middleware/authmiddleware');
const ctrl = require('../controllers/communityFollowController');

router.get('/:entityType/:entityId/status', optionalAuthenticateToken, ctrl.getStatus);
router.get('/:entityType/:entityId/members', ctrl.listMembers);
router.post('/:entityType/:entityId', authenticateToken, ctrl.follow);
router.delete('/:entityType/:entityId', authenticateToken, ctrl.unfollow);

module.exports = router;
