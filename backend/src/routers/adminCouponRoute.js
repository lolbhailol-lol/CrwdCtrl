const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminCouponController');

const router = express.Router();

router.get('/', adminAuth, ctrl.listCoupons);
router.post('/', adminAuth, ctrl.createCoupon);
router.put('/:couponId', adminAuth, ctrl.updateCoupon);
router.post('/:couponId/reset-usage', adminAuth, ctrl.resetCouponUsage);
router.delete('/:couponId', adminAuth, ctrl.deleteCoupon);

module.exports = router;
