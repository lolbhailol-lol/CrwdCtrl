// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getAuth,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
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

// Social authentication functions
export const signInWithGoogle = async () => {
    try {
        if (!auth || !googleProvider) {
            throw new Error('Firebase authentication not properly initialized');
        }

        const result = await signInWithPopup(auth, googleProvider);

        if (!result || !result.user) {
            throw new Error('No user data received from Google');
        }

        // For social auth, user email is already verified by the provider
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false // Social auth emails are pre-verified
        };
    } catch (error) {
        console.error('Google sign-in error:', error);

        let errorMessage = 'Google sign-in failed. Please try again.';

        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in was cancelled. Please try again.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup was blocked. Please allow popups for this site and try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (error.code === 'auth/configuration-not-found') {
            errorMessage = 'Google sign-in is not properly configured. Please contact support.';
        } else if (error.message && error.message.includes('not properly initialized')) {
            errorMessage = 'Authentication service not available. Please refresh and try again.';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

export const signInWithFacebook = async () => {
    try {
        if (!auth || !facebookProvider) {
            throw new Error('Firebase authentication not properly initialized');
        }

        const result = await signInWithPopup(auth, facebookProvider);

        if (!result || !result.user) {
            throw new Error('No user data received from Facebook');
        }

        // For social auth, user email is already verified by the provider
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false // Social auth emails are pre-verified
        };
    } catch (error) {
        console.error('Facebook sign-in error:', error);

        let errorMessage = 'Facebook sign-in failed. Please try again.';

        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in was cancelled. Please try again.';
        } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup was blocked. Please allow popups for this site and try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email. Please use your original sign-in method.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (error.code === 'auth/configuration-not-found') {
            errorMessage = 'Facebook sign-in is not properly configured. Please contact support.';
        } else if (error.message && error.message.includes('not properly initialized')) {
            errorMessage = 'Authentication service not available. Please refresh and try again.';
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
        if (!auth) {
            throw new Error('Firebase authentication not properly initialized');
        }

        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send verification email
        console.log('Sending verification email to:', user.email);
        await sendEmailVerification(user, {
            url: `${window.location.origin}/verify-email`, // Redirect to verification page after clicking email link
            handleCodeInApp: true
        });
        console.log('Verification email sent successfully');

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
        if (!auth) {
            throw new Error('Firebase authentication not properly initialized');
        }

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

        // Check if we've sent an email recently to prevent rate limiting
        const lastSent = localStorage.getItem('lastVerificationEmailSent');
        const now = Date.now();
        const cooldownPeriod = 60000; // 1 minute cooldown

        if (lastSent && (now - parseInt(lastSent)) < cooldownPeriod) {
            const remainingTime = Math.ceil((cooldownPeriod - (now - parseInt(lastSent))) / 1000);
            return {
                success: false,
                error: `Please wait ${remainingTime} seconds before requesting another email.`
            };
        }

        console.log('Resending verification email to:', user.email);
        await sendEmailVerification(user, {
            url: `${window.location.origin}/verify-email`,
            handleCodeInApp: true
        });
        console.log('Verification email resent successfully');

        // Store timestamp of last sent email
        localStorage.setItem('lastVerificationEmailSent', now.toString());

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
        if (!auth) {
            throw new Error('Firebase authentication not properly initialized');
        }

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

export { auth, app, analytics };