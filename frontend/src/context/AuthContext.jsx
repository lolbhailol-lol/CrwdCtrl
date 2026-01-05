import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser } from '../firebase';

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

        // If token is expired or invalid, logout
        if (response.status === 401 && token) {
            logout();
            window.location.href = '/';
        }

        return response;
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
        apiCall
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};