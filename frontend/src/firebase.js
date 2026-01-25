// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getAuth,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    applyActionCode,
    onAuthStateChanged
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ,
    appId: import.meta.env.VITE_FIREBASE_APP_ID ,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Initialize providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Configure providers
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

facebookProvider.setCustomParameters({
    display: 'popup'
});

// ✅ MOBILE DETECTION UTILITY
const isMobileDevice = () => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
};

// ✅ ENHANCED TIMEOUT FOR MOBILE
const getAuthTimeout = () => {
    return isMobileDevice() ? 30000 : 15000; // 30s mobile, 15s desktop
};

// ✅ ENHANCED GOOGLE SIGN-IN WITH MOBILE FALLBACK
export const signInWithGoogle = async () => {
    try {
        // Try popup first (works for desktop and some mobile browsers)
        const result = await signInWithPopup(auth, googleProvider);
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false,
            method: 'popup'
        };
    } catch (error) {
        console.error('Google popup sign-in error:', error);

        // ✅ MOBILE FALLBACK: If popup fails, try redirect (especially for mobile)
        if (error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request' ||
            isMobileDevice()) {
            
            console.log('🔄 Falling back to redirect method for mobile/popup-blocked');
            
            try {
                // Use redirect method for mobile devices
                await signInWithRedirect(auth, googleProvider);
                // Note: Result will be handled by handleRedirectResult in AuthContext
                return {
                    success: true,
                    user: null, // Will be handled by redirect result
                    credential: null,
                    needsVerification: false,
                    method: 'redirect',
                    redirectInitiated: true
                };
            } catch (redirectError) {
                console.error('Google redirect sign-in error:', redirectError);
                return {
                    success: false,
                    error: 'Google sign-in failed. Please try again or use email login.'
                };
            }
        }

        // Handle other specific errors
        let errorMessage = 'Google sign-in failed. Please try again.';

        if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for Google sign-in. Please contact support.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Google sign-in is not enabled. Please contact support.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// ✅ ENHANCED FACEBOOK SIGN-IN WITH MOBILE FALLBACK
export const signInWithFacebook = async () => {
    try {
        // Try popup first (works for desktop and some mobile browsers)
        const result = await signInWithPopup(auth, facebookProvider);
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false,
            method: 'popup'
        };
    } catch (error) {
        console.error('Facebook popup sign-in error:', error);

        // ✅ MOBILE FALLBACK: If popup fails, try redirect (especially for mobile)
        if (error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request' ||
            isMobileDevice()) {
            
            console.log('🔄 Falling back to redirect method for mobile/popup-blocked');
            
            try {
                // Use redirect method for mobile devices
                await signInWithRedirect(auth, facebookProvider);
                // Note: Result will be handled by handleRedirectResult in AuthContext
                return {
                    success: true,
                    user: null, // Will be handled by redirect result
                    credential: null,
                    needsVerification: false,
                    method: 'redirect',
                    redirectInitiated: true
                };
            } catch (redirectError) {
                console.error('Facebook redirect sign-in error:', redirectError);
                return {
                    success: false,
                    error: 'Facebook sign-in failed. Please try again or use email login.'
                };
            }
        }

        // Handle other specific errors
        let errorMessage = 'Facebook sign-in failed. Please try again.';

        if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email. Please use your original sign-in method.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for Facebook sign-in. Please contact support.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Facebook sign-in is not enabled. Please contact support to enable Facebook authentication.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// Email/Password authentication functions
export const registerWithEmail = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send verification email
        await sendEmailVerification(user, {
            url: `${window.location.origin}/verify-email`,
            handleCodeInApp: true
        });

        return {
            success: true,
            user: user,
            needsVerification: true
        };
    } catch (error) {
        console.error('Email registration error:', error);

        let errorMessage = 'Registration failed. Please try again.';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please use a different email or try logging in.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please choose a stronger password.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

export const loginWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        return {
            success: true,
            user: user,
            needsVerification: !user.emailVerified
        };
    } catch (error) {
        console.error('Email login error:', error);

        let errorMessage = 'Login failed. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please register first.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled. Please contact support.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please wait and try again later.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// Send verification email to current user
export const sendVerificationEmail = async () => {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user is currently signed in');
        }

        if (user.emailVerified) {
            return {
                success: true,
                message: 'Email is already verified'
            };
        }

        await sendEmailVerification(user, {
            url: `${window.location.origin}/verify-email`,
            handleCodeInApp: true
        });

        return {
            success: true,
            message: 'Verification email sent successfully'
        };
    } catch (error) {
        console.error('Send verification email error:', error);

        let errorMessage = 'Failed to send verification email. Please try again.';

        if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many requests. Please wait a few minutes before requesting another verification email.';
        } else if (error.code === 'auth/user-token-expired') {
            errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// Verify email with action code
export const verifyEmail = async (actionCode) => {
    try {
        await applyActionCode(auth, actionCode);

        // Reload the user to get updated emailVerified status
        if (auth.currentUser) {
            await auth.currentUser.reload();
        }

        return {
            success: true,
            message: 'Email verified successfully'
        };
    } catch (error) {
        console.error('Email verification error:', error);

        let errorMessage = 'Email verification failed. The link may be invalid or expired.';

        if (error.code === 'auth/expired-action-code') {
            errorMessage = 'Verification link has expired. Please request a new one.';
        } else if (error.code === 'auth/invalid-action-code') {
            errorMessage = 'Invalid verification link. Please check the link and try again.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled. Please contact support.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// Auth state listener
export const onAuthStateChange = (callback) => {
    return onAuthStateChanged(auth, callback);
};

// Get current user's verification status
export const getCurrentUser = () => {
    return auth.currentUser;
};

// Handle redirect result for mobile authentication
export const handleRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        
        if (result) {
            return {
                success: true,
                user: result.user,
                credential: result.credential,
                providerId: result.providerId,
                needsVerification: false,
                isNewUser: result._tokenResponse?.isNewUser || false
            };
        }
        
        return null; // No redirect result
    } catch (error) {
        console.error('Redirect result error:', error);
        
        let errorMessage = 'Authentication failed. Please try again.';
        
        if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email using a different sign-in method.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This user account has been disabled. Please contact support.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for authentication. Please contact support.';
        }
        
        return {
            success: false,
            error: errorMessage,
            code: error.code
        };
    }
};

export { auth, app, analytics };