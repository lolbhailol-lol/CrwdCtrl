const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminCouponController');

const router = express.Router();

router.get('/', adminAuth, ctrl.listCoupons);
router.post('/', adminAuth, ctrl.createCoupon);
router.put('/:couponId', adminAuth, ctrl.updateCoupon);

module.exports = router;
