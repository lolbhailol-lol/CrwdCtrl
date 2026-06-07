const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 [ADMIN AUTH] Auth header present:', !!authHeader);
    console.log('🔐 [ADMIN AUTH] Auth header format:', authHeader?.substring(0, 20) + '...');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [ADMIN AUTH] Missing or invalid Bearer token');
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();
    
    console.log('🔐 [ADMIN AUTH] Secret loaded:', !!secret);
    console.log('🔐 [ADMIN AUTH] Token length:', token.length);
    
    const decoded = jwt.verify(token, secret);
    
    console.log('🔐 [ADMIN AUTH] Token decoded successfully:', { 
      role: decoded.role,
      email: decoded.email,
      type: decoded.type 
    });

    // Only allow 'admin' role and non-refresh tokens
    if (decoded.role !== 'admin' || decoded.type === 'refresh') {
      console.error('❌ [ADMIN AUTH] Invalid role or refresh token:', { 
        role: decoded.role,
        type: decoded.type 
      });
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    console.log('✅ [ADMIN AUTH] Token validation passed');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ [ADMIN AUTH] Authentication error:', {
      message: error.message,
      name: error.name,
      type: error.constructor.name
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      console.error('❌ [ADMIN AUTH] JWT verification failed - possible JWT_SECRET mismatch');
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token - JWT verification failed' });
    }
    
    res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
};
