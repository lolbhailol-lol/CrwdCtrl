import { isNativeApp } from "../utils/capacitorPlatform";
import { clearOAuthRedirectMarkers } from '../utils/authBootstrap';
import { auth } from "./app.js";
import { signInWithGoogleNative } from "./authNative.js";
import { safeConsoleError, safeConsoleLog, safeConsoleWarn } from "../utils/safeLog";
import {
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
    browserLocalPersistence
} from "firebase/auth";

// ✅ CRITICAL: Set Firebase persistence to LOCAL (survives browser restarts)
// Note: setPersistence must be called before any auth operations
let persistenceInitialized = false;
let persistencePromise = null;

const initializePersistence = async () => {
    if (persistenceInitialized) {
        return true;
    }

    if (persistencePromise) {
        return persistencePromise;
    }

    try {
        persistencePromise = setPersistence(auth, browserLocalPersistence)
            .then(() => {
                persistenceInitialized = true;
                safeConsoleLog('✅ Firebase persistence set to LOCAL');
                return true;
            })
            .catch((error) => {
                safeConsoleError('❌ Failed to set Firebase persistence:', error);
                return false;
            })
            .finally(() => {
                if (!persistenceInitialized) {
                    persistencePromise = null;
                }
            });

        return persistencePromise;
    } catch (error) {
        safeConsoleError('❌ Failed to set Firebase persistence:', error);
        return false;
    }
};

const ensurePersistenceStarted = () => {
    if (!persistenceInitialized && !persistencePromise) {
        void initializePersistence();
    }
};

// Create a promise that resolves when Firebase is fully initialized
export const firebaseReady = initializePersistence().then(() => {
    safeConsoleLog('✅ Firebase initialization complete');
    return true;
}).catch(error => {
    safeConsoleError('⚠️ Firebase initialization issue:', error);
    return false;
});

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

// ✅ PRODUCTION-READY MOBILE DETECTION (ENHANCED FOR REAL DEVICES)
export const isMobileDevice = () => {
    // Primary: User Agent detection (most reliable for real mobile devices)
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    
    // Comprehensive mobile regex patterns
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile|mobile|CriOS|FxiOS|SamsungBrowser|UCBrowser|MiuiBrowser|Mobile Safari/i;
    const isMobileUA = mobileRegex.test(userAgent);
    
    // Specific device detection
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(userAgent);
    const isChromeOnAndroid = /Chrome/.test(userAgent) && /Android/.test(userAgent);
    const isSafariOnIOS = /Safari/.test(userAgent) && isIOS && !/CriOS|FxiOS/.test(userAgent);
    
    // Secondary: Screen size check (fallback, not primary)
    const isSmallScreen = window.innerWidth <= 768 || window.screen.width <= 768;
    
    // Touch capability (not primary, but helps)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // ✅ CRITICAL: Don't rely on DevTools mobile emulation checks
    // DevTools mobile view does NOT reflect real mobile browser behavior
    // Real mobile browsers have fundamentally different popup/redirect handling
    
    // Final determination: UA detection is most reliable
    const isMobile = isMobileUA || isIOS || isAndroid;
    
    safeConsoleLog('📱 Mobile Detection (ENHANCED):', {
        userAgent: userAgent.substring(0, 80) + '...',
        isMobileUA,
        isIOS,
        isAndroid,
        isChromeOnAndroid,
        isSafariOnIOS,
        isSmallScreen,
        isTouchDevice,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        screenAvail: `${window.screen.availWidth}x${window.screen.availHeight}`,
        finalResult: isMobile
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
        safeConsoleLog('🚨 In-app browser detected:', userAgent.substring(0, 100));
    }
    
    return isInApp;
};

// ✅ HELPER: Get human-readable error messages for Google Auth
const getGoogleAuthErrorMessage = (error) => {
    const errorMessages = {
        'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
        'auth/unauthorized-domain': '❌ DOMAIN NOT AUTHORIZED: Add your domain to Firebase Console → Authentication → Settings → Authorized domains',
        'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Console. Please contact support.',
        'auth/user-disabled': 'Your account has been disabled. Please contact support.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
        'auth/popup-blocked': 'Popup was blocked. Please allow popups or try again.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.'
    };
    
    return errorMessages[error.code] || `Google sign-in failed: ${error.message || 'Please try again.'}`;
};

// ✅ POPUP-FIRST GOOGLE SIGN-IN FOR ALL DEVICES (WITH MOBILE FIX)
export const signInWithGoogle = async () => {
    safeConsoleLog('🚀 Starting Google authentication...');
    
    ensurePersistenceStarted();

    // Capacitor Android/iOS: native Google SDK (no browser redirect to localhost)
    if (isNativeApp()) {
        clearOAuthRedirectMarkers();
        try {
            return await signInWithGoogleNative();
        } catch (err) {
            const code = err?.code || '';
            if (code.includes('cancel') || code.includes('12501')) {
                return {
                    success: false,
                    error: 'Sign-in was cancelled. Please try again.',
                    code,
                    method: 'native-google-cancelled',
                };
            }
            return {
                success: false,
                error: getGoogleAuthErrorMessage(err),
                code,
                method: 'native-google-failed',
            };
        }
    }
    
    const browser = getBrowserInfo();
    const isMobile = isMobileDevice();
    const isInApp = isInAppBrowser();
    const timeout = getAuthTimeout();
    
    safeConsoleLog('📱 Device & Browser Info:', {
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

    // ✅ STEP 1: In-app browsers (Instagram, Facebook, etc.) — do NOT start Google OAuth.
    // Those WebViews block Google cookies/popups. Same pattern as most sites: ask to open Chrome/Safari.
    if (isInApp) {
        safeConsoleLog('🚨 IN-APP BROWSER DETECTED — prompting Open in Chrome/Safari (skip Google OAuth)');

        const userAgent = navigator.userAgent || '';
        const isInstagram = /Instagram/i.test(userAgent);
        const isFacebook = /FBAN|FBAV/i.test(userAgent);
        const isTikTok = /TikTok/i.test(userAgent);

        let appName = 'this app';
        if (isInstagram) appName = 'Instagram';
        else if (isFacebook) appName = 'Facebook';
        else if (isTikTok) appName = 'TikTok';

        const openInBrowserUrl = window.location.href;
        try {
            sessionStorage.setItem('auth_redirect_url', openInBrowserUrl);
            sessionStorage.setItem('crwdctrl_login_context', JSON.stringify({
                fromProfile: false,
                stayInProfile: false,
                returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            }));
        } catch {
            /* ignore */
        }

        return {
            success: false,
            error: `Google Sign-In doesn't work in ${appName}'s browser. Open this page in Chrome or Safari to continue.`,
            code: 'auth/in-app-browser-blocked',
            method: 'in-app-open-external',
            showOpenInBrowser: true,
            isInAppBrowser: true,
            appName,
            openInBrowserUrl,
            errorDetails: {
                icon: '📱',
                title: `Open outside ${appName}`,
                suggestion: 'Google Sign-In needs Chrome or Safari',
                instructions: `Tap Open in Chrome/Safari, or use ${appName}'s ⋯ menu → Open in browser`,
                copyUrl: openInBrowserUrl,
            },
        };
    }

    // ✅ STEP 2: MOBILE VS DESKTOP AUTHENTICATION STRATEGY
    // 
    // WHY POPUP FAILS ON REAL MOBILE DEVICES:
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. Mobile browsers aggressively block popups to prevent spam
    // 2. Even when popup opens, it loses connection to the parent window
    // 3. Cross-origin postMessage communication is unreliable on mobile
    // 4. iOS Safari closes popups when the app goes to background
    // 5. Android WebView has inconsistent popup handling
    // 6. The OAuth callback can't communicate back to the original page
    //
    // WHY REDIRECT WORKS ON MOBILE:
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. Uses native browser navigation (same tab, no popup)
    // 2. Firebase stores OAuth state in sessionStorage before redirect
    // 3. After Google auth, browser redirects BACK to your app
    // 4. getRedirectResult() retrieves the user from stored state
    // 5. Works reliably on ALL mobile browsers
    //
    // NOTE: Chrome DevTools mobile emulation does NOT reflect real mobile behavior!
    // DevTools emulation uses desktop popup logic, masking the real issue.
    
    if (isMobile) {
        safeConsoleLog('📱 MOBILE DEVICE - Using POPUP flow (signInWithRedirect broken on Chrome 115+/Safari 17+ due to cookie policies)');
        
        try {
            const result = await signInWithPopup(auth, googleProvider);
            
            if (result && result.user) {
                safeConsoleLog('✅ Mobile Google popup sign-in successful:', result.user.email);
                return {
                    success: true,
                    user: result.user,
                    credential: result.credential || null,
                    needsVerification: false,
                    method: 'mobile-popup'
                };
            }
            return {
                success: false,
                error: 'Google sign-in returned no user.',
                method: 'mobile-popup-no-user'
            };
        } catch (popupError) {
            safeConsoleError('❌ Mobile Google popup failed:', popupError);
            
            // Popup blocked by browser - fall back to redirect
            if (popupError.code === 'auth/popup-blocked') {
                safeConsoleLog('🔄 Mobile popup blocked, falling back to redirect...');
                try {
                    sessionStorage.setItem('auth_redirect_url', window.location.href);
                    sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
                    sessionStorage.setItem('auth_redirect_type', 'google');
                    
                    await signInWithRedirect(auth, googleProvider);
                    return {
                        success: true,
                        user: null,
                        credential: null,
                        needsVerification: false,
                        method: 'mobile-redirect-fallback',
                        redirectInitiated: true,
                        message: 'Redirecting to Google sign-in...'
                    };
                } catch (redirectError) {
                    return {
                        success: false,
                        error: getGoogleAuthErrorMessage(redirectError),
                        code: redirectError.code,
                        method: 'mobile-redirect-fallback-failed'
                    };
                }
            }
            
            // User cancelled — not an error
            if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
                return {
                    success: false,
                    error: 'Sign-in was cancelled. Please try again.',
                    code: popupError.code,
                    method: 'mobile-popup-cancelled'
                };
            }
            
            return {
                success: false,
                error: getGoogleAuthErrorMessage(popupError),
                code: popupError.code,
                method: 'mobile-popup-failed'
            };
        }
    }
    
    // ✅ DESKTOP: Use POPUP flow (signInWithRedirect is broken on modern browsers
    // due to third-party cookie blocking in Chrome 115+, Safari 17+, Firefox 120+)
    safeConsoleLog('🖥️ DESKTOP DEVICE - Using POPUP flow');
    
    try {
        safeConsoleLog('➡️ Opening Google sign-in popup (desktop)...');
        const result = await signInWithPopup(auth, googleProvider);
        
        if (result && result.user) {
            safeConsoleLog('✅ Google popup sign-in successful:', result.user.email);
            return {
                success: true,
                user: result.user,
                credential: result.credential || null,
                needsVerification: false,
                method: 'desktop-popup'
            };
        }
        
        return {
            success: false,
            error: 'Google sign-in popup returned no user.',
            method: 'desktop-popup-no-user'
        };
    } catch (popupError) {
        safeConsoleError('❌ Desktop Google popup failed:', popupError);
        
        // If popup is blocked, fall back to redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
            safeConsoleLog('🔄 Popup blocked/closed, falling back to redirect flow...');
            try {
                sessionStorage.setItem('auth_redirect_url', window.location.href);
                sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
                sessionStorage.setItem('auth_redirect_type', 'google');
                
                await signInWithRedirect(auth, googleProvider);
                
                return {
                    success: true,
                    user: null,
                    credential: null,
                    needsVerification: false,
                    method: 'desktop-redirect-fallback',
                    redirectInitiated: true,
                    message: 'Redirecting to Google sign-in...'
                };
            } catch (redirectError) {
                safeConsoleError('❌ Redirect fallback also failed:', redirectError);
                return {
                    success: false,
                    error: getGoogleAuthErrorMessage(redirectError),
                    code: redirectError.code,
                    method: 'desktop-redirect-fallback-failed'
                };
            }
        }
        
        return {
            success: false,
            error: getGoogleAuthErrorMessage(popupError),
            code: popupError.code,
            method: 'desktop-popup-failed'
        };
    }
};

// ✅ REDIRECT-FIRST FACEBOOK SIGN-IN (AVOIDS COOP WARNINGS)
export const signInWithFacebook = async () => {
    safeConsoleLog('🚀 Starting Facebook authentication...');
    
    ensurePersistenceStarted();

    if (isNativeApp()) {
        try {
            sessionStorage.setItem('auth_redirect_url', window.location.href);
            sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            sessionStorage.setItem('auth_redirect_type', 'facebook');
            await signInWithRedirect(auth, facebookProvider);
            return {
                success: true,
                user: null,
                credential: null,
                needsVerification: false,
                method: 'capacitor-redirect',
                redirectInitiated: true,
                message: 'Redirecting to Facebook sign-in...',
            };
        } catch (err) {
            return {
                success: false,
                error: err.message || 'Facebook sign-in failed',
                code: err.code,
                method: 'capacitor-redirect-failed',
            };
        }
    }
    
    const isInApp = isInAppBrowser();
    
    // ✅ Handle in-app browsers - try redirect flow (it may work)
    if (isInApp) {
        safeConsoleLog('📱 IN-APP BROWSER DETECTED - Attempting redirect-based Facebook OAuth');
        
        try {
            sessionStorage.setItem('auth_redirect_url', window.location.href);
            sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            sessionStorage.setItem('auth_redirect_type', 'facebook');
            sessionStorage.setItem('auth_in_app_browser', 'true');
            
            safeConsoleLog('➡️ Initiating Facebook redirect flow for in-app browser...');
            await signInWithRedirect(auth, facebookProvider);
            
            return {
                success: true,
                user: null,
                credential: null,
                needsVerification: false,
                method: 'in-app-redirect',
                redirectInitiated: true,
                message: 'Redirecting to Facebook sign-in...'
            };
        } catch (inAppError) {
            safeConsoleError('❌ In-app browser Facebook redirect failed:', inAppError);
            
            return {
                success: false,
                error: 'Facebook sign-in had an issue in this browser. Try opening this page in Chrome or Safari.',
                code: inAppError.code || 'auth/in-app-browser-failed',
                method: 'in-app-redirect-failed',
                showOpenInBrowser: true,
                errorDetails: {
                    icon: '📱',
                    title: 'In-App Browser Detected',
                    suggestion: 'For the best experience, open this page in Chrome or Safari',
                    instructions: 'Tap the ⋮ or ⋯ menu and select "Open in Browser"'
                }
            };
        }
    }

    // ✅ DESKTOP: Use POPUP for Facebook (redirect is broken on modern browsers)
    // Mobile still uses redirect (handled above)
    const isMobileFb = isMobileDevice();
    
    if (!isMobileFb) {
        safeConsoleLog('🖥️ Using popup-first Facebook authentication (desktop)...');
        try {
            const result = await signInWithPopup(auth, facebookProvider);
            if (result && result.user) {
                safeConsoleLog('✅ Facebook popup sign-in successful:', result.user.email);
                return {
                    success: true,
                    user: result.user,
                    credential: result.credential || null,
                    needsVerification: false,
                    method: 'desktop-popup'
                };
            }
            return {
                success: false,
                error: 'Facebook sign-in popup returned no user.',
                method: 'desktop-popup-no-user'
            };
        } catch (popupError) {
            safeConsoleError('❌ Facebook popup failed:', popupError);
            if (popupError.code !== 'auth/popup-blocked' && popupError.code !== 'auth/popup-closed-by-user') {
                // Not a popup-blocked error, return the error
                let errorMessage = 'Facebook sign-in failed. Please try again.';
                if (popupError.code === 'auth/account-exists-with-different-credential') {
                    errorMessage = 'An account already exists with this email. Please use your original sign-in method.';
                }
                return { success: false, error: errorMessage, code: popupError.code, method: 'desktop-popup-failed' };
            }
            safeConsoleLog('🔄 Popup blocked, falling back to redirect...');
            // Fall through to redirect below
        }
    }
    
    // Mobile: Use popup (signInWithRedirect broken on Chrome 115+/Safari 17+ due to cookie policies)
    safeConsoleLog('📱 Mobile Facebook - Using POPUP flow...');
    
    try {
        const result = await signInWithPopup(auth, facebookProvider);
        if (result && result.user) {
            safeConsoleLog('✅ Mobile Facebook popup sign-in successful:', result.user.email);
            return {
                success: true,
                user: result.user,
                credential: result.credential || null,
                needsVerification: false,
                method: 'mobile-popup'
            };
        }
        return {
            success: false,
            error: 'Facebook sign-in returned no user.',
            method: 'mobile-popup-no-user'
        };
    } catch (popupError) {
        safeConsoleError('❌ Mobile Facebook popup failed:', popupError);
        
        // Popup blocked - fall back to redirect
        if (popupError.code === 'auth/popup-blocked') {
            safeConsoleLog('🔄 Mobile popup blocked, falling back to redirect...');
            try {
                sessionStorage.setItem('auth_redirect_url', window.location.href);
                sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
                sessionStorage.setItem('auth_redirect_type', 'facebook');
                
                await signInWithRedirect(auth, facebookProvider);
                return {
                    success: true,
                    user: null,
                    credential: null,
                    needsVerification: false,
                    method: 'mobile-redirect-fallback',
                    redirectInitiated: true,
                    message: 'Redirecting to Facebook sign-in...'
                };
            } catch (redirectError) {
                return {
                    success: false,
                    error: redirectError.message || 'Facebook sign-in failed. Please try again.',
                    code: redirectError.code,
                    method: 'mobile-redirect-fallback-failed'
                };
            }
        }
        
        // User cancelled — not an error
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/cancelled-popup-request') {
            return {
                success: false,
                error: 'Sign-in was cancelled. Please try again.',
                code: popupError.code,
                method: 'mobile-popup-cancelled'
            };
        }
        
        let errorMessage = 'Facebook sign-in failed. Please try again.';
        if (popupError.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email. Please use your original sign-in method.';
        } else if (popupError.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        return {
            success: false,
            error: errorMessage,
            code: popupError.code,
            method: 'mobile-popup-failed'
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
        safeConsoleError('Email registration error:', error);

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
        safeConsoleError('Email login error:', error);

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
        safeConsoleError('Send verification email error:', error);

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
        safeConsoleError('Email verification error:', error);

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

// ✅ CRITICAL: Handle redirect result for mobile authentication - MUST RUN FIRST ON PAGE LOAD
// This function is called by AuthContext on app initialization to check if user is returning
// from a Google/Facebook OAuth redirect. On mobile, this is the ONLY way to get the auth result.
export const handleRedirectResult = async () => {
    safeConsoleLog('🔍 Processing redirect result (CRITICAL for mobile OAuth)...');

    // Native Capacitor apps never use Firebase web redirect OAuth
    if (isNativeApp()) {
        clearOAuthRedirectMarkers();
        return null;
    }
    
    // Check if we have a pending redirect
    const redirectType = sessionStorage.getItem('auth_redirect_type');
    const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
    const redirectUrl = sessionStorage.getItem('auth_redirect_url');
    const wasInAppBrowser = sessionStorage.getItem('auth_in_app_browser');
    
    safeConsoleLog('📋 Redirect context:', {
        redirectType,
        redirectTimestamp,
        redirectUrl,
        wasInAppBrowser,
        currentUser: auth.currentUser ? auth.currentUser.email : 'none',
        timeSinceRedirect: redirectTimestamp ? `${(Date.now() - parseInt(redirectTimestamp)) / 1000}s ago` : 'N/A'
    });
    
    // ✅ MOBILE FIX: If we have a pending redirect and auth.currentUser already exists,
    // use it immediately (Firebase restored the session from cache)
    if (redirectType && redirectTimestamp && auth.currentUser) {
        const timeSinceRedirect = Date.now() - parseInt(redirectTimestamp);
        if (timeSinceRedirect < 300000) { // Within 5 minutes
            safeConsoleLog('✅ FAST PATH: auth.currentUser already exists after redirect!');
            safeConsoleLog('👤 User:', auth.currentUser.email);

            // Keep auth_redirect_url for resolvePostLoginRedirect → booking form
            clearOAuthRedirectMarkers({ keepReturnUrl: true });

            return {
                success: true,
                user: auth.currentUser,
                credential: null,
                providerId: auth.currentUser.providerData?.[0]?.providerId || redirectType,
                needsVerification: false,
                isNewUser: false,
                method: 'auth-current-user-fast'
            };
        }
    }
    
    try {
        // ✅ CRITICAL: getRedirectResult() must run FIRST before any other Firebase auth operations
        // This retrieves the OAuth result that Firebase stored in sessionStorage during redirect
        safeConsoleLog('⏳ Calling getRedirectResult(auth)...');
        
        let result = null;
        const isInApp = isInAppBrowser();
        const isMobile = isMobileDevice();
        
        // ✅ ENHANCED: More retries for real mobile devices (5 attempts)
        const maxRetries = (isInApp || wasInAppBrowser) ? 5 : (isMobile ? 5 : 3);
        
        // ✅ MOBILE & IN-APP BROWSER FIX: Retry mechanism for slow/unreliable connections
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                safeConsoleLog(`📱 Attempt ${attempt}/${maxRetries} to get redirect result...`);
                
                // ✅ MOBILE FIX: Wait before each attempt on mobile
                // Real mobile browsers often need time to restore state
                if (isMobile) {
                    const waitTime = attempt === 1 ? 500 : 300 * attempt;
                    safeConsoleLog(`⏳ Mobile: waiting ${waitTime}ms before attempt...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                result = await getRedirectResult(auth);
                
                if (result && result.user) {
                    safeConsoleLog(`✅ Got result on attempt ${attempt}`);
                    break;
                }
                
                // ✅ Also check auth.currentUser as backup (sometimes redirect result is null but user is set)
                if (!result?.user && auth.currentUser && redirectType) {
                    safeConsoleLog('📱 No redirect result but auth.currentUser exists!');
                    const timeSinceRedirect = redirectTimestamp ? (Date.now() - parseInt(redirectTimestamp)) : Infinity;
                    if (timeSinceRedirect < 300000) { // Within 5 minutes
                        safeConsoleLog('✅ Using auth.currentUser as redirect result (mobile fallback)');
                        result = { user: auth.currentUser, credential: null };
                        break;
                    }
                }
                
                // ✅ If no result yet and we have a pending redirect, wait and retry
                if (!result?.user && redirectType && attempt < maxRetries) {
                    safeConsoleLog(`⏳ No result yet, will retry... (attempt ${attempt}/${maxRetries})`);
                }
            } catch (attemptError) {
                safeConsoleWarn(`⚠️ Attempt ${attempt} failed:`, attemptError.code, attemptError.message);
                
                if (attempt < maxRetries) {
                    // ✅ Progressive backoff: wait longer on each retry
                    const baseWait = isMobile ? 1000 : 500;
                    const waitTime = baseWait * attempt;
                    safeConsoleLog(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // On last attempt, check auth.currentUser before giving up
                    if (auth.currentUser && redirectType) {
                        safeConsoleLog('✅ Last resort: using auth.currentUser');
                        result = { user: auth.currentUser, credential: null };
                    } else {
                        throw attemptError;
                    }
                }
            }
        }
        
        if (result && result.user) {
            safeConsoleLog('✅ REDIRECT RESULT FOUND - User authenticated successfully!');
            safeConsoleLog('👤 User details:', {
                email: result.user.email,
                uid: result.user.uid,
                displayName: result.user.displayName,
                provider: result.providerId || result.user.providerData?.[0]?.providerId,
                isNewUser: result._tokenResponse?.isNewUser || false,
                wasInAppBrowser: wasInAppBrowser === 'true'
            });
            
            // Keep auth_redirect_url so App can send the user back to /book
            clearOAuthRedirectMarkers({ keepReturnUrl: true });

            return {
                success: true,
                user: result.user,
                credential: result.credential,
                providerId: result.providerId || result.user.providerData?.[0]?.providerId,
                needsVerification: false,
                isNewUser: result._tokenResponse?.isNewUser || false,
                method: wasInAppBrowser === 'true' ? 'in-app-redirect-result' : 'redirect-result'
            };
        } else {
            safeConsoleLog('ℹ️ No redirect result found');
            
            // If we had a pending redirect but no result, it might have expired or failed
            if (redirectType && redirectTimestamp) {
                const elapsed = Date.now() - parseInt(redirectTimestamp);
                if (elapsed > 300000) { // 5 minutes
                    safeConsoleWarn('⚠️ Redirect seems to have timed out (>5 min)');
                    sessionStorage.removeItem('auth_redirect_type');
                    sessionStorage.removeItem('auth_redirect_timestamp');
                    sessionStorage.removeItem('auth_redirect_url');
                    sessionStorage.removeItem('auth_in_app_browser');
                }
            }
            
            return null; // No redirect result - this is normal for fresh page loads
        }
    } catch (error) {
        safeConsoleError('❌ Redirect result error:', error);
        safeConsoleError('Error details:', {
            code: error.code,
            message: error.message,
            name: error.name
        });
        
        // ✅ LAST RESORT: Check if auth.currentUser exists despite the error
        if (auth.currentUser && redirectType) {
            safeConsoleLog('✅ Error occurred but auth.currentUser exists - using it');

            clearOAuthRedirectMarkers({ keepReturnUrl: true });

            return {
                success: true,
                user: auth.currentUser,
                credential: null,
                providerId: auth.currentUser.providerData?.[0]?.providerId || redirectType,
                needsVerification: false,
                isNewUser: false,
                method: 'auth-current-user-fallback'
            };
        }
        
        // Clear ALL redirect markers on error
        sessionStorage.removeItem('auth_redirect_type');
        sessionStorage.removeItem('auth_redirect_timestamp');
        sessionStorage.removeItem('auth_redirect_url');
        sessionStorage.removeItem('auth_in_app_browser');
        
        let errorMessage = 'Authentication failed after redirect. Please try again.';
        
        if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'An account already exists with this email using a different sign-in method.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'This user account has been disabled. Please contact support.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = 'This domain is not authorized for authentication. Please contact support.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error during authentication. Please check your connection and try again.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid authentication credential. Please try signing in again.';
        }
        
        return {
            success: false,
            error: errorMessage,
            code: error.code,
            method: 'redirect-result-error'
        };
    }
};

export { signOut };
