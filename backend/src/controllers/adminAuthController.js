const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');

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
    const secret = process.env.JWT_SECRET || 'your-default-secret';
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

    // ✅ FIX 7: ENHANCED COOKIE SETTINGS FOR MOBILE DEVICES
    const isProduction = process.env.NODE_ENV === 'production';
    
    // ✅ FIX 8: PROPER SAMESITE AND SECURE FLAGS
    const cookieOpts = {
      httpOnly: true,        // Prevents JavaScript access (security)
      path: '/',             // Available to all routes
      secure: isProduction,  // HTTPS only in production (mobile requirement)
      // ✅ FIX 9: SAMESITE WITH FALLBACK FOR MOBILE SAFARI
      sameSite: isProduction ? 'none' : 'lax',
      // Note: SameSite=None requires Secure=true, which is set in production
    };
    
    console.log('🍪 Cookie Options:', {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      environment: process.env.NODE_ENV
    });
    
    // ✅ FIX 10: SET BOTH ACCESS AND REFRESH TOKENS IN COOKIES
    res.cookie('admin_token', accessToken, { 
      ...cookieOpts, 
      maxAge: 60 * 60 * 1000  // 1 hour
    });
    res.cookie('admin_refresh_token', refreshToken, { 
      ...cookieOpts, 
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    // ✅ FIX 11: ALSO RETURN TOKENS IN RESPONSE (as fallback)
    // Some mobile browsers don't reliably send cookies, so we also return tokens
    // Frontend should store these in Authorization header as backup
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { email, role: 'admin' },
      message: 'Login successful - tokens set in cookies and response'
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
