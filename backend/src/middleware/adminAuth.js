const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    
    const decoded = jwt.verify(token, secret);

    // Only allow 'admin' role and non-refresh tokens
    if (decoded.role !== 'admin' || decoded.type === 'refresh') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Admin authentication error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
};
