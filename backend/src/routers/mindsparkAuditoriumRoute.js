'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/mindsparkAuditoriumController');
const uploadCtrl = require('../controllers/uploadController');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/authmiddleware');
const {
  registrationLimiter,
  auditoriumOtpLimiter,
  auditoriumActionLimiter,
} = require('../middleware/rateLimiter');

router.get('/meta', ctrl.getPublicMeta);

/** College-email OTP is the public identity check; Google login is optional. */
router.post('/request-otp', auditoriumOtpLimiter, ctrl.requestDirectoryOtp);
router.post('/verify-otp', auditoriumOtpLimiter, ctrl.verifyDirectoryOtp);
router.post('/register', optionalAuthenticateToken, auditoriumActionLimiter, ctrl.publicRegister);
router.get('/my-ticket', authenticateToken, ctrl.getMyTicket);
router.get('/pass/:registrationId', ctrl.getGuestPass);
router.post(
  '/upload-signature',
  auditoriumActionLimiter,
  ctrl.authorizePublicUpload,
  uploadCtrl.createAuditoriumUploadSignature,
);

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
