const express = require('express');
const { resolveOgHtml, SITE_URL } = require('../services/seoOgService');

const router = express.Router();

/**
 * GET /api/seo/og?path=/events/community-event/mafia-files-02
 * GET /api/seo/og/events/community-event/mafia-files-02
 *
 * Returns a minimal HTML document with Open Graph tags for social crawlers.
 */
function pathnameFromRequest(req) {
  if (typeof req.query.path === 'string' && req.query.path.trim()) {
    return req.query.path.trim();
  }
  const param = req.params?.path ?? req.params?.[0];
  if (param != null && String(param).length) {
    const raw = Array.isArray(param) ? param.join('/') : String(param);
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
  // /seo/og/events/... → strip leading /og
  const rest = String(req.path || '').replace(/^\/og\/?/, '');
  return rest ? `/${rest}` : '';
}

async function handleOg(req, res) {
  try {
    let pathname = pathnameFromRequest(req);
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;

    const html = await resolveOgHtml(pathname);
    if (!html) {
      return res.status(404).type('html').send(`<!DOCTYPE html><html><head>
  <meta property="og:title" content="CrwdCtrl" />
  <meta property="og:image" content="${SITE_URL}/logo-crwdctrl.png" />
</head><body><p>Not found</p></body></html>`);
    }

    res.set({
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      'X-CrwdCtrl-OG': '1',
    });
    return res.status(200).type('html').send(html);
  } catch (err) {
    console.error('[seo/og]', err?.message || err);
    return res.status(500).type('html').send('<!DOCTYPE html><html><body><p>Preview unavailable</p></body></html>');
  }
}

router.get('/og', handleOg);
router.get('/og/{*path}', handleOg);

module.exports = router;
