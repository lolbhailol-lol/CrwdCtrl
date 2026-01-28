// API utility functions for CrwdCtrl frontend
import { API_CONFIG, AUTH_CONFIG } from '../config/env.js';

/**
 * Base API configuration and utilities
 */
class ApiClient {
    constructor() {
        // Use Vite environment variables for API base URL
        this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
        this.timeout = API_CONFIG.TIMEOUT;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * ✅ ENHANCED MOBILE-OPTIMIZED TIMEOUT CALCULATION
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
        
        let baseTimeout = this.timeout; // Default 15s
        
        if (isMobile) {
            baseTimeout = isAuthEndpoint ? 35000 : 25000; // 35s for auth, 25s for other requests on mobile
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
     * ✅ ENHANCED RETRY MECHANISM WITH EXPONENTIAL BACKOFF
     */
    async requestWithRetry(url, config, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = this.getMobileOptimizedTimeout(url);
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                config.signal = controller.signal;

                console.log(`📤 API Request (attempt ${attempt + 1}/${maxRetries + 1}):`, {
                    method: config.method,
                    url: url,
                    timeout: timeout,
                    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                    connection: navigator.connection?.effectiveType || 'unknown'
                });

                const response = await fetch(url, config);
                clearTimeout(timeoutId);

                console.log('📥 API Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    attempt: attempt + 1
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
                
                // Handle timeout errors
                if (error.name === 'AbortError') {
                    console.error(`⏰ API Request Timeout (attempt ${attempt + 1}):`, url);
                    
                    // Don't retry on timeout for the last attempt
                    if (attempt === maxRetries) {
                        throw new ApiError(
                            'Request timeout. Please check your internet connection and try again.',
                            408,
                            { networkError: true, timeout: true }
                        );
                    }
                    
                    // Wait before retry with exponential backoff
                    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000); // Max 10s delay
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

                // Handle network errors
                console.error(`🌐 Network Error (attempt ${attempt + 1}):`, {
                    message: error.message,
                    name: error.name,
                    url: url
                });

                // Retry on network errors
                if (attempt < maxRetries) {
                    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000);
                    console.log(`🔄 Retrying request (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms due to network error`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Final attempt failed - throw appropriate error
                if (error.message.includes('Failed to fetch') || 
                    error.message.includes('NetworkError') ||
                    error.message.includes('fetch')) {
                    throw new ApiError(
                        'Unable to connect to server. Please check your internet connection and try again.',
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
     * ✅ ENHANCED REQUEST METHOD WITH MOBILE OPTIMIZATIONS
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        console.log('📍 API URL being called:', url);
        console.log('📍 Base URL:', this.baseURL);
        console.log('📍 Endpoint:', endpoint);

        const config = {
            method: 'GET',
            headers: { ...this.defaultHeaders },
            ...options,
        };

        // Add authorization header if token exists
        const token = this.getAuthToken();
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Handle request body
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        // ✅ USE RETRY MECHANISM FOR MOBILE RELIABILITY
        return this.requestWithRetry(url, config);
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
     * PATCH request
     */
    async patch(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body,
        });
    }

    /**
     * Get authentication token from localStorage
     */
    getAuthToken() {
        try {
            return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return null;
        }
    }

    /**
     * Set authentication token in localStorage
     */
    setAuthToken(token) {
        try {
            localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
        } catch (error) {
            console.error('Error setting token in localStorage:', error);
        }
    }

    /**
     * Remove authentication token from localStorage
     */
    removeAuthToken() {
        try {
            localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
        } catch (error) {
            console.error('Error removing token from localStorage:', error);
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