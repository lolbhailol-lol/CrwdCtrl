export {
    getFcmTokenIfGranted,
    requestNotificationPermission,
    onForegroundMessage,
} from './messaging.js';

export {
    firebaseReady,
    signInWithGoogle,
    signInWithFacebook,
    registerWithEmail,
    loginWithEmail,
    sendVerificationEmail,
    verifyEmail,
    onAuthStateChange,
    getCurrentUser,
    handleRedirectResult,
    isMobileDevice,
    signOut,
} from './auth.js';

export {
    auth,
    app,
    analytics,
    performance,
} from './app.js';
