/** Block routes in production (debug/test endpoints). */
function devOnly(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  next();
}

module.exports = devOnly;
