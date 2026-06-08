const mongoose = require('mongoose');
const FestOrganizer = require('../model/fest_organizer_model');
const Trek = require('../model/trek_model');
const TrekCommunity = require('../model/trek_community_model');
const SportsEvent = require('../model/sports_model');

const MODEL_MAP = {
  fest: FestOrganizer,
  trek: Trek,
  community: TrekCommunity,
  sport: SportsEvent,
};

function clearCaches() {
  try {
    const { clearAllCaches } = require('./festOrganizerController');
    clearAllCaches();
  } catch (_) { /* optional */ }
}

/**
 * POST /admin/sections/reorder
 * Body: { updates: [{ type, id, fields: { priority, homePriority, ... } }] }
 */
exports.batchReorder = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'updates must be a non-empty array' });
    }

    const bulkByType = {};

    for (const item of updates) {
      const { type, id, fields } = item;
      if (!type || !id || !fields || typeof fields !== 'object') {
        return res.status(400).json({ success: false, message: 'Each update needs type, id, and fields' });
      }
      const Model = MODEL_MAP[type];
      if (!Model) {
        return res.status(400).json({ success: false, message: `Unknown type: ${type}` });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: `Invalid id: ${id}` });
      }
      if (!bulkByType[type]) bulkByType[type] = [];
      bulkByType[type].push({
        updateOne: {
          filter: { _id: id },
          update: { $set: fields },
        },
      });
    }

    const results = {};
    for (const [type, ops] of Object.entries(bulkByType)) {
      const Model = MODEL_MAP[type];
      const result = await Model.bulkWrite(ops);
      results[type] = { modified: result.modifiedCount };
    }

    clearCaches();
    res.json({ success: true, results });
  } catch (error) {
    console.error('batchReorder error:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder sections' });
  }
};
