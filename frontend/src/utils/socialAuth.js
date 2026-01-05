// Social authentication utility functions

/**
 * Process Firebase user data for backend authentication
 * @param {Object} firebaseUser - Firebase user object
 * @param {string} provider - Auth provider ('google' or 'facebook')
 * @returns {Object} Formatted user data for backend
 */
export const processSocialAuthUser = (firebaseUser, provider) => {
    if (!firebaseUser || typeof firebaseUser !== 'object') {
        throw new Error('Invalid Firebase user object');
    }

    if (!provider || typeof provider !== 'string') {
        throw new Error('Invalid provider');
    }

    return {
        name: firebaseUser.displayName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        email: firebaseUser.email || null,
        phoneNumber: firebaseUser.phoneNumber || null,
        provider: provider.toLowerCase(),
        providerId: firebaseUser.uid || '',
        photoURL: firebaseUser.photoURL || null,
        role: 'student',
        isVerified: Boolean(firebaseUser.emailVerified)
    };
};

/**
 * Handle social authentication errors
 * @param {Error} error - Firebase authentication error
 * @param {string} provider - Auth provider name
 * @returns {string} User-friendly error message
 */
export const handleSocialAuthError = (error, provider) => {
    console.error(`${provider} authentication error:`, error);

    // Firebase specific errors
    if (error.code) {
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                return 'Sign-in was cancelled. Please try again.';
            case 'auth/popup-blocked':
                return 'Popup was blocked. Please allow popups for this site and try again.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection and try again.';
            case 'auth/too-many-requests':
                return 'Too many requests. Please wait a moment and try again.';
            case 'auth/account-exists-with-different-credential':
                return 'An account already exists with this email. Please use your original sign-in method.';
            case 'auth/invalid-credential':
                return 'Invalid credentials. Please try again.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support.';
            case 'auth/operation-not-allowed':
                return `${provider} sign-in is not enabled. Please contact support.`;
            case 'auth/unauthorized-domain':
                return 'This domain is not authorized for authentication.';
            default:
                return `${provider} sign-in failed. Please try again.`;
        }
    }

    // API errors
    if (error.message) {
        if (error.message.includes('Failed to fetch')) {
            return 'Unable to connect to server. Please check your internet connection and try again.';
        }
        if (error.message.includes('Network Error')) {
            return 'Network error. Please check your connection and try again.';
        }
        return error.message;
    }

    return `${provider} authentication failed. Please try again.`;
};

/**
 * Validate social auth response from Firebase
 * @param {Object} result - Firebase authentication result
 * @returns {boolean} True if result is valid
 */
export const validateSocialAuthResult = (result) => {
    try {
        return (
            result &&
            typeof result === 'object' &&
            result.success === true &&
            result.user &&
            typeof result.user === 'object' &&
            result.user.uid &&
            typeof result.user.uid === 'string' &&
            result.user.uid.length > 0 &&
            (result.user.email || result.user.phoneNumber)
        );
    } catch (error) {
        console.error('Error validating social auth result:', error);
        return false;
    }
};