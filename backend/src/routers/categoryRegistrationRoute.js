const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { authenticateToken } = require('../middleware/authmiddleware');
const ctrl = require('../controllers/categoryRegistrationController');

// ===== USER ROUTES =====

// POST /api/category-registrations/:category/:eventId/register
// category = sports | trek | theatre
router.post('/:category/:eventId/register', authenticateToken, ctrl.registerForEvent);

// GET /api/category-registrations/my
router.get('/my', authenticateToken, ctrl.getMyRegistrations);

// ===== ADMIN ROUTES =====

// GET /api/category-registrations/admin/all?category=sports&eventId=xxx
router.get('/admin/all', adminAuth, ctrl.adminGetAllRegistrations);

// GET /api/category-registrations/admin/summary
router.get('/admin/summary', adminAuth, ctrl.getCategorySummary);

// PUT /api/category-registrations/admin/:registrationId/status
router.put('/admin/:registrationId/status', adminAuth, ctrl.adminUpdateStatus);

module.exports = router;
