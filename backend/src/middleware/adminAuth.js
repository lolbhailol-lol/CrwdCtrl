const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');
const { logger } = require('../utils/logger');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);

    if (decoded.role !== 'admin' || decoded.type === 'refresh') {
      if (isDev) {
        logger.warn('Admin auth rejected', { role: decoded.role, type: decoded.type });
      }
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (isDev) {
      logger.warn('Admin auth error', { message: error.message, name: error.name });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }

    res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
};
