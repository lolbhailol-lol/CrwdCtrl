const express = require('express');
const { registerModels } = require('./models');
const { featureEnabled, isCampusHuntEnabled } = require('./middleware/featureEnabled');
const playerRoutes = require('./routes/player.routes');
const volunteerRoutes = require('./routes/volunteer.routes');
const adminRoutes = require('./routes/admin.routes');
const playerController = require('./controllers/playerController');

registerModels();

const router = express.Router();

/** Always available — reports whether the feature is on. */
router.get('/status', playerController.getStatus);

/** All other Campus Hunt APIs require CAMPUS_HUNT_ENABLED=true */
router.use(featureEnabled);
router.use(playerRoutes);
router.use('/volunteer', volunteerRoutes);
router.use('/admin', adminRoutes);

module.exports = {
  router,
  registerModels,
  isCampusHuntEnabled,
};
