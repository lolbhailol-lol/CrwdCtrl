import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import { getAuth } from "firebase/auth";
import { isNativeApp } from "../utils/capacitorPlatform";
import { safeConsoleLog, safeConsoleWarn } from "../utils/safeLog";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase — never console.log(firebaseConfig) (exposes apiKey)
const app = initializeApp(firebaseConfig);
let analytics = null;
// Skip Firebase Analytics on web when gtag.js (GA4) is configured in index.html,
// so page views are not double-counted into the same GA4 property.
if (!isNativeApp() && typeof window !== 'undefined' && !import.meta.env.VITE_GOOGLE_ANALYTICS_ID) {
    try {
        analytics = getAnalytics(app);
    } catch {
        /* analytics unavailable */
    }
}
const auth = getAuth(app);

// ===== FIREBASE PERFORMANCE MONITORING =====
// Real-user performance traces (page load, network requests). Web-only SDK,
// so it is skipped inside the Capacitor native shell. Enabled in production by
// default; set VITE_ENABLE_PERFORMANCE=true to also collect it in dev.
let performance = null;
try {
    const perfEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_PERFORMANCE === 'true';
    if (perfEnabled && !isNativeApp() && typeof window !== 'undefined') {
        performance = getPerformance(app);
        safeConsoleLog('Firebase Performance Monitoring initialized');
    }
} catch (err) {
    safeConsoleWarn('Firebase Performance not available:', err);
}

export { app, auth, analytics, performance };
