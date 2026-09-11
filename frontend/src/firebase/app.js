import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import { getAuth } from "firebase/auth";
import { isNativeApp } from "../utils/capacitorPlatform";
import { safeConsoleLog, safeConsoleWarn } from "../utils/safeLog";

function envString(value) {
    const s = String(value || "").trim();
    if (!s || s.includes("%VITE_")) return "";
    return s;
}

const measurementId = envString(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);
const ga4Id = envString(import.meta.env.VITE_GOOGLE_ANALYTICS_ID);

const firebaseConfig = {
    apiKey: envString(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: envString(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: envString(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: envString(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: envString(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: envString(import.meta.env.VITE_FIREBASE_APP_ID),
};
if (measurementId) firebaseConfig.measurementId = measurementId;

// Initialize Firebase — never console.log(firebaseConfig) (exposes apiKey)
const app = initializeApp(firebaseConfig);
let analytics = null;

function shouldInitFirebaseAnalytics() {
    if (isNativeApp() || typeof window === "undefined") return false;
    // index.html already loads gtag.js for this GA4 property — don't double-count
    if (ga4Id) return false;
    // Local Vite: skip unless explicitly enabled (gtag throws `undefined.M_ID` on every fetch)
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS !== "true") {
        return false;
    }
    // gtag crashes if Analytics starts without a G- measurement ID
    return /^G-[A-Z0-9]+$/i.test(measurementId);
}

if (shouldInitFirebaseAnalytics()) {
    isAnalyticsSupported()
        .then((ok) => {
            if (!ok) return;
            analytics = getAnalytics(app);
        })
        .catch(() => {
            /* ad blockers / missing gtag config */
        });
}
const auth = getAuth(app);

// ===== FIREBASE PERFORMANCE MONITORING =====
// Real-user performance traces (page load, network requests). Web-only SDK,
// so it is skipped inside the Capacitor native shell. Enabled in production by
// default; set VITE_ENABLE_PERFORMANCE=true to also collect it in dev.
let performance = null;
try {
    const perfEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_PERFORMANCE === "true";
    if (perfEnabled && !isNativeApp() && typeof window !== "undefined") {
        performance = getPerformance(app);
        safeConsoleLog("Firebase Performance Monitoring initialized");
    }
} catch (err) {
    safeConsoleWarn("Firebase Performance not available:", err);
}

export { app, auth, analytics, performance };
