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
let gisInitializedForClient = null;

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

function ensureGisInitialized(google, callback) {
  if (!google?.accounts?.id || !CLIENT_ID) return false;
  // Calling initialize() repeatedly logs "only the last initialized instance
  // will be used" and can break FedCM / One Tap. Init once per client id.
  if (gisInitializedForClient === CLIENT_ID) {
    return true;
  }
  try {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      context: 'signin',
      auto_select: false,
      cancel_on_tap_outside: true,
      // Prefer FedCM when available; GIS falls back when the user disabled it.
      use_fedcm_for_prompt: true,
      callback,
    });
    gisInitializedForClient = CLIENT_ID;
    return true;
  } catch (err) {
    console.warn('Google One Tap init failed:', err?.message || err);
    return false;
  }
}

// One Tap is redundant (and would compete with the Google button) on dedicated
// auth / admin / organizer screens — never run it there.
function shouldSuppressOneTap(pathname = '') {
  return (
    pathname === '/login'
    || pathname === '/register'
    || pathname === '/verify-email'
    || pathname.startsWith('/admin')
    || pathname.startsWith('/trek-organizer')
    || pathname.startsWith('/run-club-organizer')
  );
}

export default function GoogleOneTap() {
  const { isAuthenticated, isLoading, isRedirectProcessing, isAuthProcessing } = useAuth();
  const { pathname } = useLocation();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || isNativeApp()) return undefined;
    if (shouldSuppressOneTap(pathname)) {
      window.google?.accounts?.id?.cancel?.();
      return undefined;
    }
    // Wait until auth has settled and the user is definitely logged out.
    if (isAuthenticated || isLoading || isRedirectProcessing || isAuthProcessing) return undefined;
    if (promptedRef.current) return undefined;
    if (auth.currentUser) return undefined;

    let cancelled = false;

    loadGis()
      .then((google) => {
        if (cancelled || !google?.accounts?.id) return;

        const ok = ensureGisInitialized(google, async (response) => {
          if (!response?.credential) return;
          try {
            const credential = GoogleAuthProvider.credential(response.credential);
            await signInWithCredential(auth, credential);
          } catch (err) {
            console.warn('One Tap sign-in failed:', err?.message || err);
          }
        });
        if (!ok || cancelled) return;

        promptedRef.current = true;
        try {
          google.accounts.id.prompt((notification) => {
            // User dismissed / FedCM disabled — stay quiet; password login still works.
            if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
              promptedRef.current = false;
            }
          });
        } catch (err) {
          promptedRef.current = false;
          console.warn('Google One Tap prompt failed:', err?.message || err);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      promptedRef.current = false;
      window.google?.accounts?.id?.cancel?.();
    };
  }, [isAuthenticated, isLoading, isRedirectProcessing, isAuthProcessing, pathname]);

  return null;
}
