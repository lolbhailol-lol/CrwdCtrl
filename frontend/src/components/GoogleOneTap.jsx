import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { isNativeApp } from '../utils/capacitorPlatform';
import { isLoginModalOpen } from '../utils/loginFlow';

/**
 * Google One Tap sign-in (optional UX).
 *
 * Regular Google button on /login uses Firebase popup/redirect and does NOT
 * need FedCM. This component only shows the floating One Tap chip for logged-out
 * browsing — and must not spam the console when the user disabled third-party
 * sign-in in Chrome (FedCM).
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SKIP_KEY = 'crwdctrl_gsi_one_tap_skip';

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

function markOneTapSkipped() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1');
  } catch {
    /* ignore */
  }
}

function isOneTapSkipped() {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

function ensureGisInitialized(google, callback) {
  if (!google?.accounts?.id || !CLIENT_ID) return false;
  // Only initialize once — repeat calls log "only the last initialized instance…"
  if (gisInitializedForClient === CLIENT_ID) {
    return true;
  }
  try {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      context: 'signin',
      auto_select: false,
      cancel_on_tap_outside: true,
      // false = legacy One Tap (works when user disabled FedCM / third-party sign-in).
      // true forces FedCM and prints the console warning you're seeing.
      use_fedcm_for_prompt: false,
      callback,
    });
    gisInitializedForClient = CLIENT_ID;
    return true;
  } catch {
    markOneTapSkipped();
    return false;
  }
}

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
    if (isOneTapSkipped()) return undefined;
    if (shouldSuppressOneTap(pathname)) {
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {
        /* ignore */
      }
      return undefined;
    }
    if (isAuthenticated || isLoading || isRedirectProcessing || isAuthProcessing) return undefined;
    if (isLoginModalOpen()) return undefined;
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
          } catch {
            /* password / Google button login still available */
          }
        });
        if (!ok || cancelled) return;

        promptedRef.current = true;
        try {
          google.accounts.id.prompt((notification) => {
            const skipped = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
            if (skipped) {
              // FedCM disabled, dismissed, or suppressed — stop retrying this session
              markOneTapSkipped();
              promptedRef.current = false;
            }
          });
        } catch {
          markOneTapSkipped();
          promptedRef.current = false;
        }
      })
      .catch(() => {
        markOneTapSkipped();
      });

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {
        /* ignore */
      }
    };
  }, [isAuthenticated, isLoading, isRedirectProcessing, isAuthProcessing, pathname]);

  return null;
}
