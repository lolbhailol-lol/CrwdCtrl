const express = require('express');
const jwt = require('jsonwebtoken');
const User = require("../model/usermodel");
const { sendWelcomeEmail, sendLoginConfirmationEmail } = require('../services/emailService');
const { createNotification } = require('./notificationController');
const { sendPushNotification } = require('../services/pushService');
const { getJwtSecret } = require('../config/jwtSecret');
const { resolveFirebaseIdentity } = require('../utils/firebaseIdentity');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ userId }, getJwtSecret(), {
        expiresIn: '7d',
    });
};

// Use Express-trusted IP (respects trust proxy setting)
const getClientIp = (req) => req.ip || req.socket?.remoteAddress || '';

const LOGIN_NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;
const lastLoginNotifyAt = new Map();

// Persist login metadata without blocking the auth response
const recordLogin = (userId, req, method) => {
    User.updateOne(
        { _id: userId },
        {
            $set: {
                lastLoginAt: new Date(),
                lastLoginIp: getClientIp(req),
                lastLoginUserAgent: (req.headers['user-agent'] || '').slice(0, 300),
                lastLoginMethod: method,
            },
            $inc: { loginCount: 1 },
        },
    ).catch((error) => {
        console.error('❌ Failed to record login metadata:', error.message);
    });
};

const notifyLoginSuccess = async (user) => {
    if (!user || !user._id) return;

    const userKey = String(user._id);
    const last = lastLoginNotifyAt.get(userKey) || 0;
    if (Date.now() - last < LOGIN_NOTIFY_COOLDOWN_MS) return;
    lastLoginNotifyAt.set(userKey, Date.now());

    try {
        await createNotification({
            userId: user._id,
            title: 'Login successful',
            message: 'You signed in to CrwdCtrl.',
            type: 'system',
            link: '/notifications',
        });
    } catch (error) {
        console.error('❌ Login notification error:', error.message);
    }

    sendPushNotification(user._id, {
        title: 'Login successful',
        body: 'You signed in to CrwdCtrl.',
        link: '/notifications',
        type: 'system',
    }).catch(error => {
        console.error('❌ Login push notification error:', error.message);
    });
};

// Register function
const register = async (req, res) => {
    try {
        const { name, email, phoneNumber, password, role, college, firebaseUid, isVerified, idToken } = req.body;

        let verifiedFirebaseUid = null;
        let verifiedFromFirebase = false;
        if (firebaseUid) {
            try {
                const identity = await resolveFirebaseIdentity({ idToken, clientUid: firebaseUid });
                verifiedFirebaseUid = identity.uid;
                verifiedFromFirebase = identity.emailVerified;
            } catch (identityErr) {
                return res.status(identityErr.status || 401).json({
                    success: false,
                    message: identityErr.message || 'Firebase authentication failed',
                });
            }
        }

        // Validate required fields
        if (!name || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name and password are required',
            });
        }

        // Check if either email or phone number is provided
        if (!email && !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number is required',
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address',
                });
            }
        }

        // Validate phone number format if provided
        if (phoneNumber) {
            const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid phone number',
                });
            }
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
            });
        }

        // Check if user already exists with email, phone number, or Firebase UID
        const existingUserQuery = [];
        if (email) {
            existingUserQuery.push({ email });
        }
        if (phoneNumber) {
            existingUserQuery.push({ phoneNumber });
        }
        if (verifiedFirebaseUid) {
            existingUserQuery.push({ firebaseUid: verifiedFirebaseUid });
        }

        if (existingUserQuery.length > 0) {
            const existingUser = await User.findOne({
                $or: existingUserQuery
            });

            if (existingUser) {
                let conflictField = 'credentials';
                if (existingUser.email === email) conflictField = 'email';
                else if (existingUser.phoneNumber === phoneNumber) conflictField = 'phone number';
                else if (existingUser.firebaseUid === verifiedFirebaseUid) conflictField = 'Firebase account';

                return res.status(400).json({
                    success: false,
                    message: `User with this ${conflictField} already exists`,
                });
            }
        }

        // Create new user
        const userData = {
            name,
            password,
            role: role || 'student',
            // Security: isVerified only from Firebase token when linked, not client body
            isVerified: verifiedFirebaseUid ? verifiedFromFirebase : Boolean(isVerified),
            signupMethod: verifiedFirebaseUid ? 'firebase' : 'password',
        };

        // Add college if provided
        if (college) {
            userData.college = college;
        }

        if (verifiedFirebaseUid) {
            userData.firebaseUid = verifiedFirebaseUid;
        }

        // Add email only if provided and not empty
        if (email && email.trim()) {
            userData.email = email.trim();
        }

        // Add phone number only if provided and not empty
        if (phoneNumber && phoneNumber.trim()) {
            userData.phoneNumber = phoneNumber.trim();
        }

        const user = new User(userData);

        await user.save();

        // Generate JWT token
        const token = generateToken(user._id);

        recordLogin(user._id, req, verifiedFirebaseUid ? 'firebase' : 'password');

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        // Send welcome email (don't block the response if email fails)
        if (userData.email) {
            const emailData = {
                name: userData.name,
                email: userData.email,
                isVerified: userData.isVerified,
                registrationType: 'Regular'
            };

            // Send email asynchronously with detailed error logging
            sendWelcomeEmail(emailData).then(() => {
                // Email sent successfully
            }).catch(error => {
                console.error('❌ Failed to send welcome email to:', userData.email);
                console.error('   Error:', error.message);
                // Log error but don't affect the registration response
            });
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: userResponse,
                token,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// Login function
const login = async (req, res) => {
    try {
        const { email, phoneNumber, password, firebaseUid, idToken } = req.body;

        if (firebaseUid?.trim()) {
            try {
                await resolveFirebaseIdentity({ idToken, clientUid: firebaseUid.trim() });
            } catch (identityErr) {
                return res.status(identityErr.status || 401).json({
                    success: false,
                    message: identityErr.message || 'Firebase authentication failed',
                });
            }
        }

        // Validate required fields
        if ((!email && !phoneNumber) || !password) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number, and password are required',
            });
        }

        // Create query to find user by email, phone number, or Firebase UID
        const userQueryOptions = [];
        if (email && email.trim()) {
            userQueryOptions.push({ email: email.trim() });
        }
        if (phoneNumber && phoneNumber.trim()) {
            userQueryOptions.push({ phoneNumber: phoneNumber.trim() });
        }
        if (firebaseUid && firebaseUid.trim()) {
            userQueryOptions.push({ firebaseUid: firebaseUid.trim() });
        }

        if (userQueryOptions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Either email, phone number, or Firebase UID is required',
            });
        }

        // Check if user exists
        const user = await User.findOne({
            $or: userQueryOptions
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        if (user.isDeleted) {
            return res.status(403).json({
                success: false,
                message: 'This account has been deleted. Please create a new account to continue.',
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate JWT token
        const token = generateToken(user._id);

        recordLogin(user._id, req, firebaseUid?.trim() ? 'firebase' : 'password');

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        if (user.email) {
            const loginEmailData = {
                name: user.name,
                email: user.email,
            };

            sendLoginConfirmationEmail(loginEmailData).catch(error => {
                console.error('❌ Failed to send login confirmation email to:', user.email);
                console.error('   Error:', error.message);
            });
        }

        await notifyLoginSuccess(user);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userResponse,
                token,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// Get user profile
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user || user.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user,
            },
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// Social authentication function
const socialAuth = async (req, res) => {
    try {
        const {
            name,
            email,
            phoneNumber,
            dateOfBirth,
            provider,
            providerId,
            photoURL,
            role,
            isVerified,
            idToken,
        } = req.body;

        let firebaseIdentity;
        try {
            firebaseIdentity = await resolveFirebaseIdentity({
                idToken,
                clientUid: providerId,
            });
        } catch (identityErr) {
            return res.status(identityErr.status || 401).json({
                success: false,
                message: identityErr.message || 'Firebase authentication failed',
            });
        }

        const trustedProviderId = firebaseIdentity.uid;

        // Validate required fields
        if (!name || !provider || !trustedProviderId) {
            return res.status(400).json({
                success: false,
                message: 'Name, provider, and providerId are required',
            });
        }

        // Validate provider
        const validProviders = ['google', 'facebook', 'twitter', 'apple'];
        if (!validProviders.includes(provider.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid authentication provider',
            });
        }

        // Check if either email or phone number is provided
        if (!email && !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Either email or phone number is required',
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address',
                });
            }
        }

        // Validate phone number format if provided (exactly 10 digits)
        if (phoneNumber) {
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid 10-digit phone number',
                });
            }
        }

        // Validate date of birth if provided
        if (dateOfBirth) {
            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age < 13) {
                return res.status(400).json({
                    success: false,
                    message: 'You must be at least 13 years old',
                });
            }

            if (birthDate > today) {
                return res.status(400).json({
                    success: false,
                    message: 'Date of birth cannot be in the future',
                });
            }
        }

        // Check if user already exists with this provider and providerId
        let existingUser = await User.findOne({
            'socialAuth.provider': provider.toLowerCase(),
            'socialAuth.providerId': trustedProviderId,
        });

        if (existingUser && existingUser.isDeleted) {
            return res.status(403).json({
                success: false,
                message: 'This account has been deleted. Please create a new account to continue.',
            });
        }

        if (existingUser) {
            // User already exists with this social auth, just generate token and login
            const token = generateToken(existingUser._id);

            recordLogin(existingUser._id, req, provider.toLowerCase());

            // Remove password from response
            const userResponse = existingUser.toObject();
            delete userResponse.password;

            await notifyLoginSuccess(existingUser);

            return res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    user: userResponse,
                    token,
                },
            });
        }

        // Check if user already exists with same email or phone (to link accounts)
        const existingUserQuery = [];
        if (email && email.trim()) {
            existingUserQuery.push({ email: email.trim() });
        }
        if (phoneNumber && phoneNumber.trim()) {
            existingUserQuery.push({ phoneNumber: phoneNumber.trim() });
        }

        if (existingUserQuery.length > 0) {
            existingUser = await User.findOne({
                $or: existingUserQuery
            });

            if (existingUser && existingUser.isDeleted) {
                return res.status(403).json({
                    success: false,
                    message: 'This account has been deleted. Please create a new account to continue.',
                });
            }

            if (existingUser) {
                // Link social auth to existing account
                existingUser.socialAuth = {
                    provider: provider.toLowerCase(),
                    providerId: trustedProviderId,
                    photoURL: photoURL || null,
                };
                if (!existingUser.firebaseUid) {
                    existingUser.firebaseUid = trustedProviderId;
                }

                // Update other fields if not already set
                if (!existingUser.profilePic && photoURL) {
                    existingUser.profilePic = photoURL;
                }

                if (!existingUser.dateOfBirth && dateOfBirth) {
                    existingUser.dateOfBirth = dateOfBirth;
                }

                // Security: email verified status from Firebase token only
                existingUser.isVerified = firebaseIdentity.emailVerified;

                await existingUser.save();

                // Generate JWT token
                const token = generateToken(existingUser._id);

                recordLogin(existingUser._id, req, provider.toLowerCase());

                // Remove password from response
                const userResponse = existingUser.toObject();
                delete userResponse.password;

                await notifyLoginSuccess(existingUser);

                return res.status(200).json({
                    success: true,
                    message: 'Account linked successfully',
                    data: {
                        user: userResponse,
                        token,
                    },
                });
            }
        }

        // Create new user with social authentication
        const userData = {
            name: name.trim(),
            role: role || 'student',
            signupMethod: provider.toLowerCase(),
            socialAuth: {
                provider: provider.toLowerCase(),
                providerId: trustedProviderId,
                photoURL: photoURL || null,
            },
            firebaseUid: trustedProviderId,
            isVerified: firebaseIdentity.emailVerified,
        };

        // Add email only if provided and not empty
        if (email && email.trim()) {
            userData.email = email.trim();
        }

        // Add phone number only if provided and not empty
        if (phoneNumber && phoneNumber.trim()) {
            userData.phoneNumber = phoneNumber.trim();
        }

        // Add profile pic from social auth if available
        if (photoURL) {
            userData.profilePic = photoURL;
        }

        // Add date of birth if provided
        if (dateOfBirth) {
            userData.dateOfBirth = dateOfBirth;
        }

        const user = new User(userData);
        await user.save();

        // Generate JWT token
        const token = generateToken(user._id);

        recordLogin(user._id, req, provider.toLowerCase());

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        // Send welcome email for new social auth users (don't block the response if email fails)
        if (userData.email) {
            const emailData = {
                name: userData.name,
                email: userData.email,
                isVerified: userData.isVerified,
                registrationType: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Social Auth`
            };

            // Send email asynchronously with detailed error logging
            sendWelcomeEmail(emailData).then(() => {
                // Email sent successfully
            }).catch(error => {
                console.error('❌ Failed to send welcome email to:', userData.email);
                console.error('   Error:', error.message);
                // Log error but don't affect the registration response
            });
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully with social authentication',
            data: {
                user: userResponse,
                token,
            },
        });
    } catch (error) {
        console.error('Social authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
        });
    }
};

// Check if email exists
const checkEmailExists = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address',
            });
        }

        // Check if user exists with this email
        const user = await User.findOne({ email: email.trim() });

        res.status(200).json({
            success: true,
            data: {
                exists: !!user,
                message: user ? 'Email already registered' : 'Email available'
            }
        });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// Update user profile
const updateUserProfile = async (req, res) => {
    try {
        const { name, email, phoneNumber, college, profilePic, dateOfBirth, gender } = req.body;
        const userId = req.user.userId;

        const updateData = {};
        if (name) updateData.name = name;
        if (email) {
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address',
                });
            }

            // Check if email is already taken by another user
            const existingEmailUser = await User.findOne({
                email,
                _id: { $ne: userId }
            });
            if (existingEmailUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already taken by another user',
                });
            }
            updateData.email = email;
        }
        if (phoneNumber) {
            // Validate phone number format (accept 10 digits for this application)
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid 10-digit phone number',
                });
            }

            // Check if phone number is already taken by another user
            const existingPhoneUser = await User.findOne({
                phoneNumber,
                _id: { $ne: userId }
            });
            if (existingPhoneUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is already taken by another user',
                });
            }
            updateData.phoneNumber = phoneNumber;
        }
        if (college !== undefined) updateData.college = college; // Allow empty string
        if (profilePic !== undefined) {
            if (!profilePic || profilePic === '') {
                updateData.profilePic = '';
            } else if (
                /^https:\/\/res\.cloudinary\.com\//i.test(profilePic)
                || /^https:\/\/[a-z0-9.-]+\.(cloudinary\.com|amazonaws\.com)\//i.test(profilePic)
            ) {
                updateData.profilePic = profilePic;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Profile photo must be a valid HTTPS image URL',
                });
            }
        }

        // Handle date of birth
        if (dateOfBirth !== undefined) {
            if (dateOfBirth && dateOfBirth.trim()) {
                const birthDate = new Date(dateOfBirth);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();

                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                if (isNaN(birthDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please provide a valid date of birth',
                    });
                }

                if (birthDate > today) {
                    return res.status(400).json({
                        success: false,
                        message: 'Date of birth cannot be in the future',
                    });
                }

                if (age > 100) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please provide a valid date of birth',
                    });
                }

                updateData.dateOfBirth = birthDate;
            } else {
                updateData.dateOfBirth = null; // Allow clearing the date
            }
        }

        // Handle gender
        if (gender) {
            const validGenders = ['Male', 'Female', 'Others'];
            if (!validGenders.includes(gender)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid gender. Must be Male, Female, or Others',
                });
            }
            updateData.gender = gender;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// ✅ NEW: Token validation endpoint
const validateToken = async (req, res) => {
    try {
        // Token validation is already done by authenticateToken middleware
        // If we reach here, token is valid
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user || user.isDeleted) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Token is valid',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};

// Soft-delete (deactivate + anonymize) the authenticated user's account.
// Keeps registrations/bookings intact for records; frees email/phone for reuse.
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        if (user.isDeleted) {
            return res.status(200).json({
                success: true,
                message: 'Account already deleted',
            });
        }

        const anonymizedEmail = `deleted_${user._id}@deleted.crwdctrl`;

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    name: 'Deleted User',
                    profilePic: '',
                    fcmTokens: [],
                    email: anonymizedEmail,
                    'socialAuth.provider': null,
                    'socialAuth.providerId': null,
                    'socialAuth.photoURL': null,
                },
                $unset: {
                    phoneNumber: '',
                    firebaseUid: '',
                },
            },
        );

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully',
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

module.exports = {
    register,
    login,
    socialAuth,
    getUserProfile,
    updateUserProfile,
    checkEmailExists,
    validateToken,
    deleteAccount,
};
