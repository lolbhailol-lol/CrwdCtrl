const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Accept token from cookie (mobile/credentials) or Authorization header
    const tokenFromCookie = req.cookies?.admin_token;
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = tokenFromCookie || tokenFromHeader;

    console.log('🔐 [ADMIN AUTH] Auth header present:', !!authHeader);
    console.log('🔐 [ADMIN AUTH] Cookie token present:', !!tokenFromCookie);

    if (!token) {
      console.error('❌ [ADMIN AUTH] Missing or invalid Bearer token');
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    
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
