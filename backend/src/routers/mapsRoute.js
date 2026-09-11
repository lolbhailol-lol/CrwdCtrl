const express = require('express');
const router = express.Router();
const { resolveMapsEmbed, isHttpUrl } = require('../utils/googleMapsUrl');

// GET /api/maps/embed?url=...&q=venue+text
router.get('/embed', async (req, res) => {
  try {
    const mapUrl = String(req.query.url || '').trim();
    const query = String(req.query.q || '').trim();

    if (!mapUrl && !query) {
      return res.status(400).json({ message: 'url or q is required' });
    }
    if (mapUrl && !isHttpUrl(mapUrl)) {
      return res.status(400).json({ message: 'url must be http(s)' });
    }

    const result = await resolveMapsEmbed({ mapUrl, query });
    if (!result.embedSrc) {
      return res.status(404).json({ message: 'Could not build map embed' });
    }
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('maps embed resolve error:', err);
    return res.status(500).json({ message: 'Failed to resolve map link' });
  }
});

module.exports = router;
