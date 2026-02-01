import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User,
  AuthError,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

const isInstagramBrowser = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('instagram') ||
    ua.includes('fban') ||
    ua.includes('fbav') ||
    ua.includes('fb4a') ||
    ua.includes('messenger')
  );
};

const isMobileDevice = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  const mobile = /android|iphone|ipad|ipod/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  return mobile && hasTouch;
};

const logOAuth = (context: string, data: Record<string, any>): void => {
  console.log(`[OAuth/${context}]`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
};

const logOAuthError = (context: string, error: any): void => {
  console.error(`[OAuth/${context}]`, {
    message: error?.message,
    code: error?.code,
    timestamp: new Date().toISOString(),
  });
};

export const googleAuthService = {
  initializeRedirectResult: async (): Promise<any> => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        logOAuth('RedirectResult', { email: result.user.email });
      }
      return result;
    } catch (error: any) {
      logOAuthError('RedirectResult', error);
      throw error;
    }
  },

  // ✅ ALWAYS use redirect - popup is unreliable on real mobile devices
  signIn: async (): Promise<any> => {
    try {
      const instagram = isInstagramBrowser();
      const mobile = isMobileDevice();

      logOAuth('SignIn', { instagram, mobile, method: 'redirect-always' });

      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      // ✅ ALWAYS use redirect for ALL devices
      // Popup fails on real mobile devices (auth/popup-closed-by-user)
      sessionStorage.setItem('oauth_intent', 'google-signin');
      sessionStorage.setItem('oauth_timestamp', Date.now().toString());
      await signInWithRedirect(auth, provider);
      return; // Browser redirects to Google
    } catch (error: any) {
      logOAuthError('SignIn', error);

      if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.');
      }

      throw new Error(error.message || 'Sign-in failed');
    }
  },

  signOut: async (): Promise<void> => {
    await auth.signOut();
  },

  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  onAuthStateChange: (callback: (user: User | null) => void): (() => void) => {
    return onAuthStateChanged(auth, callback);
  },

  getIdToken: async (forceRefresh = false): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    return user.getIdToken(forceRefresh);
  },

  isInstagram: isInstagramBrowser,
  isMobile: isMobileDevice,

  getBrowserInfo: () => ({
    instagram: isInstagramBrowser(),
    mobile: isMobileDevice(),
    ua: navigator.userAgent,
  }),
};

export default googleAuthService;
