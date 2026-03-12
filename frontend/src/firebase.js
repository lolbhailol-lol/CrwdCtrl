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
    browserLocalPersistence
    // connectAuthEmulator - Not used currently
} from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const VITE_FIREBASE_API_KEY="AIzaSyDoyaNIB6GPi4mfn9Wi1YT5rL3o_A-3N9A"
const VITE_FIREBASE_AUTH_DOMAIN="crwdctrl.firebaseapp.com"
const VITE_FIREBASE_PROJECT_ID="crwdctrl"
const VITE_FIREBASE_STORAGE_BUCKET="crwdctrl.firebasestorage.app"
const VITE_FIREBASE_MESSAGING_SENDER_ID="420309062914"
const VITE_FIREBASE_APP_ID="1:420309062914:web:73bb8e49df575f90dd9e1b"
const VITE_FIREBASE_MEASUREMENT_ID="G-V080C13RPJ"

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

// ===== FIREBASE CLOUD MESSAGING (Push Notifications) =====
let messaging = null;
try {
    // FCM only works in browsers that support service workers
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        messaging = getMessaging(app);
        console.log('✅ Firebase Messaging initialized');
    }
} catch (err) {
    console.warn('⚠️ Firebase Messaging not available:', err.message);
}

/**
 * Request notification permission and get FCM token.
 * Returns the token string or null.
 */
export const requestNotificationPermission = async () => {
    try {
        if (!messaging) {
            console.warn('⚠️ Firebase Messaging not initialized');
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('🔕 Notification permission denied');
            return null;
        }

        // Register the service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Get the FCM token (uses VAPID key if set in env, otherwise auto-generated)
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
        const fcmToken = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });

        console.log('🔔 FCM Token obtained:', fcmToken ? 'yes' : 'no');
        return fcmToken;
    } catch (error) {
        console.error('❌ Error getting FCM token:', error);
        return null;
    }
};

/**
 * Listen for foreground messages.
 * @param {function} callback - Called with the message payload.
 * @returns {function} Unsubscribe function.
 */
export const onForegroundMessage = (callback) => {
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
};

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
                console.log('✅ Firebase persistence set to LOCAL');
                return true;
            })
            .catch((error) => {
                console.error('❌ Failed to set Firebase persistence:', error);
                return false;
            })
            .finally(() => {
                if (!persistenceInitialized) {
                    persistencePromise = null;
                }
            });

        return persistencePromise;
    } catch (error) {
        console.error('❌ Failed to set Firebase persistence:', error);
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
    console.log('✅ Firebase initialization complete');
    return true;
}).catch(error => {
    console.error('⚠️ Firebase initialization issue:', error);
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
const isMobileDevice = () => {
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
    
    console.log('📱 Mobile Detection (ENHANCED):', {
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
        console.log('🚨 In-app browser detected:', userAgent.substring(0, 100));
    }
    
    return isInApp;
};

// ✅ POPUP-FIRST GOOGLE SIGN-IN FOR ALL DEVICES (WITH MOBILE FIX)
export const signInWithGoogle = async () => {
    console.log('🚀 Starting Google authentication...');
    
    // Keep popup launches tied to the original tap; mobile browsers can block them
    // if we await other async work before opening the auth window.
    ensurePersistenceStarted();
    
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

    // ✅ STEP 1: Handle in-app browsers (Instagram, Facebook, etc.)
    // In-app browsers have SEVERE limitations with OAuth:
    // - Instagram WebView blocks third-party cookies
    // - Google Sign-In requires cookies for state management
    // - signInWithRedirect often fails silently or throws empty errors
    // SOLUTION: Show user a clear message to open in a real browser
    if (isInApp) {
        console.log('🚨 IN-APP BROWSER DETECTED (Instagram, Facebook, etc.)');
        console.log('🚨 Instagram browser detected - authentication may not work properly');
        
        // Detect specific in-app browser for better messaging
        const userAgent = navigator.userAgent || '';
        const isInstagram = /Instagram/i.test(userAgent);
        const isFacebook = /FBAN|FBAV/i.test(userAgent);
        const isTikTok = /TikTok/i.test(userAgent);
        
        let appName = 'this app';
        if (isInstagram) appName = 'Instagram';
        else if (isFacebook) appName = 'Facebook';
        else if (isTikTok) appName = 'TikTok';
        
        // Generate "Open in Browser" URL for user
        const currentUrl = window.location.href;
        const openInBrowserUrl = currentUrl;
        
        try {
            // Store return URL and mark as in-app browser auth attempt
            sessionStorage.setItem('auth_redirect_url', window.location.href);
            sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            sessionStorage.setItem('auth_redirect_type', 'google');
            sessionStorage.setItem('auth_in_app_browser', 'true');
            
            console.log('➡️ Attempting Google redirect flow for in-app browser (may fail)...');
            
            // Set a timeout to detect if redirect failed silently
            const redirectTimeout = setTimeout(() => {
                console.log('⚠️ Redirect did not happen within 3 seconds - likely blocked');
            }, 3000);
            
            await signInWithRedirect(auth, googleProvider);
            
            clearTimeout(redirectTimeout);
            
            // This typically won't execute - browser will redirect
            return {
                success: true,
                user: null,
                credential: null,
                needsVerification: false,
                method: 'in-app-redirect',
                redirectInitiated: true,
                message: 'Redirecting to Google sign-in...'
            };
        } catch (inAppError) {
            console.error('❌ In-app browser redirect failed:', inAppError);
            console.error('❌ Error details:', {
                message: inAppError?.message,
                code: inAppError?.code,
                name: inAppError?.name,
                stack: inAppError?.stack
            });
            
            // If redirect fails in in-app browser, show helpful message
            // This catches both explicit errors AND silent failures (empty Error objects)
            const errorMessage = inAppError?.message || inAppError?.code || '';
            const isEmptyError = !errorMessage || errorMessage === '[object Object]';
            
            return {
                success: false,
                error: isEmptyError 
                    ? `Google Sign-In doesn't work in ${appName}'s browser. Please tap the ⋯ menu and select "Open in Chrome" or "Open in Safari".`
                    : `Google sign-in had an issue in ${appName}. Try: 1) Tap ⋮ menu → "Open in Chrome/Safari", or 2) Copy the link and open in your browser.`,
                code: inAppError?.code || 'auth/in-app-browser-blocked',
                method: 'in-app-redirect-failed',
                showOpenInBrowser: true,
                isInAppBrowser: true,
                appName: appName,
                openInBrowserUrl: openInBrowserUrl,
                errorDetails: {
                    icon: '📱',
                    title: `${appName} Browser Limitation`,
                    suggestion: `Google Sign-In is blocked in ${appName}'s browser`,
                    instructions: 'Tap the ⋮ or ⋯ menu at the top and select "Open in Browser" or "Open in Chrome/Safari"',
                    copyUrl: openInBrowserUrl
                }
            };
        }
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
        console.log('📱 MOBILE DEVICE - Using POPUP flow (signInWithRedirect broken on Chrome 115+/Safari 17+ due to cookie policies)');
        
        try {
            const result = await signInWithPopup(auth, googleProvider);
            
            if (result && result.user) {
                console.log('✅ Mobile Google popup sign-in successful:', result.user.email);
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
            console.error('❌ Mobile Google popup failed:', popupError);
            
            // Popup blocked by browser - fall back to redirect
            if (popupError.code === 'auth/popup-blocked') {
                console.log('🔄 Mobile popup blocked, falling back to redirect...');
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
    console.log('🖥️ DESKTOP DEVICE - Using POPUP flow');
    
    try {
        console.log('➡️ Opening Google sign-in popup (desktop)...');
        const result = await signInWithPopup(auth, googleProvider);
        
        if (result && result.user) {
            console.log('✅ Google popup sign-in successful:', result.user.email);
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
        console.error('❌ Desktop Google popup failed:', popupError);
        
        // If popup is blocked, fall back to redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
            console.log('🔄 Popup blocked/closed, falling back to redirect flow...');
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
                console.error('❌ Redirect fallback also failed:', redirectError);
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

// ✅ REDIRECT-FIRST FACEBOOK SIGN-IN (AVOIDS COOP WARNINGS)
export const signInWithFacebook = async () => {
    console.log('🚀 Starting Facebook authentication...');
    
    // Keep popup launches tied to the original tap event.
    ensurePersistenceStarted();
    
    const isInApp = isInAppBrowser();
    
    // ✅ Handle in-app browsers - try redirect flow (it may work)
    if (isInApp) {
        console.log('📱 IN-APP BROWSER DETECTED - Attempting redirect-based Facebook OAuth');
        
        try {
            sessionStorage.setItem('auth_redirect_url', window.location.href);
            sessionStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            sessionStorage.setItem('auth_redirect_type', 'facebook');
            sessionStorage.setItem('auth_in_app_browser', 'true');
            
            console.log('➡️ Initiating Facebook redirect flow for in-app browser...');
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
            console.error('❌ In-app browser Facebook redirect failed:', inAppError);
            
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
        console.log('🖥️ Using popup-first Facebook authentication (desktop)...');
        try {
            const result = await signInWithPopup(auth, facebookProvider);
            if (result && result.user) {
                console.log('✅ Facebook popup sign-in successful:', result.user.email);
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
            console.error('❌ Facebook popup failed:', popupError);
            if (popupError.code !== 'auth/popup-blocked' && popupError.code !== 'auth/popup-closed-by-user') {
                // Not a popup-blocked error, return the error
                let errorMessage = 'Facebook sign-in failed. Please try again.';
                if (popupError.code === 'auth/account-exists-with-different-credential') {
                    errorMessage = 'An account already exists with this email. Please use your original sign-in method.';
                }
                return { success: false, error: errorMessage, code: popupError.code, method: 'desktop-popup-failed' };
            }
            console.log('🔄 Popup blocked, falling back to redirect...');
            // Fall through to redirect below
        }
    }
    
    // Mobile: Use popup (signInWithRedirect broken on Chrome 115+/Safari 17+ due to cookie policies)
    console.log('📱 Mobile Facebook - Using POPUP flow...');
    
    try {
        const result = await signInWithPopup(auth, facebookProvider);
        if (result && result.user) {
            console.log('✅ Mobile Facebook popup sign-in successful:', result.user.email);
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
        console.error('❌ Mobile Facebook popup failed:', popupError);
        
        // Popup blocked - fall back to redirect
        if (popupError.code === 'auth/popup-blocked') {
            console.log('🔄 Mobile popup blocked, falling back to redirect...');
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

// ✅ CRITICAL: Handle redirect result for mobile authentication - MUST RUN FIRST ON PAGE LOAD
// This function is called by AuthContext on app initialization to check if user is returning
// from a Google/Facebook OAuth redirect. On mobile, this is the ONLY way to get the auth result.
export const handleRedirectResult = async () => {
    console.log('🔍 Processing redirect result (CRITICAL for mobile OAuth)...');
    
    // Check if we have a pending redirect
    const redirectType = sessionStorage.getItem('auth_redirect_type');
    const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
    const redirectUrl = sessionStorage.getItem('auth_redirect_url');
    const wasInAppBrowser = sessionStorage.getItem('auth_in_app_browser');
    
    console.log('📋 Redirect context:', {
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
            console.log('✅ FAST PATH: auth.currentUser already exists after redirect!');
            console.log('👤 User:', auth.currentUser.email);
            
            // Clear redirect markers
            sessionStorage.removeItem('auth_redirect_type');
            sessionStorage.removeItem('auth_redirect_timestamp');
            sessionStorage.removeItem('auth_redirect_url');
            sessionStorage.removeItem('auth_in_app_browser');
            
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
        console.log('⏳ Calling getRedirectResult(auth)...');
        
        let result = null;
        const isInApp = isInAppBrowser();
        const isMobile = isMobileDevice();
        
        // ✅ ENHANCED: More retries for real mobile devices (5 attempts)
        const maxRetries = (isInApp || wasInAppBrowser) ? 5 : (isMobile ? 5 : 3);
        
        // ✅ MOBILE & IN-APP BROWSER FIX: Retry mechanism for slow/unreliable connections
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📱 Attempt ${attempt}/${maxRetries} to get redirect result...`);
                
                // ✅ MOBILE FIX: Wait before each attempt on mobile
                // Real mobile browsers often need time to restore state
                if (isMobile) {
                    const waitTime = attempt === 1 ? 500 : 300 * attempt;
                    console.log(`⏳ Mobile: waiting ${waitTime}ms before attempt...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                result = await getRedirectResult(auth);
                
                if (result && result.user) {
                    console.log(`✅ Got result on attempt ${attempt}`);
                    break;
                }
                
                // ✅ Also check auth.currentUser as backup (sometimes redirect result is null but user is set)
                if (!result?.user && auth.currentUser && redirectType) {
                    console.log('📱 No redirect result but auth.currentUser exists!');
                    const timeSinceRedirect = redirectTimestamp ? (Date.now() - parseInt(redirectTimestamp)) : Infinity;
                    if (timeSinceRedirect < 300000) { // Within 5 minutes
                        console.log('✅ Using auth.currentUser as redirect result (mobile fallback)');
                        result = { user: auth.currentUser, credential: null };
                        break;
                    }
                }
                
                // ✅ If no result yet and we have a pending redirect, wait and retry
                if (!result?.user && redirectType && attempt < maxRetries) {
                    console.log(`⏳ No result yet, will retry... (attempt ${attempt}/${maxRetries})`);
                }
            } catch (attemptError) {
                console.warn(`⚠️ Attempt ${attempt} failed:`, attemptError.code, attemptError.message);
                
                if (attempt < maxRetries) {
                    // ✅ Progressive backoff: wait longer on each retry
                    const baseWait = isMobile ? 1000 : 500;
                    const waitTime = baseWait * attempt;
                    console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // On last attempt, check auth.currentUser before giving up
                    if (auth.currentUser && redirectType) {
                        console.log('✅ Last resort: using auth.currentUser');
                        result = { user: auth.currentUser, credential: null };
                    } else {
                        throw attemptError;
                    }
                }
            }
        }
        
        if (result && result.user) {
            console.log('✅ REDIRECT RESULT FOUND - User authenticated successfully!');
            console.log('👤 User details:', {
                email: result.user.email,
                uid: result.user.uid,
                displayName: result.user.displayName,
                provider: result.providerId || result.user.providerData?.[0]?.providerId,
                isNewUser: result._tokenResponse?.isNewUser || false,
                wasInAppBrowser: wasInAppBrowser === 'true'
            });
            
            // Clear ALL redirect markers including in-app browser flag
            sessionStorage.removeItem('auth_redirect_type');
            sessionStorage.removeItem('auth_redirect_timestamp');
            sessionStorage.removeItem('auth_redirect_url');
            sessionStorage.removeItem('auth_in_app_browser');
            
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
            console.log('ℹ️ No redirect result found');
            
            // If we had a pending redirect but no result, it might have expired or failed
            if (redirectType && redirectTimestamp) {
                const elapsed = Date.now() - parseInt(redirectTimestamp);
                if (elapsed > 300000) { // 5 minutes
                    console.warn('⚠️ Redirect seems to have timed out (>5 min)');
                    sessionStorage.removeItem('auth_redirect_type');
                    sessionStorage.removeItem('auth_redirect_timestamp');
                    sessionStorage.removeItem('auth_redirect_url');
                    sessionStorage.removeItem('auth_in_app_browser');
                }
            }
            
            return null; // No redirect result - this is normal for fresh page loads
        }
    } catch (error) {
        console.error('❌ Redirect result error:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            name: error.name
        });
        
        // ✅ LAST RESORT: Check if auth.currentUser exists despite the error
        if (auth.currentUser && redirectType) {
            console.log('✅ Error occurred but auth.currentUser exists - using it');
            
            sessionStorage.removeItem('auth_redirect_type');
            sessionStorage.removeItem('auth_redirect_timestamp');
            sessionStorage.removeItem('auth_redirect_url');
            sessionStorage.removeItem('auth_in_app_browser');
            
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

// ✅ Export mobile detection for use in other modules
export { isMobileDevice };

export { auth, app, analytics, signOut };