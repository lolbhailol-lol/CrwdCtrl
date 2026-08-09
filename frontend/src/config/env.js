// Environment configuration for CrwdCtrl
import { getApiBaseUrl } from './apiBase.js';

// API Configuration
export const API_CONFIG = {
    BASE_URL: getApiBaseUrl(),
    TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
    // ✅ MOBILE-SPECIFIC TIMEOUTS
    MOBILE_TIMEOUT: parseInt(import.meta.env.VITE_MOBILE_API_TIMEOUT) || 30000,
    AUTH_TIMEOUT: parseInt(import.meta.env.VITE_AUTH_API_TIMEOUT) || 30000,
};

// App Configuration
export const APP_CONFIG = {
    NAME: import.meta.env.VITE_APP_NAME || 'CrwdCtrl',
    VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
    ENVIRONMENT: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
};

// Authentication Configuration
export const AUTH_CONFIG = {
    TOKEN_KEY: import.meta.env.VITE_JWT_TOKEN_KEY || 'crwdctrl_token',
    SESSION_TIMEOUT: parseInt(import.meta.env.VITE_SESSION_TIMEOUT) || 86400000, // 24 hours
};

// Feature Flags
export const FEATURES = {
    NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true',
    DARK_MODE: import.meta.env.VITE_ENABLE_DARK_MODE === 'true',
    FAVORITES: import.meta.env.VITE_ENABLE_FAVORITES === 'true',
    CAMPUS_HUNT: import.meta.env.VITE_ENABLE_CAMPUS_HUNT === 'true',
};

// File Upload Configuration
export const UPLOAD_CONFIG = {
    MAX_FILE_SIZE: parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 5242880, // 5MB
    ALLOWED_FILE_TYPES: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf'
    ],
};

// Pagination Configuration
export const PAGINATION_CONFIG = {
    DEFAULT_PAGE_SIZE: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 10,
    MAX_PAGE_SIZE: parseInt(import.meta.env.VITE_MAX_PAGE_SIZE) || 50,
};

// Search Configuration
export const SEARCH_CONFIG = {
    MIN_SEARCH_LENGTH: parseInt(import.meta.env.VITE_MIN_SEARCH_LENGTH) || 3,
    DEBOUNCE_TIME: parseInt(import.meta.env.VITE_SEARCH_DEBOUNCE_TIME) || 300,
};

// Location Configuration
export const LOCATION_CONFIG = {
    DEFAULT_LATITUDE: parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) || 28.6139,
    DEFAULT_LONGITUDE: parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) || 77.2090,
};

// Social Media Configuration
export const SOCIAL_CONFIG = {
    FACEBOOK_APP_ID: import.meta.env.VITE_FACEBOOK_APP_ID || '',
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    TWITTER_API_KEY: import.meta.env.VITE_TWITTER_API_KEY || '',
};

// Analytics Configuration
export const ANALYTICS_CONFIG = {
    GOOGLE_ANALYTICS_ID: import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '',
    HOTJAR_ID: import.meta.env.VITE_HOTJAR_ID || '',
};

// Error Tracking Configuration
export const ERROR_TRACKING_CONFIG = {
    SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || '',
};

// Cache Configuration
export const CACHE_CONFIG = {
    DURATION: parseInt(import.meta.env.VITE_CACHE_DURATION) || 300000, // 5 minutes
    IMAGE_DURATION: parseInt(import.meta.env.VITE_IMAGE_CACHE_DURATION) || 3600000, // 1 hour
};

// Development helpers
export const isDevelopment = () => APP_CONFIG.ENVIRONMENT === 'development';
export const isProduction = () => APP_CONFIG.ENVIRONMENT === 'production';

// Validation helpers
export const validateConfig = () => {
    const requiredEnvVars = [
        'VITE_API_BASE_URL',
    ];

    const missingVars = requiredEnvVars.filter(
        varName => !import.meta.env[varName]
    );

    if (missingVars.length > 0) {
        console.warn('Missing required environment variables:', missingVars);
    }

    return missingVars.length === 0;
};

// Export all configurations as a single object
export const ENV_CONFIG = {
    API: API_CONFIG,
    APP: APP_CONFIG,
    AUTH: AUTH_CONFIG,
    FEATURES,
    UPLOAD: UPLOAD_CONFIG,
    PAGINATION: PAGINATION_CONFIG,
    SEARCH: SEARCH_CONFIG,
    LOCATION: LOCATION_CONFIG,
    SOCIAL: SOCIAL_CONFIG,
    ANALYTICS: ANALYTICS_CONFIG,
    ERROR_TRACKING: ERROR_TRACKING_CONFIG,
    CACHE: CACHE_CONFIG,
};