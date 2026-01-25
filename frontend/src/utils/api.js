// API utility functions for CrwdCtrl frontend
import { API_CONFIG, AUTH_CONFIG } from '../config/env.js';

/**
 * Base API configuration and utilities
 */
class ApiClient {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.timeout = API_CONFIG.TIMEOUT;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Make HTTP request with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

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

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            config.signal = controller.signal;

            console.log('📤 API Request:', {
                method: config.method,
                url: url,
                headers: config.headers,
                hasBody: !!config.body
            });

            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            console.log('📥 API Response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
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
                    data: data
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
            if (error.name === 'AbortError') {
                console.error('⏰ API Request Timeout:', url);
                throw new ApiError('Request timeout', 408);
            }

            if (error instanceof ApiError) {
                throw error;
            }

            // Enhanced network error handling
            console.error('🌐 Network Error:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                url: url
            });

            // Check for specific network error types
            if (error.message.includes('Failed to fetch')) {
                throw new ApiError(
                    'Unable to connect to server. Please check your internet connection and try again.',
                    0,
                    { originalError: error, networkError: true }
                );
            }

            if (error.message.includes('NetworkError')) {
                throw new ApiError(
                    'Network error occurred. Please check your connection and try again.',
                    0,
                    { originalError: error, networkError: true }
                );
            }

            if (error.message.includes('CORS')) {
                throw new ApiError(
                    'Cross-origin request blocked. Please contact support.',
                    0,
                    { originalError: error, corsError: true }
                );
            }

            // Generic network error
            throw new ApiError(
                error.message || 'Network error occurred',
                0,
                { originalError: error }
            );
        }
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