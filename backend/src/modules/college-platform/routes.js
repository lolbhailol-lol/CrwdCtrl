const express = require('express');
const adminAuth = require('../../middleware/adminAuth');
const { authenticateToken, optionalAuthenticateToken } = require('../../middleware/authmiddleware');
const controller = require('./controller');

const publicRouter = express.Router();
publicRouter.get('/colleges', controller.listColleges);
publicRouter.get('/rankings', controller.rankings);
publicRouter.get('/', controller.listGames);
publicRouter.post('/host-requests', optionalAuthenticateToken, controller.createHostRequest);
publicRouter.get('/me/profile', authenticateToken, controller.getMyCollegeProfile);
publicRouter.get('/me/registrations', authenticateToken, controller.myRegistrations);
publicRouter.post('/invites/:token/claim', authenticateToken, controller.claimInvite);
publicRouter.get('/passes/:id', authenticateToken, controller.getPass);
publicRouter.post('/:id/reservations', authenticateToken, controller.reserveRegistration);
publicRouter.get('/:id', controller.getGame);

const adminRouter = express.Router();
adminRouter.use(adminAuth);
adminRouter.get('/', controller.adminList);
adminRouter.post('/colleges', controller.adminCreateCollege);
adminRouter.put('/colleges/:id', controller.adminUpdateCollege);
adminRouter.post('/games', controller.adminCreateGame);
adminRouter.put('/games/:id', controller.adminUpdateGame);
adminRouter.put('/host-requests/:id', controller.adminUpdateHostRequest);
adminRouter.post('/registrations/:id/members/:memberId/approve-substitution', controller.adminApproveSubstitution);
adminRouter.post('/check-in', controller.adminCheckIn);
adminRouter.get('/results', controller.adminResults);
adminRouter.post('/results', controller.adminFinalizeResult);

module.exports = { publicRouter, adminRouter };
