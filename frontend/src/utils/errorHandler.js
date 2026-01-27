/**
 * Comprehensive Error Handler for CrwdCtrl Frontend
 * Handles all error types: Network, Auth, API, Validation
 */

/**
 * Error Types
 */
export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR',
  NOT_FOUND: '404_ERROR',
  UNAUTHORIZED: '401_ERROR',
  FORBIDDEN: '403_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

/**
 * Error Handler Class
 */
export class ErrorHandler {
  /**
   * Parse error response
   */
  static parseError(error) {
    console.error('🔴 Error caught:', error);

    if (!error) {
      return {
        type: ErrorTypes.UNKNOWN,
        message: 'An unknown error occurred',
        status: 0,
      };
    }

    // Network error (fetch failed)
    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
      return {
        type: ErrorTypes.NETWORK,
        message: 'Unable to connect to server. Please check your internet connection.',
        status: 0,
      };
    }

    // AbortError (timeout)
    if (error.name === 'AbortError') {
      return {
        type: ErrorTypes.NETWORK,
        message: 'Request timeout. Please try again.',
        status: 408,
      };
    }

    // API Response error
    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            type: ErrorTypes.VALIDATION,
            message: error.message || 'Invalid request. Please check your input.',
            status: 400,
          };
        case 401:
          return {
            type: ErrorTypes.UNAUTHORIZED,
            message: 'Your session has expired. Please log in again.',
            status: 401,
          };
        case 403:
          return {
            type: ErrorTypes.FORBIDDEN,
            message: 'You do not have permission to perform this action.',
            status: 403,
          };
        case 404:
          return {
            type: ErrorTypes.NOT_FOUND,
            message: 'The requested resource was not found.',
            status: 404,
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: ErrorTypes.SERVER,
            message: 'Server error. Please try again later.',
            status: error.status,
          };
        default:
          return {
            type: ErrorTypes.SERVER,
            message: error.message || `Server error (${error.status})`,
            status: error.status,
          };
      }
    }

    // Generic message error
    if (error.message) {
      return {
        type: ErrorTypes.UNKNOWN,
        message: error.message,
        status: 0,
      };
    }

    return {
      type: ErrorTypes.UNKNOWN,
      message: 'An unexpected error occurred',
      status: 0,
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error) {
    const parsed = this.parseError(error);
    return parsed.message;
  }

  /**
   * Check if error is auth-related
   */
  static isAuthError(error) {
    const parsed = this.parseError(error);
    return [ErrorTypes.UNAUTHORIZED, ErrorTypes.FORBIDDEN].includes(parsed.type);
  }

  /**
   * Check if error is network-related
   */
  static isNetworkError(error) {
    const parsed = this.parseError(error);
    return parsed.type === ErrorTypes.NETWORK;
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error) {
    const parsed = this.parseError(error);
    return [
      ErrorTypes.NETWORK,
      ErrorTypes.SERVER,
      ErrorTypes.VALIDATION,
    ].includes(parsed.type);
  }

  /**
   * Log error for debugging
   */
  static logError(context, error) {
    const parsed = this.parseError(error);
    console.error(`❌ [${context}]`, {
      type: parsed.type,
      message: parsed.message,
      status: parsed.status,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * API Error Handler
 */
export class APIErrorHandler {
  /**
   * Handle fetch response errors
   */
  static async handleResponse(response, endpoint = '') {
    if (response.ok) {
      return response.json();
    }

    const contentType = response.headers.get('content-type');
    let data;

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }
    } catch (e) {
      data = { message: response.statusText };
    }

    const error = new Error(data.message || response.statusText);
    error.status = response.status;
    error.data = data;
    error.endpoint = endpoint;

    console.error(`❌ API Error [${response.status}] at ${endpoint}:`, data);

    throw error;
  }

  /**
   * Handle request errors
   */
  static handleRequestError(error, endpoint = '') {
    console.error(`❌ Request Error at ${endpoint}:`, error);

    if (error.status) {
      // Already an API error
      throw error;
    }

    // Network or other error
    const newError = new Error(
      error.message || 'Failed to make request'
    );
    newError.status = 0;
    newError.endpoint = endpoint;

    throw newError;
  }
}

/**
 * Auth Error Handler
 */
export class AuthErrorHandler {
  /**
   * Handle auth errors
   */
  static handleAuthError(error) {
    if (error.status === 401) {
      // Clear auth data
      localStorage.removeItem('crwdctrl_token');
      localStorage.removeItem('crwdctrl_user');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');

      // Redirect to login
      window.location.href = '/login';

      return {
        type: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      };
    }

    if (error.status === 403) {
      return {
        type: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this resource.',
      };
    }

    return {
      type: 'AUTH_ERROR',
      message: error.message || 'Authentication failed',
    };
  }

  /**
   * Handle token refresh failure
   */
  static handleTokenRefreshFailure() {
    // Clear tokens
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');

    // Redirect to login
    window.location.href = '/admin/login';

    return {
      type: 'TOKEN_REFRESH_FAILED',
      message: 'Session expired. Please log in again.',
    };
  }
}

/**
 * Validation Error Handler
 */
export class ValidationErrorHandler {
  /**
   * Format validation error messages
   */
  static formatValidationErrors(errors) {
    if (!errors) return 'Validation failed';

    if (typeof errors === 'string') {
      return errors;
    }

    if (Array.isArray(errors)) {
      return errors.map(e => e.message || e).join(', ');
    }

    if (typeof errors === 'object') {
      return Object.values(errors)
        .map(v => v.message || v)
        .join(', ');
    }

    return 'Validation failed';
  }
}

/**
 * Export error handler function
 */
export const handleError = (error, context = 'Operation') => {
  ErrorHandler.logError(context, error);
  return ErrorHandler.getUserMessage(error);
};

/**
 * Export all error handlers
 */
export default {
  ErrorHandler,
  APIErrorHandler,
  AuthErrorHandler,
  ValidationErrorHandler,
  handleError,
};
