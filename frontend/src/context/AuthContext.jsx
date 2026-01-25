import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser, handleRedirectResult } from '../firebase';
import { authAPI } from '../utils/api';
import { processSocialAuthUser, validateSocialAuthResult } from '../utils/socialAuth';

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
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [isEmailVerified, setIsEmailVerified] = useState(false);

    // Listen to Firebase auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChange((firebaseUser) => {
            setFirebaseUser(firebaseUser);
            setIsEmailVerified(firebaseUser?.emailVerified || false);
        });

        return () => unsubscribe();
    }, []);

    // ✅ ENHANCED REDIRECT RESULT HANDLING FOR MOBILE
    useEffect(() => {
        const checkRedirectResult = async () => {
            try {
                const result = await handleRedirectResult();
                if (result && result.success && result.user) {
                    console.log('✅ Redirect authentication successful:', result.user.email);
                    
                    // Handle successful redirect authentication
                    const provider = result.providerId?.includes('google') ? 'google' : 'facebook';
                    
                    // Process user data for backend
                    const socialAuthData = processSocialAuthUser(result.user, provider);
                    socialAuthData.isVerified = true;
                    
                    try {
                        // Sync with backend
                        const data = await authAPI.socialAuth(socialAuthData);
                        
                        // Login with backend data
                        login({
                            ...data.data.user,
                            token: data.data.token
                        }, result.user);
                        
                        console.log('✅ Backend sync successful after redirect');
                        
                    } catch (backendError) {
                        console.error('Backend social auth failed after redirect:', backendError);
                        
                        // ✅ ENHANCED FALLBACK FOR REDIRECT CASE
                        if (backendError.status === 0 || backendError.networkError) {
                            console.warn('Network error during backend sync, using Firebase-only auth');
                        }
                        
                        // Fallback: Login with Firebase user data only
                        const fallbackUser = {
                            _id: result.user.uid,
                            name: result.user.displayName || `${provider} User`,
                            email: result.user.email,
                            role: 'student',
                            isVerified: true,
                            provider: provider,
                            profilePic: result.user.photoURL
                        };
                        
                        const fallbackToken = `firebase_${result.user.uid}_${Date.now()}`;
                        
                        login({
                            ...fallbackUser,
                            token: fallbackToken
                        }, result.user);
                        
                        console.log('✅ Fallback authentication successful after redirect');
                    }
                    
                    // Clean up the URL
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } else if (result && !result.success) {
                    console.error('❌ Redirect authentication failed:', result.error);
                    // Don't show error to user here - they might not have initiated a redirect
                }
            } catch (error) {
                console.error('Error handling redirect result:', error);
                // Don't show error to user - this is a background check
            } finally {
                setIsLoading(false);
            }
        };

        checkRedirectResult();
    }, []);

    // Check for existing user session on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('crwdctrl_user');
        const savedToken = localStorage.getItem('crwdctrl_token');

        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
        }
        setIsLoading(false);
    }, []);

    const login = (userData, firebaseUserData = null) => {
        const { token: userToken, ...userInfo } = userData;

        setUser(userInfo);
        setToken(userToken);

        // Store Firebase user data if provided
        if (firebaseUserData) {
            setFirebaseUser(firebaseUserData);
            setIsEmailVerified(firebaseUserData.emailVerified || false);
        }

        localStorage.setItem('crwdctrl_user', JSON.stringify(userInfo));
        localStorage.setItem('crwdctrl_token', userToken);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setFirebaseUser(null);
        setIsEmailVerified(false);
        localStorage.removeItem('crwdctrl_user');
        localStorage.removeItem('crwdctrl_token');
    };

    const updateUser = (userData) => {
        const updatedUser = { ...user, ...userData };
        setUser(updatedUser);
        localStorage.setItem('crwdctrl_user', JSON.stringify(updatedUser));
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
        const headers = getAuthHeaders();

        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        });

        if (response.status === 401 && token && options.autoLogoutOn401 !== false) {
            logout();
        }

        return response;
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