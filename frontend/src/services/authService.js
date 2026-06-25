/**
 * Unified Authentication Service
 * 
 * Single source of truth for all authentication operations
 * Handles: Email/Password, Google, Facebook, Admin login
 * Mobile-optimized with proper error handling and retry logic
 */

import { authAPI } from './api/auth.api.js';
import { resolveUrl } from './api/client.js';
import { getUserAuthHeaders } from './api/auth.api.js';
import { storage } from '../utils/storage';
import { signInWithGoogle, signInWithFacebook, registerWithEmail, auth } from '../firebase';
import { processSocialAuthUser } from '../utils/socialAuth';
import { withFirebaseIdToken } from '../utils/firebaseIdToken';
import { AUTH_CONFIG, API_CONFIG } from '../config/env.js';
import { isNativeApp } from '../utils/capacitorPlatform';
import { setNativeAuthInProgress } from '../utils/nativeAuth';

// ✅ FIX: Use config token keys to avoid dev/prod mismatch
const TOKEN_KEY = AUTH_CONFIG.TOKEN_KEY || 'crwdctrl_token';
const USER_KEY = 'crwdctrl_user';
const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_REFRESH_TOKEN_KEY = 'admin_refresh_token';

class AuthService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.setupNetworkListener();
    }

    /**
     * Setup network status listener
     */
    setupNetworkListener() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🟢 Network: ONLINE');
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('🔴 Network: OFFLINE');
        });
    }

    /**
     * Check network status before making requests
     */
    checkNetworkStatus() {
        if (!this.isOnline || !navigator.onLine) {
            throw new Error('No internet connection. Please check your network and try again.');
        }
        return true;
    }

    /**
     * Email/Password Login
     */
    async loginWithEmail(email, password, options = {}) {
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Starting email login...');

            // The admin probe normally hangs the native app when the backend is slow,
            // so it is skipped on native — EXCEPT on the /admin/login screen, where the
            // user explicitly intends to sign in as admin (options.adminProbe = true).
            // Without this, admin credentials fall through to user login in the app and
            // the admin token is never stored, so the admin panel is unreachable.
            if (!isNativeApp() || options.adminProbe) {
            try {
                const adminResponse = await authAPI.adminLogin({ email: email.trim(), password });
                
                if (adminResponse?.accessToken || adminResponse?.token) {
                    const token = adminResponse.accessToken || adminResponse.token;
                    storage.setItem(ADMIN_TOKEN_KEY, token);
                    if (adminResponse.refreshToken) {
                        storage.setItem(ADMIN_REFRESH_TOKEN_KEY, adminResponse.refreshToken);
                    }
                    console.log('✅ [AUTH] Admin login successful');
                    return {
                        success: true,
                        isAdmin: true,
                        token: token,
                        user: adminResponse.user || { email, role: 'admin' }
                    };
                }
            } catch (adminError) {
                // Not an admin or admin login failed - continue to user login
                if (adminError?.status === 401) {
                    console.log('ℹ️ [AUTH] Not admin, trying user login...');
                } else {
                    console.warn('⚠️ [AUTH] Admin login error:', adminError.message);
                }
            }
            }

            // Step 2: User login with backend
            console.log('🔐 [AUTH] Attempting user login...');
            const response = await authAPI.login({
                email: email.trim(),
                password
            });

            if (!response?.success || !response?.data?.user || !response?.data?.token) {
                throw new Error(response?.message || 'Login failed. Invalid response from server.');
            }

            // Step 3: Store user data and token
            const userData = response.data.user;
            const token = response.data.token;

            storage.setJSON(USER_KEY, userData);
            storage.setItem(TOKEN_KEY, token);

            console.log('✅ [AUTH] User login successful');
            return {
                success: true,
                isAdmin: false,
                token: token,
                user: userData
            };

        } catch (error) {
            console.error('❌ [AUTH] Login error:', error);
            
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.message.includes('No internet')) {
                errorMessage = error.message;
            } else if (error.message.includes('Invalid credentials') || error.message.includes('401')) {
                errorMessage = 'Invalid email or password. Please try again.';
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Google Social Login
     */
    async loginWithGoogle() {
        setNativeAuthInProgress(true);
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Starting Google login...');

            // Step 1: Authenticate with Firebase Google
            const firebaseResult = await signInWithGoogle();

            if (!firebaseResult.success || !firebaseResult.user) {
                if (firebaseResult.redirectInitiated) {
                    // Redirect was initiated - return special status
                    return {
                        success: false,
                        redirectInitiated: true,
                        message: firebaseResult.message || 'Redirecting to Google...'
                    };
                }
                throw new Error(firebaseResult.error || 'Google authentication failed');
            }

            // Step 2: Sync with backend
            const socialAuthData = await withFirebaseIdToken(
                processSocialAuthUser(firebaseResult.user, 'google'),
                firebaseResult.user
            );

            const backendResponse = await authAPI.socialAuth(socialAuthData);

            if (!backendResponse?.success || !backendResponse?.data?.user || !backendResponse?.data?.token) {
                throw new Error(backendResponse?.message || 'Backend sync failed');
            }

            // Step 3: Store user data and token
            const userData = backendResponse.data.user;
            const token = backendResponse.data.token;

            storage.setJSON(USER_KEY, userData);
            storage.setItem(TOKEN_KEY, token);

            console.log('✅ [AUTH] Google login successful');
            return {
                success: true,
                token: token,
                user: userData,
                firebaseUser: firebaseResult.user
            };

        } catch (error) {
            console.error('❌ [AUTH] Google login error:', error);
            console.error('❌ [AUTH] Error details:', {
                message: error?.message,
                code: error?.code,
                name: error?.name,
                isInAppBrowser: error?.isInAppBrowser,
                showOpenInBrowser: error?.showOpenInBrowser
            });
            
            // Check if this is an in-app browser error (from firebase.js)
            if (error?.isInAppBrowser || error?.showOpenInBrowser) {
                const enhancedError = new Error(error.error || error.message || 'Google sign-in is not supported in this browser. Please open in Chrome or Safari.');
                enhancedError.isInAppBrowser = true;
                enhancedError.showOpenInBrowser = true;
                enhancedError.errorDetails = error.errorDetails;
                enhancedError.appName = error.appName;
                enhancedError.openInBrowserUrl = error.openInBrowserUrl;
                throw enhancedError;
            }
            
            let errorMessage = 'Google sign-in failed. Please try again.';
            
            // Check for empty error objects (common in Instagram browser)
            const errorStr = error?.message || '';
            const isEmptyError = !errorStr || errorStr === '[object Object]' || (typeof error === 'object' && Object.keys(error).length === 0);
            
            if (isEmptyError) {
                // Likely an in-app browser blocking OAuth silently
                const ua = navigator.userAgent || '';
                const isInAppBrowser = /Instagram|FBAN|FBAV|TikTok|WhatsApp/i.test(ua);
                if (isInAppBrowser) {
                    const enhancedError = new Error('Google Sign-In is blocked in this browser. Please tap the ⋯ menu and select "Open in Chrome" or "Open in Safari".');
                    enhancedError.isInAppBrowser = true;
                    enhancedError.showOpenInBrowser = true;
                    throw enhancedError;
                }
            }
            
            if (errorStr.includes('No internet')) {
                errorMessage = errorStr;
            } else if (errorStr.includes('Network') || errorStr.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (errorStr) {
                errorMessage = errorStr;
            }

            throw new Error(errorMessage);
        } finally {
            setNativeAuthInProgress(false);
        }
    }

    /**
     * Facebook Social Login
     */
    async loginWithFacebook() {
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Starting Facebook login...');

            // Step 1: Authenticate with Firebase Facebook
            const firebaseResult = await signInWithFacebook();

            if (!firebaseResult.success || !firebaseResult.user) {
                if (firebaseResult.redirectInitiated) {
                    // Redirect was initiated - return special status
                    return {
                        success: false,
                        redirectInitiated: true,
                        message: firebaseResult.message || 'Redirecting to Facebook...'
                    };
                }
                throw new Error(firebaseResult.error || 'Facebook authentication failed');
            }

            // Step 2: Sync with backend
            const socialAuthData = await withFirebaseIdToken(
                processSocialAuthUser(firebaseResult.user, 'facebook'),
                firebaseResult.user
            );

            const backendResponse = await authAPI.socialAuth(socialAuthData);

            if (!backendResponse?.success || !backendResponse?.data?.user || !backendResponse?.data?.token) {
                throw new Error(backendResponse?.message || 'Backend sync failed');
            }

            // Step 3: Store user data and token
            const userData = backendResponse.data.user;
            const token = backendResponse.data.token;

            storage.setJSON(USER_KEY, userData);
            storage.setItem(TOKEN_KEY, token);

            console.log('✅ [AUTH] Facebook login successful');
            return {
                success: true,
                token: token,
                user: userData,
                firebaseUser: firebaseResult.user
            };

        } catch (error) {
            console.error('❌ [AUTH] Facebook login error:', error);
            
            let errorMessage = 'Facebook sign-in failed. Please try again.';
            
            if (error.message.includes('No internet')) {
                errorMessage = error.message;
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Email/Password Registration
     */
    async registerWithEmail(name, email, phone, password) {
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Starting email registration...');

            // Step 1: Register with Firebase (for email verification)
            const firebaseResult = await registerWithEmail(email, password);

            if (!firebaseResult.success) {
                throw new Error(firebaseResult.error || 'Firebase registration failed');
            }

            // Step 2: Register with backend
            const userData = await withFirebaseIdToken(
                {
                    name: name.trim(),
                    email: email.trim(),
                    phoneNumber: phone.trim(),
                    password: password,
                    role: 'student',
                    firebaseUid: firebaseResult.user.uid,
                },
                firebaseResult.user
            );

            const backendResponse = await authAPI.register(userData);

            if (!backendResponse?.success || !backendResponse?.data?.user || !backendResponse?.data?.token) {
                throw new Error(backendResponse?.message || 'Backend registration failed');
            }

            // Step 3: Store user data and token
            const registeredUser = backendResponse.data.user;
            const token = backendResponse.data.token;

            storage.setJSON(USER_KEY, registeredUser);
            storage.setItem(TOKEN_KEY, token);

            console.log('✅ [AUTH] Registration successful');
            return {
                success: true,
                token: token,
                user: registeredUser,
                firebaseUser: firebaseResult.user
            };

        } catch (error) {
            console.error('❌ [AUTH] Registration error:', error);
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('No internet')) {
                errorMessage = error.message;
            } else if (error.message.includes('already exists') || error.message.includes('already registered')) {
                errorMessage = 'An account with this email or phone number already exists. Please try logging in instead.';
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Social Auth Registration (Google/Facebook)
     */
    async registerWithSocial(provider, _phone, _dateOfBirth) {
        try {
            this.checkNetworkStatus();

            console.log(`🔐 [AUTH] Starting ${provider} registration...`);

            // This should be called after social auth is complete
            // The social auth data should already be in the component state
            throw new Error('registerWithSocial should be called with complete social auth data');

        } catch (error) {
            console.error(`❌ [AUTH] ${provider} registration error:`, error);
            throw error;
        }
    }

    /**
     * Complete Social Registration
     */
    async completeSocialRegistration(socialAuthData, phone, dateOfBirth) {
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Completing social registration...');
            console.log('🔐 [AUTH] API Base URL:', API_CONFIG.BASE_URL);
            console.log('🔐 [AUTH] Social auth data:', {
                name: socialAuthData?.name,
                email: socialAuthData?.email,
                provider: socialAuthData?.provider,
                hasProviderId: !!socialAuthData?.providerId,
                phone: phone,
                dateOfBirth: dateOfBirth
            });

            let completeAuthData = {
                ...socialAuthData,
                phoneNumber: phone.trim(),
                dateOfBirth: dateOfBirth,
            };

            if (auth.currentUser) {
                completeAuthData = await withFirebaseIdToken(completeAuthData, auth.currentUser);
            }

            // ✅ FIX: Pre-flight health check to give better error messages
            try {
                const healthUrl = API_CONFIG.BASE_URL.replace(/\/api$/, '') + '/api/health';
                console.log('🏥 [AUTH] Checking backend health:', healthUrl);
                const healthCheck = await fetch(healthUrl, {
                    method: 'GET',
                    mode: 'cors',
                    signal: AbortSignal.timeout(10000)
                });
                if (!healthCheck.ok) {
                    console.error('❌ [AUTH] Backend health check failed:', healthCheck.status);
                    throw new Error(`Backend server returned ${healthCheck.status}. The server may be starting up — please try again in 30 seconds.`);
                }
                console.log('✅ [AUTH] Backend is reachable');
            } catch (healthError) {
                if (healthError.message.includes('Backend server returned')) {
                    throw healthError;
                }
                console.error('❌ [AUTH] Backend unreachable:', healthError.message);
                // Provide specific diagnosis
                const apiUrl = API_CONFIG.BASE_URL;
                if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
                    throw new Error(
                        `Cannot connect to backend server at ${apiUrl}. ` +
                        'Please make sure the backend is running (cd backend && npm start). ' +
                        'Check that VITE_API_BASE_URL matches your backend server address.'
                    );
                } else {
                    throw new Error(
                        `Cannot connect to backend server at ${apiUrl}. ` +
                        'The server may be experiencing a cold start — please wait 30 seconds and try again. ' +
                        'If the problem persists, verify that VITE_API_BASE_URL is correct and the backend is deployed.'
                    );
                }
            }

            const backendResponse = await authAPI.socialAuth(completeAuthData);

            if (!backendResponse?.success || !backendResponse?.data?.user || !backendResponse?.data?.token) {
                console.error('❌ [AUTH] Backend response invalid:', backendResponse);
                throw new Error(backendResponse?.message || 'Backend registration failed. Server returned an unexpected response.');
            }

            // Store user data and token
            const userData = backendResponse.data.user;
            const token = backendResponse.data.token;

            storage.setJSON(USER_KEY, userData);
            storage.setItem(TOKEN_KEY, token);

            console.log('✅ [AUTH] Social registration successful');
            return {
                success: true,
                token: token,
                user: userData
            };

        } catch (error) {
            console.error('❌ [AUTH] Social registration error:', error);
            console.error('❌ [AUTH] Error details:', {
                message: error.message,
                name: error.name,
                status: error.status,
                stack: error.stack?.substring(0, 300)
            });
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('No internet')) {
                errorMessage = error.message;
            } else if (error.message.includes('Cannot connect to backend')) {
                errorMessage = error.message;
            } else if (error.message.includes('Backend server returned')) {
                errorMessage = error.message;
            } else if (error.message.includes('already exists')) {
                errorMessage = 'An account with this email or phone number already exists. Please try logging in instead.';
            } else if (error.message.includes('Unable to connect')) {
                errorMessage = `Server connection failed. API URL: ${API_CONFIG.BASE_URL}. Please verify the backend is running and VITE_API_BASE_URL is correct.`;
            } else if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
                errorMessage = `Network error connecting to ${API_CONFIG.BASE_URL}. Please check: 1) Backend server is running, 2) VITE_API_BASE_URL is correct, 3) CORS is enabled on the backend.`;
            } else if (error.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Delete (deactivate + anonymize) the current account, then log out.
     */
    async deleteAccount(token) {
        const authToken = token || this.getCurrentToken();
        if (!authToken) {
            throw new Error('You must be logged in to delete your account.');
        }

        const response = await fetch(resolveUrl('/users/account'), {
            method: 'DELETE',
            headers: getUserAuthHeaders(authToken),
            credentials: 'include',
            mode: 'cors',
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success === false) {
            throw new Error(data?.message || 'Failed to delete account. Please try again.');
        }

        await this.logout();
        return { success: true };
    }

    /**
     * Logout
     */
    async logout() {
        try {
            // Clear all storage
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(USER_KEY);
            storage.removeItem(ADMIN_TOKEN_KEY);
            storage.removeItem(ADMIN_REFRESH_TOKEN_KEY);

            // Sign out from Firebase if needed
            const { signOut, auth } = await import('../firebase');
            try {
                await signOut(auth);
            } catch (firebaseError) {
                console.warn('Firebase signout error (non-critical):', firebaseError);
            }

            console.log('✅ [AUTH] Logout successful');
            return { success: true };

        } catch (error) {
            console.error('❌ [AUTH] Logout error:', error);
            // Still clear storage even if Firebase logout fails
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(USER_KEY);
            storage.removeItem(ADMIN_TOKEN_KEY);
            storage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
            return { success: true };
        }
    }

    /**
     * Get current user from storage
     */
    getCurrentUser() {
        return storage.getJSON(USER_KEY);
    }

    /**
     * Get current token from storage
     */
    getCurrentToken() {
        return storage.getItem(TOKEN_KEY);
    }

    /**
     * Get admin token from storage
     */
    getAdminToken() {
        return storage.getItem(ADMIN_TOKEN_KEY);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = this.getCurrentToken();
        const user = this.getCurrentUser();
        return !!(token && user);
    }

    /**
     * Check if admin is authenticated
     */
    isAdminAuthenticated() {
        const token = this.getAdminToken();
        return !!token;
    }
}

// Export singleton instance
export const authService = new AuthService();

// Export class for testing
export { AuthService };
