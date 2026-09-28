'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/mindsparkAuditoriumController');
const uploadCtrl = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/authmiddleware');
const { registrationLimiter } = require('../middleware/rateLimiter');

router.get('/meta', ctrl.getPublicMeta);

/** Login required — Google session fills identity; blocks anonymous seat farming */
router.post('/request-otp', authenticateToken, registrationLimiter, ctrl.requestDirectoryOtp);
router.post('/verify-otp', authenticateToken, registrationLimiter, ctrl.verifyDirectoryOtp);
router.post('/register', authenticateToken, registrationLimiter, ctrl.publicRegister);
router.get('/my-ticket', authenticateToken, ctrl.getMyTicket);
router.post('/upload-signature', authenticateToken, registrationLimiter, uploadCtrl.createAuditoriumUploadSignature);

router.post(
  '/upload-photo',
  authenticateToken,
  registrationLimiter,
  uploadCtrl.uploadSingle,
  uploadCtrl.multerErrorHandler,
  (req, res, next) => {
    req.body = req.body || {};
    req.body.folder = 'crwdctrl/auditorium-tickets';
    next();
  },
  uploadCtrl.uploadImage,
);

module.exports = router;
