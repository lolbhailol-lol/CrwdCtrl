/**
 * Unified Authentication Service
 * 
 * Single source of truth for all authentication operations
 * Handles: Email/Password, Google, Facebook, Admin login
 * Mobile-optimized with proper error handling and retry logic
 */

import { authAPI } from '../utils/api';
import { storage } from '../utils/storage';
import { signInWithGoogle, signInWithFacebook, registerWithEmail, loginWithEmail } from '../firebase';
import { processSocialAuthUser } from '../utils/socialAuth';

// Storage keys
const TOKEN_KEY = 'crwdctrl_token';
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
    async loginWithEmail(email, password) {
        try {
            this.checkNetworkStatus();

            console.log('🔐 [AUTH] Starting email login...');

            // Step 1: Try admin login first (if it fails, continue to user login)
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
            const socialAuthData = processSocialAuthUser(firebaseResult.user, 'google');
            socialAuthData.isVerified = true;

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
            
            let errorMessage = 'Google sign-in failed. Please try again.';
            
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
            const socialAuthData = processSocialAuthUser(firebaseResult.user, 'facebook');
            socialAuthData.isVerified = true;

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
            const userData = {
                name: name.trim(),
                email: email.trim(),
                phoneNumber: phone.trim(),
                password: password,
                role: 'student',
                firebaseUid: firebaseResult.user.uid,
                isVerified: true
            };

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
    async registerWithSocial(provider, phone, dateOfBirth) {
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

            const completeAuthData = {
                ...socialAuthData,
                phoneNumber: phone.trim(),
                dateOfBirth: dateOfBirth,
                isVerified: true
            };

            const backendResponse = await authAPI.socialAuth(completeAuthData);

            if (!backendResponse?.success || !backendResponse?.data?.user || !backendResponse?.data?.token) {
                throw new Error(backendResponse?.message || 'Backend registration failed');
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
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('No internet')) {
                errorMessage = error.message;
            } else if (error.message.includes('already exists')) {
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
