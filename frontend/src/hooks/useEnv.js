import { ENV_CONFIG } from '../config/env.js';

/**
 * Custom hook for accessing environment configuration
 * Provides a centralized way to access environment variables in React components
 */
export const useEnv = () => {
    return {
        // API Configuration
        apiConfig: ENV_CONFIG.API,

        // App Configuration
        appConfig: ENV_CONFIG.APP,

        // Authentication Configuration
        authConfig: ENV_CONFIG.AUTH,

        // Feature Flags
        features: ENV_CONFIG.FEATURES,

        // Upload Configuration
        uploadConfig: ENV_CONFIG.UPLOAD,

        // Pagination Configuration
        paginationConfig: ENV_CONFIG.PAGINATION,

        // Search Configuration
        searchConfig: ENV_CONFIG.SEARCH,

        // Location Configuration
        locationConfig: ENV_CONFIG.LOCATION,

        // Social Media Configuration
        socialConfig: ENV_CONFIG.SOCIAL,

        // Analytics Configuration
        analyticsConfig: ENV_CONFIG.ANALYTICS,

        // Error Tracking Configuration
        errorTrackingConfig: ENV_CONFIG.ERROR_TRACKING,

        // Cache Configuration
        cacheConfig: ENV_CONFIG.CACHE,

        // Helper functions
        isDevelopment: () => ENV_CONFIG.APP.ENVIRONMENT === 'development',
        isProduction: () => ENV_CONFIG.APP.ENVIRONMENT === 'production',

        // Get specific environment variable
        getEnvVar: (key, defaultValue = null) => {
            return import.meta.env[key] || defaultValue;
        },

        // Check if feature is enabled
        isFeatureEnabled: (featureName) => {
            return ENV_CONFIG.FEATURES[featureName] || false;
        },
    };
};

/**
 * Higher-order component to inject environment configuration
 */
// eslint-disable-next-line no-unused-vars
export const withEnv = (_WrappedComponent) => {
    return function WithEnvComponent(props) {
        const env = useEnv();
        return <_WrappedComponent {...props} env={env} />;
    };
};

export default useEnv;