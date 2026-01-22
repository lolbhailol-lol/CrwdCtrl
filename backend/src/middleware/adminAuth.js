const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Admin auth: No authorization header or invalid format');
      return res.status(401).json({ 
        message: 'No admin token provided',
        debug: {
          hasAuthHeader: !!authHeader,
          headerFormat: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      console.log('❌ Admin auth: Empty token');
      return res.status(401).json({ message: 'Empty admin token' });
    }

    console.log('🔍 Admin auth: Validating token...');
    
    // Use the same secret as regular JWT or a specific admin secret
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret);
    
    console.log('🔍 Admin auth: Token decoded:', { 
      userId: decoded.userId, 
      role: decoded.role,
      exp: decoded.exp,
      currentTime: Math.floor(Date.now() / 1000)
    });
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.log('❌ Admin auth: Token expired');
      return res.status(401).json({ message: 'Admin token expired' });
    }
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      console.log('❌ Admin auth: Not admin role:', decoded.role);
      return res.status(403).json({ 
        message: 'Access denied - admin role required',
        debug: { userRole: decoded.role }
      });
    }
    
    req.admin = decoded;
    console.log('✅ Admin auth: Success');
    next();
  } catch (error) {
    console.error('❌ Admin auth error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid admin token',
        debug: { error: error.message }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Admin token expired',
        debug: { expiredAt: error.expiredAt }
      });
    }
    
    return res.status(401).json({ 
      message: 'Admin authentication failed',
      debug: { error: error.message }
    });
  }
};
