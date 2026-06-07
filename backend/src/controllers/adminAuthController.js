const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');
const { getJwtSecret } = require('../config/jwtSecret');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 [BACKEND] Admin login attempt:', { 
      email, 
      receivedEmail: email,
      expectedEmail: process.env.ADMIN_EMAIL,
      emailMatch: email === process.env.ADMIN_EMAIL,
      passwordMatch: password === process.env.ADMIN_PASSWORD
    });

    // Validate admin credentials
    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      console.error('❌ [BACKEND] Invalid admin credentials for:', email);
      console.error('❌ [BACKEND] Expected email:', process.env.ADMIN_EMAIL);
      console.error('❌ [BACKEND] Received email:', email);
      console.error('❌ [BACKEND] Password match:', password === process.env.ADMIN_PASSWORD);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid admin credentials' 
      });
    }

    // Use JWT_SECRET (consistent with middleware verification)
    const secret = getJwtSecret();
    console.log('🔐 [BACKEND] Secret loaded:', !!secret);
    
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

    console.log('✅ [BACKEND] Admin login successful:', { email, accessTokenExpiry: '1h', refreshTokenExpiry: '7d' });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { email, role: 'admin' }
    });
  } catch (error) {
    console.error('❌ [BACKEND] Login error:', error);
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

    const secret = getJwtSecret();
    
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
