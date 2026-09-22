const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../../config/jwtSecret');

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    const decoded = jwt.verify(header.slice(7), getJwtSecret());
    if (decoded.type === 'refresh' || !['admin', 'campus_hunt_admin'].includes(decoded.role)) {
      return res.status(403).json({ error: 'Forbidden: Campus Hunt access required' });
    }
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
