import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { storage } from '../utils/storage';
import { onAuthStateChange } from '../firebase';

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

    // Initialize auth state from storage on mount
    useEffect(() => {
        const initializeAuth = async () => {
            console.log('🚀 [AUTH] Initializing authentication...');
            
            try {
                // Restore user and token from storage
                const savedUser = storage.getJSON('crwdctrl_user');
                const savedToken = storage.getItem('crwdctrl_token');

                if (savedUser && savedToken) {
                    console.log('✅ [AUTH] Session restored from storage');
                    setUser(savedUser);
                    setToken(savedToken);
                } else {
                    console.log('ℹ️ [AUTH] No saved session found');
                }
            } catch (error) {
                console.error('❌ [AUTH] Error initializing auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // Listen to Firebase auth state changes (for social auth)
    useEffect(() => {
        const unsubscribe = onAuthStateChange((firebaseUser) => {
            console.log('🔥 [AUTH] Firebase auth state changed:', firebaseUser ? firebaseUser.email : 'No user');
            setFirebaseUser(firebaseUser);
            setIsEmailVerified(firebaseUser?.emailVerified || false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Login function - updates state and storage
    const login = (userData, firebaseUserData = null) => {
        console.log('🔐 [AUTH] Login called');
        
        const { token: userToken, ...userInfo } = userData;

        // Update state
        setUser(userInfo);
        setToken(userToken);

        // Update Firebase user if provided
        if (firebaseUserData) {
            setFirebaseUser(firebaseUserData);
            setIsEmailVerified(firebaseUserData.emailVerified || false);
        }

        // Store in unified storage
        storage.setJSON('crwdctrl_user', userInfo);
        storage.setItem('crwdctrl_token', userToken);

        console.log('✅ [AUTH] Login completed, session stored');
    };

    // Logout function
    const logout = async () => {
        console.log('🚪 [AUTH] Logout called');
        
        try {
            await authService.logout();
        } catch (error) {
            console.error('❌ [AUTH] Logout error:', error);
        }

        // Clear state
        setUser(null);
        setToken(null);
        setFirebaseUser(null);
        setIsEmailVerified(false);

        console.log('✅ [AUTH] Logout completed');
    };

    // Update user function
    const updateUser = (userData) => {
        const updatedUser = { ...user, ...userData };
        setUser(updatedUser);
        storage.setJSON('crwdctrl_user', updatedUser);
        console.log('✅ [AUTH] User updated');
    };

    // Get authorization headers for API requests
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

    // Make authenticated API requests
    const apiCall = async (url, options = {}) => {
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
            const headers = {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            };

            const response = await fetch(`${API_BASE_URL}${url}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers,
                },
                credentials: 'include',
                mode: 'cors',
            });

            if (response.status === 401) {
                console.error('❌ [AUTH] Unauthorized (401). Clearing session.');
                await logout();
                window.location.href = '/login';
                return response;
            }

            return response;
        } catch (err) {
            console.error('❌ [AUTH] API call failed:', err);
            throw new Error('Failed to connect to the server. Please try again later.');
        }
    };

    // Validate token
    const validateToken = async () => {
        if (!token) return false;
        
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
            const response = await fetch(`${API_BASE_URL}/users/validate`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                mode: 'cors',
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [AUTH] Token validation error:', error);
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
