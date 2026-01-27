const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Admin login attempt:', { email });

    // Validate admin credentials
    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      console.error('❌ Invalid admin credentials for:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid admin credentials' 
      });
    }

    // Use JWT_SECRET (consistent with middleware verification)
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    
    // Generate access token (short-lived: 1 hour)
    const accessToken = jwt.sign(
      { role: 'admin', email },
      secret,
      { expiresIn: '1h' }
    );

    // Generate refresh token (long-lived: 7 days)
    const refreshToken = jwt.sign(
      { role: 'admin', email, type: 'refresh' },
      secret,
      { expiresIn: '7d' }
    );

    console.log('✅ Admin login successful:', { email, accessTokenExpiry: '1h', refreshTokenExpiry: '7d' });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { email, role: 'admin' }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Login failed' 
    });
  }
};

// Refresh admin token endpoint
exports.refreshAdminToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        message: 'Refresh token required' 
      });
    }

    const secret = process.env.JWT_SECRET || 'your-default-secret';
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (error) {
      console.error('❌ Refresh token verification failed:', error.message);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired refresh token' 
      });
    }

    // Check if it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token type' 
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { role: 'admin', email: decoded.email },
      secret,
      { expiresIn: '1h' }
    );

    console.log('🔄 Admin token refreshed for:', decoded.email);

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: refreshToken // Keep same refresh token
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Token refresh failed' 
    });
  }
};
