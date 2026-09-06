export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  })
}

/**
 * Clients get a message they can act on; stack traces, driver errors and
 * malformed-body details stay in the server log.
 */
export function errorHandler(err, req, res, next) {
  console.error(`[treks-api] ${req.method} ${req.path}`, err)

  if (err?.name === 'ValidationError') {
    const field = Object.keys(err.errors || {})[0]
    return res.status(400).json({
      success: false,
      message: field ? `Invalid value for ${field}.` : 'Invalid request.',
    })
  }

  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: 'That entry already exists.' })
  }

  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ success: false, message: 'Invalid request body.' })
  }

  if (/^CORS blocked/.test(err?.message || '')) {
    return res.status(403).json({ success: false, message: 'Origin not allowed.' })
  }

  const status = err?.status || err?.statusCode || 500
  if (status < 500) {
    return res.status(status).json({
      success: false,
      message: err.message || 'Request failed.',
    })
  }

  return res.status(500).json({ success: false, message: 'Something went wrong. Try again.' })
}
