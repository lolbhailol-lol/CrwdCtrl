import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

const isInstagramBrowser = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('instagram') || ua.includes('fban') || ua.includes('fbav');
};

const isMobileDevice = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  const mobile = /android|iphone|ipad|ipod/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || ('ontouchstart' in window);
  return mobile && hasTouch;
};

export const googleAuthService = {
  initializeRedirectResult: async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        console.log('[OAuth] Redirect result found:', result.user.email);
      }
      return result;
    } catch (error) {
      console.error('[OAuth] Redirect error:', error);
      throw error;
    }
  },

  signIn: async () => {
    try {
      const instagram = isInstagramBrowser();
      const mobile = isMobileDevice();

      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      if (instagram || mobile) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      return result;
    } catch (error: any) {
      console.error('[OAuth] Sign-in error:', error.message);

      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked');
      }
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled');
      }

      throw new Error(error.message || 'Sign-in failed');
    }
  },

  signOut: async () => {
    await auth.signOut();
  },

  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  onAuthStateChange: (callback: (user: User | null) => void) => {
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
