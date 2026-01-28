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
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    connectAuthEmulator
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// ✅ CRITICAL: Set Firebase persistence to LOCAL (survives browser restarts)
// Note: setPersistence must be called before any auth operations
const initializePersistence = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('✅ Firebase persistence set to LOCAL');
        return true;
    } catch (error) {
        console.error('❌ Failed to set Firebase persistence:', error);
        return false;
    }
};

// Initialize persistence immediately
initializePersistence();

// Initialize providers with optimal settings
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Configure Google provider for better UX
googleProvider.setCustomParameters({
    prompt: 'select_account', // Always show account picker
    hd: undefined // Allow any domain
});

// Configure Facebook provider
facebookProvider.setCustomParameters({
    display: 'popup'
});

// Add required scopes
googleProvider.addScope('email');
googleProvider.addScope('profile');
facebookProvider.addScope('email');

// ✅ PRODUCTION-READY MOBILE DETECTION
const isMobileDevice = () => {
    // Primary: User Agent detection
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    const mobileRegex = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|webOS|Mobile Safari/i;
    const isMobileUA = mobileRegex.test(userAgent);
    
    // Secondary: Screen size and touch detection
    const isSmallScreen = window.innerWidth <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Specific device detection
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    // Final determination: prioritize UA, fallback to screen + touch
    const isMobile = isMobileUA || isIOS || isAndroid || (isSmallScreen && isTouchDevice);
    
    console.log('📱 Device detection:', {
        userAgent: userAgent.substring(0, 50) + '...',
        isMobileUA,
        isSmallScreen,
        isTouchDevice,
        isIOS,
        isAndroid,
        finalResult: isMobile,
        screenSize: `${window.innerWidth}x${window.innerHeight}`
    });
    
    return isMobile;
};

// ✅ BROWSER ENVIRONMENT DETECTION
const getBrowserInfo = () => {
    const userAgent = navigator.userAgent || '';
    return {
        isIOS: /iPad|iPhone|iPod/.test(userAgent),
        isSafari: /^((?!chrome|android).)*safari/i.test(userAgent),
        isChrome: /Chrome/.test(userAgent),
        isFirefox: /Firefox/.test(userAgent),
        isInAppBrowser: /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp|Telegram/i.test(userAgent),
        isWebView: /wv|WebView/.test(userAgent)
    };
};

// ✅ ADAPTIVE TIMEOUT BASED ON DEVICE AND CONNECTION
const getAuthTimeout = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection?.effectiveType || '4g';
    const browser = getBrowserInfo();
    
    let baseTimeout = 15000; // 15 seconds default
    
    // Increase timeout for mobile devices
    if (isMobileDevice()) {
        baseTimeout = 25000; // 25 seconds for mobile
    }
    
    // Adjust for connection speed
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        baseTimeout = 40000; // 40 seconds for slow connections
    } else if (effectiveType === '3g') {
        baseTimeout = 30000; // 30 seconds for 3g
    }
    
    // Increase timeout for problematic browsers
    if (browser.isSafari || browser.isInAppBrowser) {
        baseTimeout += 10000; // Extra 10 seconds for Safari and in-app browsers
    }
    
    return baseTimeout;
};

// ✅ RETRY MECHANISM WITH EXPONENTIAL BACKOFF
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            // Don't retry certain errors
            const nonRetryableErrors = [
                'auth/popup-blocked',
                'auth/unauthorized-domain',
                'auth/operation-not-allowed',
                'auth/user-disabled',
                'auth/account-exists-with-different-credential'
            ];
            
            if (nonRetryableErrors.includes(error.code) || i === maxRetries - 1) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, i);
            console.log(`🔄 Retry attempt ${i + 1} after ${delay}ms for error:`, error.code);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// ✅ ENHANCED IN-APP BROWSER DETECTION
const isInAppBrowser = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    
    // Detect in-app browsers that have authentication issues
    const inAppBrowsers = [
        /Instagram/i,
        /FBAN|FBAV/i,        // Facebook app
        /WhatsApp/i,
        /Line/i,
        /Telegram/i,
        /Twitter/i,
        /LinkedIn/i,
        /Snapchat/i,
        /TikTok/i,
        /WeChat/i,
        /QQ/i
    ];
    
    const isInApp = inAppBrowsers.some(regex => regex.test(userAgent));
    
    if (isInApp) {
        console.log('🚨 In-app browser detected:', userAgent.substring(0, 100));
    }
    
    return isInApp;
};

// ✅ POPUP-FIRST GOOGLE SIGN-IN FOR ALL DEVICES (WITH MOBILE FIX)
export const signInWithGoogle = async () => {
    console.log('🚀 Starting popup-first Google authentication...');
    
    // Ensure persistence is set before any auth operations
    await initializePersistence();
    
    const browser = getBrowserInfo();
    const isMobile = isMobileDevice();
    const isInApp = isInAppBrowser();
    const timeout = getAuthTimeout();
    
    console.log('📱 Device & Browser Info:', {
        isMobile,
        isInApp,
        browser: {
            isIOS: browser.isIOS,
            isSafari: browser.isSafari,
            isChrome: browser.isChrome,
            isFirefox: browser.isFirefox
        },
        timeout,
        viewport: `${window.innerWidth}x${window.innerHeight}`
    });

    // ✅ STEP 1: Check for existing redirect result first (cleanup from any previous redirects)
    // This must be done with proper error handling for mobile
    try {
        console.log('🔍 Checking for existing redirect result...');
        let redirectResult = null;
        
        try {
            redirectResult = await getRedirectResult(auth);
        } catch (redirectCheckError) {
            // On some mobile browsers, getRedirectResult can throw temporarily
            // Wait a bit and retry once if it fails
            console.log('⚠️ First redirect check failed, retrying after 500ms:', redirectCheckError.code);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                redirectResult = await getRedirectResult(auth);
            } catch (retryError) {
                console.log('⚠️ Second redirect check also failed, continuing:', retryError.code);
            }
        }
        
        if (redirectResult && redirectResult.user) {
            console.log('✅ Found existing redirect result - completing authentication');
            return {
                success: true,
                user: redirectResult.user,
                credential: redirectResult.credential,
                needsVerification: false,
                method: 'redirect-result'
            };
        }
        console.log('ℹ️ No existing redirect result found');
    } catch (error) {
        console.log('⚠️ Error checking redirect result:', error.code);
        // Continue with popup authentication
    }

    // ✅ STEP 2: Handle in-app browsers with warning
    if (isInApp) {
        console.log('🚨 In-app browser detected - authentication may not work properly');
        return {
            success: false,
            error: 'Please open this page in Chrome, Safari, or your default browser for Google sign-in to work properly.',
            code: 'auth/in-app-browser',
            method: 'in-app-browser-blocked',
            showOpenInBrowser: true
        };
    }

    // ✅ STEP 3: TRY POPUP FIRST ON ALL DEVICES (Mobile + Desktop)
    console.log('🖥️ Attempting popup authentication (works on mobile + desktop)...');
    
    try {
        // ✅ MOBILE FIX: Use longer timeout and better retry strategy for mobile
        const maxRetries = isMobile ? 3 : 2;
        const baseDelay = isMobile ? 1500 : 1000; // Longer delay between retries on mobile
        
        const result = await retryWithBackoff(async () => {
            return await Promise.race([
                signInWithPopup(auth, googleProvider),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('POPUP_TIMEOUT')), timeout)
                )
            ]);
        }, maxRetries, baseDelay);

        console.log('✅ Popup authentication successful');
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false,
            method: 'popup'
        };
    } catch (error) {
        console.log('⚠️ Popup authentication failed:', error.code || error.message);
        
        // ✅ STEP 4: FALLBACK TO REDIRECT ONLY IF POPUP IS BLOCKED/TIMEOUT
        const shouldFallbackToRedirect = (
            error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request' ||
            error.message === 'POPUP_TIMEOUT' ||
            error.code === 'auth/web-storage-unsupported'
        );
        
        if (shouldFallbackToRedirect) {
            console.log('🔄 Popup blocked/failed, trying redirect fallback...');
            
            try {
                await signInWithRedirect(auth, googleProvider);
                return {
                    success: true,
                    user: null,
                    credential: null,
                    needsVerification: false,
                    method: 'redirect-fallback',
                    redirectInitiated: true,
                    message: 'Popup blocked. Redirecting to Google sign-in...'
                };
            } catch (redirectError) {
                console.error('❌ Redirect fallback also failed:', redirectError);
                
                return {
                    success: false,
                    error: 'Google sign-in failed. Please try again or contact support.',
                    code: redirectError.code,
                    method: 'all-failed'
                };
            }
        }
        
        // Handle other popup errors (don't fallback to redirect)
        let errorMessage = 'Google sign-in failed. Please try again.';
        
        if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This website is not authorized for Google sign-in. Please contact support.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = 'Google sign-in is not enabled. Please contact support.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'Your account has been disabled. Please contact support.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email using a different sign-in method. Please try signing in with your original method.';
        }

        return {
            success: false,
            error: errorMessage,
            code: error.code,
            method: 'popup-failed'
        };
    }
};

// ✅ POPUP-FIRST FACEBOOK SIGN-IN FOR ALL DEVICES
export const signInWithFacebook = async () => {
    console.log('🚀 Starting popup-first Facebook authentication...');
    
    // Ensure persistence is set before any auth operations
    await initializePersistence();
    
    const isMobile = isMobileDevice();
    const browser = getBrowserInfo();
    const isInApp = isInAppBrowser();
    
    console.log('📱 Facebook sign-in device info:', {
        isMobile,
        isInApp,
        isIOS: browser.isIOS
    });

    // ✅ Handle in-app browsers with warning
    if (isInApp) {
        console.log('🚨 In-app browser detected for Facebook - authentication may not work properly');
        return {
            success: false,
            error: 'Please open this page in Chrome, Safari, or your default browser for Facebook sign-in to work properly.',
            code: 'auth/in-app-browser',
            method: 'in-app-browser-blocked',
            showOpenInBrowser: true
        };
    }

    // ✅ TRY POPUP FIRST ON ALL DEVICES (Mobile + Desktop)
    try {
        console.log('🖥️ Attempting Facebook popup authentication...');
        const result = await signInWithPopup(auth, facebookProvider);
        
        console.log('✅ Facebook popup sign-in successful');
        return {
            success: true,
            user: result.user,
            credential: result.credential,
            needsVerification: false,
            method: 'popup'
        };
    } catch (error) {
        console.error('❌ Facebook popup sign-in error:', error);

        // ✅ FALLBACK TO REDIRECT ONLY IF POPUP IS BLOCKED
        const shouldFallbackToRedirect = (
            error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request' ||
            error.code === 'auth/web-storage-unsupported'
        );

        if (shouldFallbackToRedirect) {
            console.log('🔄 Facebook popup blocked - trying redirect fallback...');
            
            try {
                await signInWithRedirect(auth, facebookProvider);
                return {
                    success: true,
                    user: null,
                    credential: null,
                    needsVerification: false,
                    method: 'redirect-fallback',
                    redirectInitiated: true,
                    message: 'Popup blocked. Redirecting to Facebook sign-in...'
                };
            } catch (redirectError) {
                console.error('❌ Facebook redirect fallback failed:', redirectError);
                
                return {
                    success: false,
                    error: 'Facebook sign-in failed. Please try again or use email login.',
                    code: redirectError.code,
                    method: 'all-failed'
                };
            }
        }

        // Handle other specific errors (don't fallback to redirect)
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
            error: errorMessage,
            code: error.code,
            method: 'popup-failed'
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
            errorMessage = 'No account found with this email. Please register first at /register.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again or reset your password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This account has been disabled. Please contact support.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed login attempts. Please wait 15 minutes and try again.';
        } else if (error.code === 'auth/invalid-credential') {
            // This includes both user-not-found and wrong-password scenarios
            errorMessage = 'Invalid email or password. Please check your credentials or register first at /register if you are a new user.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.code === 'auth/invalid-api-key') {
            errorMessage = 'Firebase configuration error. Please contact support.';
        }

        return {
            success: false,
            error: errorMessage,
            code: error.code
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

// ✅ CRITICAL: Handle redirect result for mobile authentication - MUST RUN FIRST
export const handleRedirectResult = async () => {
    console.log('🔍 Processing redirect result...');
    
    try {
        // ✅ CRITICAL: This must run before any other Firebase auth operations
        const result = await getRedirectResult(auth);
        
        if (result && result.user) {
            console.log('✅ Redirect result found:', {
                email: result.user.email,
                uid: result.user.uid,
                provider: result.providerId || result.user.providerData?.[0]?.providerId
            });
            
            return {
                success: true,
                user: result.user,
                credential: result.credential,
                providerId: result.providerId || result.user.providerData?.[0]?.providerId,
                needsVerification: false,
                isNewUser: result._tokenResponse?.isNewUser || false,
                method: 'redirect-result'
            };
        } else {
            console.log('ℹ️ No redirect result found (normal for non-redirect flows)');
            return null; // No redirect result - this is normal
        }
    } catch (error) {
        console.error('❌ Redirect result error:', error);
        
        let errorMessage = 'Authentication failed after redirect. Please try again.';
        
        if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email using a different sign-in method.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This user account has been disabled. Please contact support.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for authentication. Please contact support.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error during authentication. Please check your connection and try again.';
        }
        
        return {
            success: false,
            error: errorMessage,
            code: error.code,
            method: 'redirect-result-error'
        };
    }
};

export { auth, app, analytics, signOut };