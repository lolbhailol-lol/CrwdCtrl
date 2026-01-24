import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser, handleRedirectResult } from '../firebase';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
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

    // Handle redirect result for mobile authentication
    useEffect(() => {
        const checkRedirectResult = async () => {
            try {
                const result = await handleRedirectResult();
                if (result && result.success && result.user) {
                    // Handle successful redirect authentication
                    console.log('Redirect authentication successful:', result.user.email);
                    // The auth state change will be handled by the onAuthStateChange listener
                }
            } catch (error) {
                console.error('Error handling redirect result:', error);
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

    // Function to make authenticated API requests with better error handling
    const apiCall = async (url, options = {}) => {
        const headers = getAuthHeaders();

        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        });

        // ✅ CRITICAL FIX: Don't auto-logout on 401 for all requests
        // Only logout if it's a user-initiated action, not background requests
        if (response.status === 401 && token && options.autoLogoutOn401 !== false) {
            console.log('🔓 Token expired, logging out user');
            logout();
            // Don't redirect immediately, let the calling component handle it
        }

        return response;
    };

    // ✅ NEW: Function to validate token without auto-logout
    const validateToken = async () => {
        if (!token) return false;
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/validate`, {
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

    // Check if user needs email verification (for Firebase auth users)
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