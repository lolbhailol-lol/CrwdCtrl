// API utility functions for CrwdCtrl frontend
import { API_CONFIG, AUTH_CONFIG } from '../config/env.js';
import { storage } from './storage.js';

/**
 * Base API configuration and utilities
 * ✅ ENHANCED FOR MOBILE: CORS, HTTPS, Headers, Storage, Network Detection
 */
class ApiClient {
    constructor() {
        // ✅ FIX 1: PROPER API BASE URL RESOLUTION FOR MOBILE
        const rawBase = import.meta.env.VITE_API_BASE_URL;
        
        // Critical: Don't use localhost fallback on mobile
        if (!rawBase) {
            console.error('❌ CRITICAL: VITE_API_BASE_URL environment variable is not set!');
            console.warn('⚠️ API Base URL not configured. Auth will fail on mobile devices.');
            // Still set a base, but mark that it's misconfigured
            this.baseURL = 'http://localhost:8080/api';
            this.isMisconfigured = true;
        } else {
            let base = rawBase;
            
            // ✅ FIX 2: ENFORCE HTTPS IN PRODUCTION (required for mixed-content blocking on mobile)
            if (import.meta.env.PROD && base.startsWith('http://')) {
                base = base.replace(/^http:\/\//, 'https://');
                console.log('🔒 Production mode: enforced HTTPS for API');
            }
            
            // ✅ FIX 3: VALIDATE API URL FORMAT
            try {
                new URL(base);
                this.baseURL = base;
                this.isMisconfigured = false;
            } catch (error) {
                console.error('❌ Invalid API Base URL:', base, error);
                this.baseURL = base;
                this.isMisconfigured = true;
            }
        }
        
        console.log('📍 Configured API Base URL:', this.baseURL);
        console.log('📍 API Configuration Healthy:', !this.isMisconfigured);
        
        this.timeout = API_CONFIG.TIMEOUT;
        
        // ✅ FIX 4: ENHANCED HEADERS FOR MOBILE NETWORKS
        // Added headers to prevent proxy interference and CORS issues
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',  // Helps with mobile proxies
            'Cache-Control': 'no-cache',            // Prevent mobile proxy caching
            'Pragma': 'no-cache'                    // Additional cache prevention
        };
        
        // ✅ FIX 5: NETWORK STATUS TRACKING
        this.isOnline = navigator.onLine;
        this.setupNetworkStatusListener();
    }
    
    /**
     * ✅ NEW: Setup network status listener for mobile
     */
    setupNetworkStatusListener() {
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
     * ✅ NEW: Check if device is online before making requests
     */
    checkNetworkStatus() {
        if (!navigator.onLine) {
            console.error('🔴 No internet connection - request will fail');
            throw new ApiError(
                'No internet connection. Please check your network and try again.',
                0,
                { 
                    networkError: true, 
                    offline: true 
                }
            );
        }
        return true;
    }

    /**
     * ✅ ENHANCED MOBILE-OPTIMIZED TIMEOUT CALCULATION WITH RAILWAY SUPPORT
     */
    getMobileOptimizedTimeout(endpoint = '') {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(userAgent) ||
                         (window.innerWidth <= 768 && 'ontouchstart' in window);
        
        const isAuthEndpoint = endpoint.includes('/login') || 
                              endpoint.includes('/register') || 
                              endpoint.includes('/social-auth');
        
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const effectiveType = connection?.effectiveType || '4g';
        
        // ✅ RAILWAY COLD START DETECTION
        const isProduction = import.meta.env.PROD;
        const isRailway = import.meta.env.VITE_ENABLE_RAILWAY_OPTIMIZATIONS === 'true';
        const railwayTimeout = parseInt(import.meta.env.VITE_RAILWAY_COLD_START_TIMEOUT) || 45000;
        
        let baseTimeout = this.timeout; // Default timeout
        
        // ✅ RAILWAY-SPECIFIC TIMEOUT ADJUSTMENTS
        if (isProduction && isRailway) {
            baseTimeout = railwayTimeout; // Use Railway-optimized timeout (45s)
            console.log('🚂 Railway production mode - using extended timeout:', baseTimeout);
        }
        
        if (isMobile) {
            baseTimeout = Math.max(baseTimeout, isAuthEndpoint ? 35000 : 25000);
        }
        
        // Adjust for connection speed
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            baseTimeout += 20000; // Add 20s for slow connections
        } else if (effectiveType === '3g') {
            baseTimeout += 10000; // Add 10s for 3g
        }
        
        return baseTimeout;
    }

    /**
     * ✅ RAILWAY COLD START DETECTION AND HANDLING
     */
    async detectAndHandleColdStart(url) {
        const isProduction = import.meta.env.PROD;
        const isRailway = import.meta.env.VITE_ENABLE_RAILWAY_OPTIMIZATIONS === 'true';
        
        if (!isProduction || !isRailway) {
            return { isColdStart: false };
        }
        
        try {
            console.log('🚂 Checking for Railway cold start...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Quick check
            
            const response = await fetch(`${this.baseURL}/cold-start-check`, {
                method: 'GET',
                signal: controller.signal,
                credentials: 'include'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🚂 Cold start check result:', data);
                
                if (data.isColdStart) {
                    console.log('❄️ Railway cold start detected - using extended timeouts');
                    return { 
                        isColdStart: true, 
                        uptime: data.uptime,
                        message: 'Server is warming up, please wait...' 
                    };
                }
            }
            
            return { isColdStart: false };
            
        } catch (error) {
            console.warn('⚠️ Cold start detection failed:', error.message);
            // Assume cold start if detection fails
            return { 
                isColdStart: true, 
                message: 'Connecting to server...' 
            };
        }
    }

    /**
     * ✅ ENHANCED RETRY MECHANISM WITH MOBILE NETWORK ERROR DETECTION
     */
    async requestWithRetry(url, config, maxRetries = 3) {
        // ✅ FIX 6: CHECK NETWORK STATUS BEFORE ATTEMPTING REQUEST
        try {
            this.checkNetworkStatus();
        } catch (error) {
            throw error;
        }
        
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = this.getMobileOptimizedTimeout(url);
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                config.signal = controller.signal;
                if (config.credentials === undefined) config.credentials = 'include';
                
                // ✅ FIX 7: LOG ALL REQUEST HEADERS FOR DEBUGGING MOBILE ISSUES
                console.log(`📤 API Request (attempt ${attempt + 1}/${maxRetries + 1}):`, {
                    method: config.method,
                    url: url,
                    timeout: timeout,
                    headers: config.headers,
                    credentials: config.credentials,
                    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                    connection: navigator.connection?.effectiveType || 'unknown',
                    online: navigator.onLine
                });

                const response = await fetch(url, config);
                clearTimeout(timeoutId);

                // ✅ FIX 8: LOG ALL RESPONSE HEADERS FOR DEBUGGING MOBILE CORS
                console.log('📥 API Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    attempt: attempt + 1,
                    corsHeaders: {
                        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                        'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
                        'Content-Type': response.headers.get('Content-Type')
                    }
                });

                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = { message: await response.text() };
                }

                if (!response.ok) {
                    console.error('❌ API Error Response:', {
                        status: response.status,
                        statusText: response.statusText,
                        data: data,
                        attempt: attempt + 1
                    });
                    
                    throw new ApiError(
                        data.message || `HTTP ${response.status} ${response.statusText}`,
                        response.status,
                        data
                    );
                }

                console.log('✅ API Success:', data);
                return data;

            } catch (error) {
                lastError = error;
                
                // ✅ FIX 9: ENHANCED MOBILE NETWORK ERROR DETECTION
                const errorMessage = error.message || '';
                const isCorsError = errorMessage.includes('CORS') || errorMessage.includes('cross-origin');
                const isNetworkError = errorMessage.includes('Failed to fetch') || 
                                     errorMessage.includes('NetworkError') ||
                                     errorMessage.includes('fetch');
                const isTimeoutError = error.name === 'AbortError';
                
                console.error('🔴 Request Error Details:', {
                    attempt: attempt + 1,
                    errorName: error.name,
                    errorMessage: error.message,
                    isCorsError,
                    isNetworkError,
                    isTimeoutError,
                    url
                });
                
                // Handle timeout errors
                if (isTimeoutError) {
                    console.error(`⏰ API Request Timeout (attempt ${attempt + 1}): ${timeout}ms`);
                    
                    // Don't retry on timeout for the last attempt
                    if (attempt === maxRetries) {
                        throw new ApiError(
                            'Request timeout. Your connection is slow. Please check your internet and try again.',
                            408,
                            { networkError: true, timeout: true }
                        );
                    }
                    
                    // Wait before retry with exponential backoff
                    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);
                    console.log(`⏳ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Handle API errors
                if (error instanceof ApiError) {
                    // Don't retry on client errors (4xx) except for specific cases
                    if (error.status >= 400 && error.status < 500 && 
                        error.status !== 408 && error.status !== 429) {
                        throw error;
                    }
                    
                    // Retry on server errors (5xx) and specific client errors
                    if (attempt < maxRetries && 
                        (error.status >= 500 || error.status === 408 || error.status === 429)) {
                        const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);
                        console.log(`🔄 Retrying request (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms due to error:`, error.status);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    throw error;
                }

                // ✅ FIX 10: SPECIFIC MOBILE NETWORK ERROR MESSAGES
                console.error(`🌐 Network Error (attempt ${attempt + 1}):`, {
                    message: error.message,
                    name: error.name,
                    url: url,
                    isCorsError,
                    isNetworkError
                });

                // CORS errors should be reported immediately (not retried)
                if (isCorsError) {
                    console.error('❌ CORS Error detected - likely misconfigured API URL or domain not authorized');
                    throw new ApiError(
                        'Unable to connect to server. CORS error detected. Check API configuration.',
                        0,
                        { networkError: true, corsError: true, originalError: error }
                    );
                }

                // Retry on network errors
                if (attempt < maxRetries) {
                    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);
                    console.log(`🔄 Retrying request (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms due to network error`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Final attempt failed - throw appropriate error
                if (isNetworkError) {
                    throw new ApiError(
                        'Unable to connect to server. Please check your internet connection and API configuration.',
                        0,
                        { originalError: error, networkError: true }
                    );
                }

                throw new ApiError(
                    error.message || 'Network error occurred',
                    0,
                    { originalError: error, networkError: true }
                );
            }
        }
        
        // This should never be reached, but just in case
        throw lastError || new ApiError('Maximum retry attempts exceeded', 0, { networkError: true });
    }

    /**
     * ✅ ENHANCED REQUEST METHOD WITH MOBILE FIXES
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log('📍 API URL being called:', url);
        console.log('📍 Base URL:', this.baseURL);
        console.log('📍 Endpoint:', endpoint);
        
        // ✅ FIX 11: WARN IF API IS MISCONFIGURED
        if (this.isMisconfigured) {
            console.warn('⚠️ API Configuration Issue: VITE_API_BASE_URL not properly configured');
        }

        // ✅ RAILWAY COLD START DETECTION (for first request)
        const coldStartInfo = await this.detectAndHandleColdStart(url);
        if (coldStartInfo.isColdStart) {
            console.log('❄️ Railway cold start detected, adjusting strategy...');
        }

        const config = {
            method: 'GET',
            headers: { ...this.defaultHeaders },
            ...options,
        };

        // Add authorization header if token exists (cookie is also sent via credentials)
        const token = this.getAuthToken();
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('🔐 Authorization header added');
        }

        // ✅ FIX 12: ENSURE CREDENTIALS ARE SENT FOR MOBILE/CROSS-ORIGIN
        config.credentials = 'include';

        // Handle request body
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        // ✅ USE ENHANCED RETRY MECHANISM WITH MOBILE ERROR DETECTION
        const maxRetries = coldStartInfo.isColdStart ? 4 : 3; // Extra retry for cold starts
        return this.requestWithRetry(url, config, maxRetries);
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    /**
     * POST request
     */
    async post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body,
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body,
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    /**
     * ✅ PATCH request
     */
    async patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body,
        });
    }

    /**
     * ✅ FIX 13: CHECK IF STORAGE IS AVAILABLE (mobile private mode fix)
     */
    isStorageAvailable(type = 'localStorage') {
        try {
            const storage = window[type];
            const test = '__storage_test__';
            storage.setItem(test, test);
            storage.removeItem(test);
            console.log(`✅ ${type} is available`);
            return true;
        } catch (error) {
            console.warn(`⚠️ ${type} not available (private mode or quota exceeded):`, error.message);
            return false;
        }
    }

    /**
     * ✅ Get authentication token using unified storage
     */
    getAuthToken() {
        try {
            const token = storage.getItem(AUTH_CONFIG.TOKEN_KEY);
            if (token) {
                console.log('✅ Token retrieved from storage');
            }
            return token;
        } catch (error) {
            console.error('❌ Error accessing token storage:', error);
            return null;
        }
    }

    /**
     * ✅ Set authentication token using unified storage
     */
    setAuthToken(token) {
        try {
            const success = storage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
            if (success) {
                console.log('✅ Token stored successfully');
            }
            return success;
        } catch (error) {
            console.error('❌ Error setting token in storage:', error);
            return false;
        }
    }

    /**
     * ✅ Remove authentication token using unified storage
     */
    removeAuthToken() {
        try {
            storage.removeItem(AUTH_CONFIG.TOKEN_KEY);
            console.log('✅ Token removed from storage');
        } catch (error) {
            console.error('❌ Error removing token from storage:', error);
        }
    }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * API client instance
 */
const apiClient = new ApiClient();

/**
 * Authentication API endpoints
 */
export const authAPI = {
    /**
     * User login
     */
    async login(credentials) {
        return apiClient.post('/users/login', credentials);
    },
 //Admin login
    async adminLogin(credentials) {
        return apiClient.post('/admin/login', credentials);
    },
    /**
     * User registration
     */
    async register(userData) {
        return apiClient.post('/users/register', userData);
    },

    /**
     * Social authentication (Google, Facebook, etc.)
     */
    async socialAuth(socialData) {
        return apiClient.post('/users/social-auth', socialData);
    },

    /**
     * Get user profile
     */
    async getProfile(token = null) {
        if (token) {
            const currentToken = apiClient.getAuthToken();
            apiClient.setAuthToken(token);
            try {
                const result = await apiClient.get('/users/profile');
                apiClient.setAuthToken(currentToken);
                return result;
            } catch (error) {
                apiClient.setAuthToken(currentToken);
                throw error;
            }
        }
        return apiClient.get('/users/profile');
    },

    /**
     * Update user profile
     */
    async updateProfile(token, updateData) {
        if (token) {
            const currentToken = apiClient.getAuthToken();
            apiClient.setAuthToken(token);
            try {
                const result = await apiClient.put('/users/profile', updateData);
                apiClient.setAuthToken(currentToken);
                return result;
            } catch (error) {
                apiClient.setAuthToken(currentToken);
                throw error;
            }
        }
        return apiClient.put('/users/profile', updateData);
    },

    /**
     * Check if email exists
     */
    async checkEmail(email) {
        return apiClient.post('/users/check-email', { email });
    },

    /**
     * Refresh authentication token
     */
    async refreshToken() {
        return apiClient.post('/auth/refresh');
    },

    /**
     * Logout user
     */
    async logout() {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            // Continue with local logout even if API call fails
            console.warn('Logout API call failed:', error.message);
        }
        apiClient.removeAuthToken();
    },
};

/**
 * Competition API endpoints
 */
export const competitionAPI = {
    /**
     * Get all competitions
     */
    async getAll(params = {}) {
        return apiClient.get('/competitions', params);
    },

    /**
     * Get competition by ID
     */
    async getById(id) {
        return apiClient.get(`/competitions/${id}`);
    },

    /**
     * Register for competition
     */
    async register(competitionId, registrationData) {
        return apiClient.post(`/competitions/${competitionId}/register`, registrationData);
    },

    /**
     * Get user's registered competitions
     */
    async getUserRegistrations() {
        return apiClient.get('/competitions/my-registrations');
    },

    /**
     * Cancel competition registration
     */
    async cancelRegistration(competitionId) {
        return apiClient.delete(`/competitions/${competitionId}/register`);
    },
};

/**
 * Fest organizer API endpoints
 */
export const festOrganizerAPI = {
    /**
     * Get all fests
     */
    async getAll(params = {}) {
        return apiClient.get('/fest-organizers', params);
    },

    /**
     * Get fest by ID
     */
    async getById(id) {
        return apiClient.get(`/fest-organizers/${id}`);
    },

    /**
     * Create new fest
     */
    async create(festData) {
        return apiClient.post('/fest-organizers', festData);
    },

    /**
     * Update fest
     */
    async update(id, festData) {
        return apiClient.put(`/fest-organizers/${id}`, festData);
    },

    /**
     * Delete fest
     */
    async delete(id) {
        return apiClient.delete(`/fest-organizers/${id}`);
    },
};

/**
 * File upload API endpoints
 */
export const fileAPI = {
    /**
     * Upload file
     */
    async upload(file, type = 'general') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        return apiClient.request('/upload', {
            method: 'POST',
            body: formData,
            headers: {}, // Remove Content-Type header to let browser set it with boundary
        });
    },

    /**
     * Upload multiple files
     */
    async uploadMultiple(files, type = 'general') {
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append(`files[${index}]`, file);
        });
        formData.append('type', type);

        return apiClient.request('/upload/multiple', {
            method: 'POST',
            body: formData,
            headers: {}, // Remove Content-Type header to let browser set it with boundary
        });
    },
};

/**
 * Handle API errors and return user-friendly messages
 */
export const handleApiError = (error) => {
    // Handle ApiError instances
    if (error instanceof ApiError) {
        switch (error.status) {
            case 400:
                return error.data?.message || 'Invalid request. Please check your input.';
            case 401:
                // Handle authentication errors
                apiClient.removeAuthToken();
                return 'Session expired. Please login again.';
            case 403:
                return 'You do not have permission to perform this action.';
            case 404:
                return error.data?.message || 'The requested resource was not found.';
            case 408:
                return 'Request timeout. Please try again.';
            case 409:
                return error.data?.message || 'Conflict: Resource already exists.';
            case 422:
                return error.data?.message || 'Validation error. Please check your input.';
            case 429:
                return 'Too many requests. Please try again later.';
            case 500:
                return 'Server error. Please try again later.';
            case 502:
            case 503:
            case 504:
                return 'Service temporarily unavailable. Please try again later.';
            default:
                return error.message || 'An unexpected error occurred.';
        }
    }

    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return 'Network error. Please check your internet connection.';
    }

    // Handle validation errors from backend
    if (error.response && error.response.data && error.response.data.errors) {
        const errors = error.response.data.errors;
        if (Array.isArray(errors)) {
            return errors.map(err => err.message || err).join(', ');
        }
        return errors.message || errors;
    }

    // Default error handling
    return error.message || 'An unexpected error occurred. Please try again.';
};

/**
 * API interceptors for common functionality
 */
export const apiInterceptors = {
    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        // This would be implemented if using axios or similar
        console.warn('Request interceptors not implemented for fetch API');
    },

    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        // This would be implemented if using axios or similar
        console.warn('Response interceptors not implemented for fetch API');
    },
};

/**
 * Utility functions
 */
export const apiUtils = {
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!apiClient.getAuthToken();
    },

    /**
     * Get current auth token
     */
    getToken() {
        return apiClient.getAuthToken();
    },

    /**
     * Set auth token
     */
    setToken(token) {
        apiClient.setAuthToken(token);
    },

    /**
     * Clear auth token
     */
    clearToken() {
        apiClient.removeAuthToken();
    },

    /**
     * Build query string from object
     */
    buildQueryString(params) {
        return new URLSearchParams(params).toString();
    },

    /**
     * Validate response data
     */
    validateResponse(response, requiredFields = []) {
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response format');
        }

        for (const field of requiredFields) {
            if (!(field in response)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        return true;
    },
};

// Export the main API client for advanced usage
export { apiClient };

// Export error class for type checking
export { ApiError };