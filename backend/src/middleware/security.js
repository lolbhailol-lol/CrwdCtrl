/**
 * Security headers and cache hints for API responses.
 */
function securityHeaders(req, res, next) {
  if (req.method === 'GET') {
    if (req.path.includes('/uploads/') || req.path.includes('/images/')) {
      res.set('Cache-Control', 'public, max-age=3600');
    } else if (req.path.startsWith('/api/fests') && !req.path.includes('/admin/')) {
      res.set('Cache-Control', 'public, max-age=300');
    } else if (
      (req.path.startsWith('/api/treks')
        || req.path.startsWith('/api/trek-communities')
        || req.path.startsWith('/api/sports'))
      && !req.path.includes('/admin/')
    ) {
      res.set('Cache-Control', 'no-store');
    }
  }

  res.set('Vary', 'Accept-Encoding');
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
}

module.exports = { securityHeaders };
