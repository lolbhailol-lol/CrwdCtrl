import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, handleRedirectResult, signOut, auth } from '../firebase';
import { authAPI } from '../utils/api';
import { processSocialAuthUser } from '../utils/socialAuth';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthProcessing, setIsAuthProcessing] = useState(false);
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);

    // ✅ SIMPLIFIED FIREBASE AUTH STATE LISTENER (POPUP-FIRST APPROACH)
    useEffect(() => {
        console.log('🔥 Setting up Firebase auth state listener (popup-first)...');
        
        const unsubscribe = onAuthStateChange(async (firebaseUser) => {
            console.log('🔐 Firebase auth state changed:', firebaseUser ? `${firebaseUser.email} (${firebaseUser.uid})` : 'No user');
            
            setFirebaseUser(firebaseUser);
            setIsEmailVerified(firebaseUser?.emailVerified || false);
            
            // ✅ AUTOMATIC SESSION RESTORATION when Firebase user exists but no local session
            if (firebaseUser && !user && !token && authInitialized && !isAuthProcessing) {
                console.log('🔄 Firebase user exists but no local session - restoring...');
                
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
                        const socialAuthData = processSocialAuthUser(firebaseUser, provider);
                        socialAuthData.isVerified = true;
                        
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
                            console.error('❌ Backend sync failed, using Firebase-only session:', backendError);
                            
                            // Fallback: Create Firebase-only session
                            const fallbackUser = {
                                _id: firebaseUser.uid,
                                name: firebaseUser.displayName || `${provider} User`,
                                email: firebaseUser.email,
                                role: 'student',
                                isVerified: true,
                                provider: provider,
                                profilePic: firebaseUser.photoURL,
                                token: `firebase_${firebaseUser.uid}_${Date.now()}`
                            };
                            
                            setUser(fallbackUser);
                            setToken(fallbackUser.token);
                            
                            // Store in localStorage
                            localStorage.setItem('crwdctrl_user', JSON.stringify(fallbackUser));
                            localStorage.setItem('crwdctrl_token', fallbackUser.token);
                            
                            console.log('✅ Fallback session created from Firebase user');
                        }
                    } else {
                        // For email users, create a basic session
                        const emailUser = {
                            _id: firebaseUser.uid,
                            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                            email: firebaseUser.email,
                            role: 'student',
                            isVerified: firebaseUser.emailVerified,
                            provider: 'email',
                            profilePic: firebaseUser.photoURL,
                            token: `firebase_email_${firebaseUser.uid}_${Date.now()}`
                        };
                        
                        setUser(emailUser);
                        setToken(emailUser.token);
                        
                        // Store in localStorage
                        localStorage.setItem('crwdctrl_user', JSON.stringify(emailUser));
                        localStorage.setItem('crwdctrl_token', emailUser.token);
                        
                        console.log('✅ Email session created from Firebase user');
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
    }, [user, token, authInitialized, isAuthProcessing]);

    // ✅ SIMPLIFIED INITIALIZATION (POPUP-FIRST APPROACH)
    useEffect(() => {
        const initializeAuth = async () => {
            if (authInitialized) return;
            
            console.log('🚀 Initializing popup-first authentication...');
            setIsAuthProcessing(true);
            
            try {
                // Step 1: Check for any pending redirect result (cleanup only)
                console.log('🔍 Checking for pending redirect result...');
                const result = await handleRedirectResult();
                
                if (result && result.success && result.user) {
                    console.log('✅ Found redirect result (fallback case):', result.user.email);
                    
                    // Handle redirect result (rare fallback case)
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
                    const socialAuthData = processSocialAuthUser(result.user, provider);
                    socialAuthData.isVerified = true;
                    
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
                        
                        console.log('✅ Redirect session created successfully');
                        
                    } catch (backendError) {
                        console.error('❌ Backend sync failed for redirect:', backendError);
                        
                        // Fallback: Create Firebase-only session
                        const fallbackUser = {
                            _id: result.user.uid,
                            name: result.user.displayName || `${provider} User`,
                            email: result.user.email,
                            role: 'student',
                            isVerified: true,
                            provider: provider,
                            profilePic: result.user.photoURL,
                            token: `firebase_${result.user.uid}_${Date.now()}`
                        };
                        
                        setUser(fallbackUser);
                        setToken(fallbackUser.token);
                        setFirebaseUser(result.user);
                        setIsEmailVerified(result.user.emailVerified || false);
                        
                        // Store in localStorage
                        localStorage.setItem('crwdctrl_user', JSON.stringify(fallbackUser));
                        localStorage.setItem('crwdctrl_token', fallbackUser.token);
                        
                        console.log('✅ Redirect fallback session created');
                    }
                    
                    // Clean up URL
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                    
                } else {
                    // Step 2: Restore existing session from localStorage
                    console.log('🔍 No redirect result, checking localStorage...');
                    
                    const savedUser = localStorage.getItem('crwdctrl_user');
                    const savedToken = localStorage.getItem('crwdctrl_token');

                    console.log('📦 Session check:', {
                        hasUser: !!savedUser,
                        hasToken: !!savedToken
                    });

                    if (savedUser && savedToken) {
                        try {
                            const parsedUser = JSON.parse(savedUser);
                            setUser(parsedUser);
                            setToken(savedToken);
                            console.log('✅ Session restored from localStorage:', parsedUser.email);
                        } catch (error) {
                            console.error('❌ Error parsing saved user data:', error);
                            clearLocalSession();
                        }
                    } else {
                        console.log('📭 No existing session found');
                    }
                }
                
            } catch (error) {
                console.error('❌ Error during auth initialization:', error);
            } finally {
                setAuthInitialized(true);
                setIsAuthProcessing(false);
                setIsLoading(false);
                console.log('✅ Popup-first authentication initialized');
            }
        };

        // Small delay to allow Firebase to initialize
        const timer = setTimeout(initializeAuth, 100);
        return () => clearTimeout(timer);
    }, [authInitialized]);

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

        console.log('🔐 Login called (popup-first):', {
            userInfo: userInfo,
            hasToken: !!userToken,
            hasFirebaseUser: !!firebaseUserData
        });

        // Set state immediately
        setUser(userInfo);
        setToken(userToken);

        // Store Firebase user data if provided
        if (firebaseUserData) {
            setFirebaseUser(firebaseUserData);
            setIsEmailVerified(firebaseUserData.emailVerified || false);
        }

        // Store in localStorage immediately
        try {
            localStorage.setItem('crwdctrl_user', JSON.stringify(userInfo));
            localStorage.setItem('crwdctrl_token', userToken);
            console.log('✅ Login completed, session stored');
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
        if (token) {
            return {
                'Authorization': `Bearer ${token}`,
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
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    };

    const isAuthenticated = !!user && !!token;
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