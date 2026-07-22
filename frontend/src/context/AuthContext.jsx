import { createContext, useState, useEffect, useContext, useRef } from 'react';
import { onAuthStateChange, handleRedirectResult, signOut, auth, firebaseReady } from '../firebase';
import { authAPI, getUserAuthHeaders, userApiCall, validateUserToken } from '../services/api/auth.api';
import { processSocialAuthUser } from '../utils/socialAuth';
import { withFirebaseIdToken } from '../utils/firebaseIdToken';
import { hasPendingOAuthRedirect, restoreSessionFromStorage, clearOAuthRedirectMarkers } from '../utils/authBootstrap';
import { persistAuthSession, clearAuthSession } from '../utils/authStorage';
import { hasAuthCallbackParams } from '../utils/bootSplash';
import { isNativeAuthInProgress } from '../utils/nativeAuth';
import { isNativeApp } from '../utils/capacitorPlatform';
import { markFreshLogin } from '../utils/notificationPrompt';
import { hasUsableAuthToken, isTokenExpired, isBackendUserJwt, isAuthFailureMessage } from '../utils/authToken';
import { refreshUserSession } from '../services/api/auth.api';

const AuthContext = createContext();

function detectOAuthReturn() {
    if (isNativeApp()) return false;
    return hasPendingOAuthRedirect() || hasAuthCallbackParams();
}

export const AuthProvider = ({ children }) => {
    const isOAuthReturn = detectOAuthReturn();
    const savedSession = isOAuthReturn ? null : restoreSessionFromStorage();

    const [user, setUser] = useState(() => savedSession?.user ?? null);
    const [token, setToken] = useState(() => savedSession?.token ?? null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthProcessing, setIsAuthProcessing] = useState(false);
    const [isRedirectProcessing, setIsRedirectProcessing] = useState(isOAuthReturn);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);

    const clearLocalSession = () => {
        setUser(null);
        setToken(null);
        setFirebaseUser(null);
        setIsEmailVerified(false);
        clearAuthSession();
        try {
            window.dispatchEvent(new Event('crwdctrl:user-logout'));
        } catch {
            /* ignore */
        }
    };

    const applyRefreshedSession = (userData, userToken) => {
        if (!userData || !userToken) return false;
        setUser(userData);
        setToken(userToken);
        persistAuthSession(userData, userToken);
        return true;
    };

    useEffect(() => {
        const onSessionRefreshed = (event) => {
            const { user: refreshedUser, token: refreshedToken } = event.detail || {};
            applyRefreshedSession(refreshedUser, refreshedToken);
        };
        window.addEventListener('crwdctrl:session-refreshed', onSessionRefreshed);
        return () => window.removeEventListener('crwdctrl:session-refreshed', onSessionRefreshed);
    }, []);

    const tryRefreshStoredSession = async (restored) => {
        if (!restored?.token || !isBackendUserJwt(restored.token)) {
            clearLocalSession();
            return null;
        }
        if (!isTokenExpired(restored.token)) return restored;
        try {
            const refreshed = await refreshUserSession(restored.token);
            if (refreshed?.token && refreshed?.user) {
                applyRefreshedSession(refreshed.user, refreshed.token);
                return { user: refreshed.user, token: refreshed.token };
            }
        } catch (err) {
            console.warn('Session refresh failed:', err?.message || err);
            // Network / server blips must not force logout — keep the JWT for retry.
            if (!isAuthFailureMessage(err?.message)) return restored;
        }
        clearLocalSession();
        return null;
    };

    const userRef = useRef(user);
    const tokenRef = useRef(token);
    const isAuthProcessingRef = useRef(isAuthProcessing);
    const logoutInProgressRef = useRef(false);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => { isAuthProcessingRef.current = isAuthProcessing; }, [isAuthProcessing]);

    // ✅ FIREBASE AUTH STATE LISTENER (HANDLES REDIRECT COMPLETION ON MOBILE)
    useEffect(() => {
        console.log('🔥 Setting up Firebase auth state listener (redirect-first)...');
        
        const unsubscribe = onAuthStateChange(async (firebaseUser) => {
            console.log('🔐 Firebase auth state changed:', firebaseUser ? `${firebaseUser.email} (${firebaseUser.uid})` : 'No user');

            // Explicit logout — never resurrect session from Firebase null / storage race
            if (logoutInProgressRef.current) {
                setFirebaseUser(null);
                setIsEmailVerified(false);
                return;
            }
            
            setFirebaseUser(firebaseUser);
            setIsEmailVerified(firebaseUser?.emailVerified || false);

            const currentUser = userRef.current;
            const currentToken = tokenRef.current;
            const processing = isAuthProcessingRef.current;
            
            // ✅ MOBILE FIX: Check if this is from a pending redirect
            const redirectType = sessionStorage.getItem('auth_redirect_type');
            const redirectTimestamp = sessionStorage.getItem('auth_redirect_timestamp');
            const hasPendingRedirect = redirectType && redirectTimestamp;
            
            // ✅ FIX: AUTOMATIC SESSION RESTORATION when Firebase user exists but no local session
            // IMPORTANT: Do NOT check authInitialized here - this listener fires during initialization!
            // This listener runs immediately with cached user, so we must handle it regardless of initialization state
            // ✅ Re-sync when there's no session OR the stored backend JWT is expired/unusable
            const hasUsableSession = !!currentUser && hasUsableAuthToken(currentToken);
            if (firebaseUser && !hasUsableSession && !processing) {
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
                            persistAuthSession(userData, userData.token);
                            
                            console.log('✅ Session restored from Firebase user');
                            
                        } catch (backendError) {
                            console.error('❌ Backend sync failed:', backendError.message);
                            // Keep any existing backend JWT — don't wipe a still-valid web session
                            // just because social re-sync failed once (network/cold start).
                            const kept = await tryRefreshStoredSession(restoreSessionFromStorage());
                            if (kept?.user && kept?.token) {
                                setUser(kept.user);
                                setToken(kept.token);
                                console.log('⚠️ Kept stored backend session after social sync failure');
                            } else {
                                console.log('🔐 No usable backend session — user must sign in again');
                                setUser(null);
                                setToken(null);
                                clearAuthSession();
                            }
                        }
                    } else {
                        const restored = await tryRefreshStoredSession(restoreSessionFromStorage());
                        if (restored?.user && restored?.token) {
                            setUser(restored.user);
                            setToken(restored.token);
                            console.log('✅ Session restored from storage for email user');
                        } else {
                            console.log('ℹ️ Email user — no stored backend session');
                        }
                    }
                } catch (error) {
                    console.error('❌ Error restoring session from Firebase user:', error);
                } finally {
                    setIsAuthProcessing(false);
                }
            } else if (!firebaseUser && (currentUser || currentToken)) {
                // API auth is the backend JWT. Keep sessions when Firebase is briefly
                // null — but never resurrect a session after explicit logout cleared storage.
                const session = restoreSessionFromStorage();
                if (!session?.token) {
                    console.log('🧹 No stored session (logout or wiped) — clearing in-memory auth');
                    clearLocalSession();
                    return;
                }
                const kept = await tryRefreshStoredSession(session);
                if (kept?.user && kept?.token) {
                    setUser(kept.user);
                    setToken(kept.token);
                    console.log('ℹ️ Kept backend session despite no Firebase user');
                } else {
                    console.log('🧹 Stored session unusable after Firebase signed out');
                    clearLocalSession();
                }
            }
        });

        return () => {
            console.log('🔥 Cleaning up Firebase auth state listener');
            unsubscribe();
        };
    // Stable listener — read latest user/token via refs (avoids re-subscribe races)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                        const restored = await tryRefreshStoredSession(restoreSessionFromStorage());
                        if (restored) {
                            setUser(restored.user);
                            setToken(restored.token);
                            console.log('✅ Session restored from storage:', restored.user.email);
                        }
                    }
                    setIsRedirectProcessing(false);
                    return;
                }
                
                // ✅ CRITICAL FOR MOBILE WEB: Check for redirect result FIRST before checking localStorage
                // On mobile, after Google OAuth redirect, this is the ONLY way to get the user
                console.log('🔍 Checking for pending redirect result (CRITICAL for mobile OAuth)...');
                const isMobile = /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
                const pendingRedirect = hasPendingOAuthRedirect() || hasAuthCallbackParams();

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
                        persistAuthSession(userData, userData.token);
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
                        clearAuthSession();
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
                                persistAuthSession(userData, userData.token);
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
                        const restored = await tryRefreshStoredSession(restoreSessionFromStorage());
                        if (restored) {
                            setUser(restored.user);
                            setToken(restored.token);
                            console.log('✅ Session restored from storage:', restored.user.email);
                        } else {
                            console.log('📭 No existing session found - user will need to login');
                        }
                    } else if (token && isTokenExpired(token)) {
                        await tryRefreshStoredSession({ user, token });
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
        }, 5000);
        return () => window.clearTimeout(timer);
    }, [isRedirectProcessing, isAuthProcessing]);

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

        persistAuthSession(userInfo, userToken);
            markFreshLogin();
            console.log('✅ [AUTH] Login completed, session stored');
        
        // Clear loading states
        setIsLoading(false);
        setIsAuthProcessing(false);
    };

    // ✅ LOGOUT FUNCTION
    const logout = async () => {
        console.log('🚪 Logout called');
        logoutInProgressRef.current = true;

        // Clear storage FIRST so the Firebase null listener cannot resurrect the JWT
        clearLocalSession();

        try {
            await signOut(auth);
            console.log('✅ Firebase sign out successful');
        } catch (error) {
            console.error('❌ Firebase sign out error:', error);
        } finally {
            logoutInProgressRef.current = false;
        }

        console.log('✅ Logout completed');
    };

    const updateUser = (userData) => {
        const updatedUser = { ...user, ...userData };
        setUser(updatedUser);
        persistAuthSession(updatedUser, token);
    };

    const getAuthHeaders = () => getUserAuthHeaders(token);
    const apiCall = userApiCall;
    const validateToken = () => validateUserToken(token);

    const isAuthenticated = !!user && hasUsableAuthToken(token);
    
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
