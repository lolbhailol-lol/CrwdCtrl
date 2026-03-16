const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');

const authenticateToken = async (req, res, next) => {
    try {
        // Accept token from cookie (mobile/credentials) or Authorization header
        const tokenFromCookie = req.cookies?.crwdctrl_token;
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const token = tokenFromCookie || tokenFromHeader;

        if (!token) {
            console.log('❌ User auth: No authorization header or cookie');
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
                debug: {
                    hasAuthHeader: !!authHeader,
                    hasCookie: !!tokenFromCookie
                }
            });
        }

        if (!token.trim()) {
            console.log('❌ User auth: Empty token');
            return res.status(401).json({
                success: false,
                message: 'Empty access token',
            });
        }

        // ✅ FIX: Check if token is a Firebase fallback token (not a real JWT)
        if (token.startsWith('firebase_')) {
            console.error('❌ User auth: Firebase fallback token detected - user needs to re-authenticate');
            console.log('🔐 Token:', token.substring(0, 50) + '...');
            return res.status(401).json({
                success: false,
                message: 'Invalid session. Please log in again.',
                debug: { reason: 'firebase_fallback_token' }
            });
        }

        console.log('🔍 User auth: Validating token...');
        console.log('🔑 Token preview:', token.substring(0, 40) + '...');

        // Verify the token
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtError) {
            console.error('❌ User auth JWT error:', jwtError.name, '-', jwtError.message);
            console.log('📋 Token details:', {
                length: token.length,
                prefix: token.substring(0, 20),
                containsDots: (token.match(/\./g) || []).length,
                startsWithFirebase: token.startsWith('firebase_')
            });
            
            // Provide better error message
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token. Please log in again.',
                    debug: { error: jwtError.message }
                });
            }
            throw jwtError; // Re-throw other errors
        }

        console.log('🔍 User auth: Token decoded:', { 
            userId: decoded.userId, 
            exp: decoded.exp,
            currentTime: Math.floor(Date.now() / 1000)
        });

        // Check if token is expired
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            console.log('❌ User auth: Token expired');
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
                debug: { expiredAt: new Date(decoded.exp * 1000).toISOString() }
            });
        }

        // Check if user still exists
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            console.log('❌ User auth: User not found:', decoded.userId);
            return res.status(401).json({
                success: false,
                message: 'User no longer exists',
            });
        }

        // Add user to request object
        req.user = { userId: decoded.userId };
        console.log('✅ User auth: Success for user:', decoded.userId);
        next();
    } catch (error) {
        console.error('❌ User auth error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                debug: { error: error.message }
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
                debug: { expiredAt: error.expiredAt }
            });
        }

        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

// Middleware to check user roles
const authorizeRoles = (...roles) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            if (!roles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Insufficient permissions.',
                });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
            });
        }
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles,
};
