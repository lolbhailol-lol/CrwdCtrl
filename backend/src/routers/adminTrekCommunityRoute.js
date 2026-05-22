const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTrekCommunityController');

// No-auth health check — hit /api/admin/trek-communities/ping to confirm routing
router.get('/ping', (req, res) => {
    res.json({
        ok: true,
        route: 'trek-communities',
        dbState: mongoose.connection.readyState, // 1 = connected
    });
});

router.post('/',      adminAuth, ctrl.create);
router.get('/',       adminAuth, ctrl.getAll);
router.get('/:id',    adminAuth, ctrl.getById);
router.put('/:id',    adminAuth, ctrl.update);
router.delete('/:id', adminAuth, ctrl.remove);

module.exports = router;
