const jwt = require('jsonwebtoken');
const User = require('../model/usermodel');
const { getJwtSecret } = require('../config/jwtSecret');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ User auth: No authorization header or invalid format');
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
                debug: {
                    hasAuthHeader: !!authHeader,
                    headerFormat: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
                }
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!token) {
            console.log('❌ User auth: Empty token');
            return res.status(401).json({
                success: false,
                message: 'Empty access token',
            });
        }

        console.log('🔍 User auth: Validating token...');

        // Verify the token
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);

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
