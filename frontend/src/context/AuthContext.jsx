import { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChange, handleRedirectResult, signOut, auth, firebaseReady } from '../firebase';
import { authAPI } from '../utils/api';
import { processSocialAuthUser } from '../utils/socialAuth';
import { withFirebaseIdToken } from '../utils/firebaseIdToken';
import { hasPendingOAuthRedirect, restoreSessionFromStorage, clearOAuthRedirectMarkers } from '../utils/authBootstrap';
import { isNativeAuthInProgress } from '../utils/nativeAuth';
import { isNativeApp } from '../utils/capacitorPlatform';
import { markFreshLogin } from '../utils/notificationPrompt';
import { resolveAuthToken } from '../utils/authToken';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const oauthReturn = !isNativeApp() && hasPendingOAuthRedirect();
    const savedSession = oauthReturn ? null : restoreSessionFromStorage();

    const [user, setUser] = useState(() => savedSession?.user ?? null);
    const [token, setToken] = useState(() => savedSession?.token ?? null);
    const [isLoading, setIsLoading] = useState(oauthReturn);
    const [isAuthProcessing, setIsAuthProcessing] = useState(false);
    const [isRedirectProcessing, setIsRedirectProcessing] = useState(oauthReturn);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);

    // ✅ FIREBASE AUTH STATE LISTENER (HANDLES REDIRECT COMPLETION ON MOBILE)
    useEffect(() => {
        console.log('🔥 Setting up Firebase auth state listener (redirect-first)...');
        
        const unsubscribe = onAuthStateChange(async (firebaseUser) => {
            console.log('🔐 Firebase auth state changed:', firebaseUser ? `${firebaseUser.email} (${firebaseUser.uid})` : 'No user');
            
            setFirebaseUser(firebaseUser);
            setIsEmailVerified(firebaseUser?.emailVerified || false);
            
            // ✅ MOBILE FIX: Check if this is from a pending redirect
            const redirectType = sessionStorage.getItem('auth_redirect_type');
            const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
            const hasPendingRedirect = redirectType && redirectTimestamp;
            
            // ✅ FIX: AUTOMATIC SESSION RESTORATION when Firebase user exists but no local session
            // IMPORTANT: Do NOT check authInitialized here - this listener fires during initialization!
            // This listener runs immediately with cached user, so we must handle it regardless of initialization state
            // ✅ Re-sync when there's no session OR the stored backend JWT is expired/unusable
            const hasUsableSession = !!user && !!resolveAuthToken(token);
            if (firebaseUser && !hasUsableSession && !isAuthProcessing) {
                if (isNativeAuthInProgress()) {
                    console.log('⏭️ Skipping auth listener sync — native login handler active');
                    return;
                }
                console.log('🔄 Firebase user exists but no local session - restoring...');
                if (hasPendingRedirect) {
                    console.log('📱 This appears to be from a mobile OAuth redirect!');
                }
                
                setIsAuthProcessing(true);
                
                try {
                    // Determine provider from Firebase user
                    const providerData = firebaseUser.providerData?.[0];
                    const providerId = providerData?.providerId || 'unknown';
                    
                    let provider = 'unknown';
                    if (providerId.includes('google')) {
                        provider = 'google';
                    } else if (providerId.includes('facebook')) {
                        provider = 'facebook';
                    } else if (providerId === 'password') {
                        provider = 'email';
                    }
                    
                    console.log('🔍 Provider detected for session restoration:', provider);
                    
                    // For social auth users, sync with backend
                    if (provider === 'google' || provider === 'facebook') {
                        const socialAuthData = await withFirebaseIdToken(
                            processSocialAuthUser(firebaseUser, provider),
                            firebaseUser
                        );
                        
                        try {
                            console.log('🔄 Syncing Firebase user with backend...');
                            const data = await authAPI.socialAuth(socialAuthData);
                            
                            // Restore session with backend data
                            const userData = {
                                ...data.data.user,
                                token: data.data.token
                            };
                            
                            setUser(userData);
                            setToken(userData.token);
                            
                            // Store in localStorage
                            localStorage.setItem('crwdctrl_user', JSON.stringify(userData));
                            localStorage.setItem('crwdctrl_token', userData.token);
                            
                            console.log('✅ Session restored from Firebase user');
                            
                        } catch (backendError) {
                            console.error('❌ Backend sync failed:', backendError.message);
                            console.log('⚠️ User is Firebase-authenticated but backend sync failed');
                            
                            // ✅ FIX: Do NOT create fallback token - invalid tokens cause jwt malformed errors
                            console.log('🔐 Clearing tokens to force proper backend authentication');
                            setUser(null);
                            setToken(null);
                            localStorage.removeItem('crwdctrl_user');
                            localStorage.removeItem('crwdctrl_token');
                        }
                    } else {
                        // For email users, require backend authentication
                        console.log('ℹ️ Email user needs proper backend authentication');
                        setUser(null);
                        setToken(null);
                        localStorage.removeItem('crwdctrl_user');
                        localStorage.removeItem('crwdctrl_token');
                    }
                } catch (error) {
                    console.error('❌ Error restoring session from Firebase user:', error);
                } finally {
                    setIsAuthProcessing(false);
                }
            } else if (!firebaseUser && (user || token)) {
                // ✅ Firebase user is null but we have local session - clear it
                console.log('🧹 Firebase user is null, clearing local session');
                clearLocalSession();
            }
        });

        return () => {
            console.log('🔥 Cleaning up Firebase auth state listener');
            unsubscribe();
        };
    }, [user, token, isAuthProcessing]);

    // ✅ INITIALIZATION - WAIT FOR FIREBASE & CHECK REDIRECT RESULT ON MOBILE
    // CRITICAL: This handles the OAuth redirect flow on real mobile devices
    useEffect(() => {
        const initializeAuth = async () => {
            if (authInitialized) return;
            
            console.log('🚀 Initializing authentication (mobile-optimized)...');
            console.log('📱 User Agent:', navigator.userAgent.substring(0, 80));
            
            try {
                // ✅ CRITICAL: Wait for Firebase to be fully initialized first
                console.log('⏳ Waiting for Firebase to be ready...');
                await firebaseReady;
                console.log('✅ Firebase is ready');

                // Capacitor native apps use native Google Sign-In — never OAuth redirect flow
                if (isNativeApp()) {
                    clearOAuthRedirectMarkers();
                    if (!user && !token) {
                        const restored = restoreSessionFromStorage();
                        if (restored) {
                            setUser(restored.user);
                            setToken(restored.token);
                            console.log('✅ Session restored from localStorage:', restored.user.email);
                        }
                    }
                    setIsRedirectProcessing(false);
                    return;
                }
                
                // ✅ CRITICAL FOR MOBILE WEB: Check for redirect result FIRST before checking localStorage
                // On mobile, after Google OAuth redirect, this is the ONLY way to get the user
                console.log('🔍 Checking for pending redirect result (CRITICAL for mobile OAuth)...');
                const isMobile = /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
                const pendingRedirect = hasPendingOAuthRedirect();

                if (pendingRedirect) {
                    setIsRedirectProcessing(true);
                }

                // Only delay when returning from OAuth — normal visits render immediately
                if (pendingRedirect && isMobile) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                const result = await handleRedirectResult();
                
                if (result && result.success && result.user) {
                    console.log('✅ REDIRECT RESULT FOUND (Mobile OAuth Success):', result.user.email);
                    console.log('📱 This means user successfully signed in via Google redirect on mobile');
                    
                    // Handle redirect result (mobile OAuth completion)
                    const providerData = result.user.providerData?.[0];
                    const providerId = providerData?.providerId || result.providerId || 'unknown';
                    
                    let provider = 'unknown';
                    if (providerId.includes('google')) {
                        provider = 'google';
                    } else if (providerId.includes('facebook')) {
                        provider = 'facebook';
                    }
                    
                    console.log('🔍 Provider from redirect:', provider);
                    
                    // Process user data for backend
                    const socialAuthData = await withFirebaseIdToken(
                        processSocialAuthUser(result.user, provider),
                        result.user
                    );
                    
                    try {
                        console.log('🔄 Syncing redirect result with backend...');
                        const data = await authAPI.socialAuth(socialAuthData);
                        
                        // Create session with backend data
                        const userData = {
                            ...data.data.user,
                            token: data.data.token
                        };
                        
                        setUser(userData);
                        setToken(userData.token);
                        setFirebaseUser(result.user);
                        setIsEmailVerified(result.user.emailVerified || false);
                        
                        // Store in localStorage
                        localStorage.setItem('crwdctrl_user', JSON.stringify(userData));
                        localStorage.setItem('crwdctrl_token', userData.token);
                        markFreshLogin();
                        
                        console.log('✅ Redirect session created successfully');
                        
                    } catch (backendError) {
                        console.error('❌ Backend sync failed for redirect:', backendError.message);
                        
                        // ✅ FIX: Do NOT create fallback token - clear auth instead
                        console.log('🔐 Clearing tokens - user needs to re-authenticate with backend');
                        setUser(null);
                        setToken(null);
                        setFirebaseUser(null);
                        setIsEmailVerified(false);
                        localStorage.removeItem('crwdctrl_user');
                        localStorage.removeItem('crwdctrl_token');
                    }
                    
                    // Clean up URL - remove redirect markers
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                    
                    // ✅ Mark redirect processing complete
                    setIsRedirectProcessing(false);
                    
                } else {
                    // No redirect result - this is a fresh load OR mobile redirect timing issue
                    console.log('📭 No redirect result found');
                    
                    // ✅ MOBILE FALLBACK: Check if we had a pending redirect and auth.currentUser exists
                    // On some mobile browsers, getRedirectResult returns null but Firebase sets currentUser
                    const redirectType = sessionStorage.getItem('auth_redirect_type');
                    const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
                    
                    if (isMobile && redirectType && redirectTimestamp && auth.currentUser) {
                        const elapsed = Date.now() - parseInt(redirectTimestamp);
                        if (elapsed < 300000) { // Within 5 minutes
                            console.log('📱 MOBILE FALLBACK: Using auth.currentUser from pending redirect');
                            
                            const firebaseUser = auth.currentUser;
                            const providerData = firebaseUser.providerData?.[0];
                            const providerId = providerData?.providerId || redirectType;
                            
                            let provider = 'google';
                            if (providerId.includes('facebook')) {
                                provider = 'facebook';
                            }
                            
                            // Clear redirect markers
                            sessionStorage.removeItem('auth_redirect_type');
                            sessionStorage.removeItem('auth_redirect_timestamp');
                            sessionStorage.removeItem('auth_redirect_url');
                            sessionStorage.removeItem('auth_in_app_browser');
                            
                            // Process the user
                            const socialAuthData = await withFirebaseIdToken(
                                processSocialAuthUser(firebaseUser, provider),
                                firebaseUser
                            );
                            
                            try {
                                console.log('🔄 Syncing mobile fallback user with backend...');
                                const data = await authAPI.socialAuth(socialAuthData);
                                
                                const userData = {
                                    ...data.data.user,
                                    token: data.data.token
                                };
                                
                                setUser(userData);
                                setToken(userData.token);
                                setFirebaseUser(firebaseUser);
                                setIsEmailVerified(firebaseUser.emailVerified || false);
                                
                                localStorage.setItem('crwdctrl_user', JSON.stringify(userData));
                                localStorage.setItem('crwdctrl_token', userData.token);
                                markFreshLogin();
                                
                                console.log('✅ Mobile fallback session created successfully');
                                setIsRedirectProcessing(false);
                                return; // Exit early - auth complete
                            } catch (backendError) {
                                console.error('❌ Mobile fallback backend sync failed:', backendError);
                                // Continue to localStorage check as last resort
                            }
                        }
                    }
                    
                    // Step 2: Confirm localStorage session (may already be restored on mount)
                    if (!user && !token) {
                        const restored = restoreSessionFromStorage();
                        if (restored) {
                            setUser(restored.user);
                            setToken(restored.token);
                            console.log('✅ Session restored from localStorage:', restored.user.email);
                        } else {
                            console.log('📭 No existing session found - user will need to login');
                        }
                    } else if (token?.startsWith('firebase_')) {
                        console.warn('⚠️ Invalid Firebase fallback token — clearing session');
                        clearLocalSession();
                    }
                    
                    // ✅ Mark redirect processing complete even though no redirect occurred
                    setIsRedirectProcessing(false);
                }
                
            } catch (error) {
                console.error('❌ Error during auth initialization:', error);
                setIsRedirectProcessing(false); // ✅ Ensure flag is cleared even on error
            } finally {
                setAuthInitialized(true);
                setIsAuthProcessing(false);
                setIsLoading(false);
                console.log('✅ Popup-first authentication initialized');
            }
        };

        initializeAuth();
    }, [authInitialized]);

    // Never leave the app stuck on the auth loading screen
    useEffect(() => {
        if (!isRedirectProcessing && !isAuthProcessing) return undefined;
        const timer = window.setTimeout(() => {
            clearOAuthRedirectMarkers();
            setIsRedirectProcessing(false);
            setIsAuthProcessing(false);
            setIsLoading(false);
        }, 12000);
        return () => window.clearTimeout(timer);
    }, [isRedirectProcessing, isAuthProcessing]);

    // ✅ HELPER FUNCTION TO CLEAR LOCAL SESSION
    const clearLocalSession = () => {
        setUser(null);
        setToken(null);
        setFirebaseUser(null);
        setIsEmailVerified(false);
        
        try {
            localStorage.removeItem('crwdctrl_user');
            localStorage.removeItem('crwdctrl_token');
        } catch (error) {
            console.error('❌ Error clearing localStorage:', error);
        }
    };

    // ✅ POPUP-FIRST LOGIN FUNCTION
    const login = (userData, firebaseUserData = null) => {
        const { token: userToken, ...userInfo } = userData;

        console.log('🔐 [AUTH] Login called with:', {
            userInfo: userInfo,
            hasToken: !!userToken,
            tokenValue: userToken ? userToken.substring(0, 20) + '...' : 'none',
            hasFirebaseUser: !!firebaseUserData
        });

        // Set state immediately
        setUser(userInfo);
        setToken(userToken);
        
        console.log('🔐 [AUTH] State updated - user and token set');

        // Store Firebase user data if provided
        if (firebaseUserData) {
            setFirebaseUser(firebaseUserData);
            setIsEmailVerified(firebaseUserData.emailVerified || false);
        }

        // Store in localStorage immediately
        try {
            localStorage.setItem('crwdctrl_user', JSON.stringify(userInfo));
            localStorage.setItem('crwdctrl_token', userToken);
            markFreshLogin();
            console.log('✅ [AUTH] Login completed, session stored in localStorage');
            console.log('✅ [AUTH] isAuthenticated should now be true');
        } catch (error) {
            console.error('❌ Error storing user data:', error);
        }
        
        // Clear loading states
        setIsLoading(false);
        setIsAuthProcessing(false);
    };

    // ✅ LOGOUT FUNCTION
    const logout = async () => {
        console.log('🚪 Logout called');
        
        try {
            // Sign out from Firebase
            await signOut(auth);
            console.log('✅ Firebase sign out successful');
        } catch (error) {
            console.error('❌ Firebase sign out error:', error);
        }
        
        // Clear all local state
        clearLocalSession();
        
        console.log('✅ Logout completed');
    };

    const updateUser = (userData) => {
        const updatedUser = { ...user, ...userData };
        setUser(updatedUser);
        try {
            localStorage.setItem('crwdctrl_user', JSON.stringify(updatedUser));
        } catch (error) {
            console.error('❌ Error updating user:', error);
        }
    };

    // Function to get authorization headers for API requests
    const getAuthHeaders = () => {
        const resolved = resolveAuthToken(token);
        if (resolved) {
            return {
                Authorization: `Bearer ${resolved}`,
                'Content-Type': 'application/json',
            };
        }
        return {
            'Content-Type': 'application/json',
        };
    };

    // Function to make authenticated API requests
    const apiCall = async (url, options = {}) => {
        try {
            const token = localStorage.getItem('crwdctrl_token'); // Ensure token is fetched from localStorage
            const headers = {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }), // Add token if available
            };

            console.log('🔍 Making API call:', { url, headers, options });

            const response = await fetch(`${API_BASE_URL}${url}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers,
                },
                credentials: 'include', // ✅ FIX: Include cookies for production
                mode: 'cors', // ✅ FIX: Enable CORS for production
            });

            if (response.status === 401) {
                console.error('❌ Unauthorized (401). Clearing token and redirecting to login.');
                localStorage.removeItem('crwdctrl_token');
                localStorage.removeItem('crwdctrl_user');
                window.location.href = '/login';
                return response;
            }

            return response;
        } catch (err) {
            console.error('❌ API call failed:', err);
            throw new Error('Failed to connect to the server. Please try again later.');
        }
    };

    const validateToken = async () => {
        if (!token) return false;
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/validate`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // ✅ FIX: Include cookies for production
                mode: 'cors', // ✅ FIX: Enable CORS for production
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    };

    const isAuthenticated = !!user && !!token;
    
    // Debug logging for state changes
    useEffect(() => {
        console.log('🔄 [AUTH CONTEXT] State changed:', { 
            hasUser: !!user, 
            hasToken: !!token, 
            isAuthenticated,
            userName: user?.name || 'none'
        });
    }, [user, token, isAuthenticated]);
    
    const needsEmailVerification = firebaseUser && !isEmailVerified;

    const value = {
        user,
        token,
        firebaseUser,
        isEmailVerified,
        needsEmailVerification,
        isAuthenticated,
        isLoading,
        isAuthProcessing,
        isRedirectProcessing, // ✅ NEW: Export redirect processing state
        login,
        logout,
        updateUser,
        getAuthHeaders,
        apiCall,
        validateToken
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
