import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { isNativeApp } from '../utils/capacitorPlatform';

/**
 * Google One Tap sign-in.
 *
 * Renders nothing — it shows Google's native One Tap prompt to logged-out web
 * users. On success it signs into Firebase with the returned credential, and
 * AuthContext's auth-state listener completes the backend session + login the
 * same way the regular Google button does.
 *
 * Dormant unless VITE_GOOGLE_CLIENT_ID is set (must be the Firebase project's
 * Web OAuth client ID, with this site listed under "Authorized JavaScript
 * origins" in Google Cloud). Skipped inside the Capacitor native shell, which
 * uses native Google Sign-In instead.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

// One Tap is redundant (and would compete with the Google button) on the
// dedicated auth screens, so it never runs there.
const SUPPRESSED_PATHS = ['/login', '/register', '/verify-email'];

export default function GoogleOneTap() {
  const { isAuthenticated, isLoading, isRedirectProcessing, isAuthProcessing } = useAuth();
  const { pathname } = useLocation();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || isNativeApp()) return undefined;
    if (SUPPRESSED_PATHS.includes(pathname)) return undefined;
    // Wait until auth has settled and the user is definitely logged out.
    if (isAuthenticated || isLoading || isRedirectProcessing || isAuthProcessing) return undefined;
    if (promptedRef.current) return undefined;
    if (auth.currentUser) return undefined;

    let cancelled = false;

    loadGis()
      .then((google) => {
        if (cancelled || !google?.accounts?.id) return;
        promptedRef.current = true;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          context: 'signin',
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            if (!response?.credential) return;
            try {
              const credential = GoogleAuthProvider.credential(response.credential);
              await signInWithCredential(auth, credential);
              // AuthContext's onAuthStateChange listener syncs the backend
              // session and fires the login flow — nothing else needed here.
            } catch (err) {
              console.warn('One Tap sign-in failed:', err?.message || err);
            }
          },
        });

        google.accounts.id.prompt();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      // Reset so the prompt can be shown again on a later run (e.g. the user
      // navigates while still logged out). Without this, One Tap would only ever
      // appear once per session because this component stays mounted app-wide.
      promptedRef.current = false;
      // Dismiss any prompt that is still on screen for this run.
      window.google?.accounts?.id?.cancel?.();
    };
  }, [isAuthenticated, isLoading, isRedirectProcessing, isAuthProcessing, pathname]);

  return null;
}
