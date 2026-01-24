import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI, handleApiError } from '../../utils/api';
import { processSocialAuthUser, handleSocialAuthError, validateSocialAuthResult } from '../../utils/socialAuth';
import { loginWithEmail, signInWithGoogle, signInWithFacebook } from '../../firebase';

export default function CrwdCtrlLogin({ onClose, onSwitchToRegister }) {
    const [showPassword, setShowPassword] = useState(false);
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const { login } = useAuth();
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();

    // Redirect admin if already logged in (when visiting /login page directly)
    useEffect(() => {
        // Only check if this is the standalone login page (not a modal)
        if (!onClose && location.pathname === '/login') {
            const adminToken = localStorage.getItem('admin_token');
            if (adminToken) {
                navigate('/admin', { replace: true });
            }
        }
    }, [onClose, location.pathname, navigate]);

const handleLogin = async (e) => {
  e.preventDefault();
  setErrors({});
  setIsLoading(true);

  // Log device and browser details for debugging
  console.log('📱 Device Info:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
  });

  if (!emailOrPhone.trim() || !password.trim()) {
    setErrors({ general: 'Email and password are required' });
    setIsLoading(false);
    return;
  }

  // Check network connectivity before attempting login
  if (!navigator.onLine) {
    setErrors({ general: 'No internet connection. Please check your network and try again.' });
    setIsLoading(false);
    return;
  }

  /* ==========================
     🔐 STEP 1: ADMIN LOGIN CHECK (ENV BASED)
     - MUST be checked FIRST before Firebase
     - If admin credentials match, skip Firebase entirely
     - Firebase is NEVER called for admin login
     ========================== */
  let adminLoginAttempted = false;
  let adminLoginSucceeded = false;
  
  try {
    adminLoginAttempted = true;
    const adminData = await authAPI.adminLogin({
      email: emailOrPhone.trim(),
      password
    });

    // Check for token in various possible response structures
    const adminToken = adminData?.token || 
                      adminData?.data?.token || 
                      adminData?.response?.token;

    // Admin login succeeded - handle admin flow
    if (adminToken) {
      adminLoginSucceeded = true;
      
      // Store admin token
      localStorage.setItem('admin_token', adminToken);
      
      // Close modal if it exists (when used from Dashboard)
      if (onClose) {
        onClose();
      }
      
      // Navigate to admin dashboard with replace to prevent back navigation
      navigate('/admin', { replace: true });
      
      // CRITICAL: Stop execution here - do NOT call Firebase
      setIsLoading(false);
      return;
    }
  } catch (adminError) {
    // Admin login failed - analyze the error carefully
    // ApiError structure: { message, status, data }
    const errorStatus = adminError?.status || 0;
    const errorMessage = (adminError?.message || '').toLowerCase();
    const errorDataMessage = (adminError?.data?.message || '').toLowerCase();
    
    // Debug logging to help diagnose issues
    console.log('🔐 Admin login error analysis:', {
      status: errorStatus,
      message: adminError?.message,
      dataMessage: adminError?.data?.message,
      fullError: adminError
    });
    
    // For non-401 errors (network, 404, 500, etc):
    // These are technical errors, not credential mismatches
    // We should NOT call Firebase because we can't be sure if these are admin credentials
    if (errorStatus !== 401 && errorStatus !== 0) {
      const userMessage = errorStatus === 404
        ? 'Admin login endpoint not found. Please contact support.'
        : `Admin login failed (${errorStatus}). Please try again or contact support.`;
      
      setErrors({ general: userMessage });
      setIsLoading(false);
      return; // CRITICAL: Do NOT proceed to Firebase for technical errors
    }
    
    // For network errors (status 0):
    // Could be CORS, network issue, or backend not running
    // Don't call Firebase - show error instead
    if (errorStatus === 0) {
      setErrors({ 
        general: 'Network error. Please check your connection and ensure the backend is running.' 
      });
      setIsLoading(false);
      return; // CRITICAL: Do NOT proceed to Firebase for network errors
    }
    
    // For 401 errors: Admin API checked credentials and they don't match admin
    // This could mean:
    // 1. User entered wrong admin credentials → Should show error, not try Firebase
    // 2. User entered normal user credentials → Should try Firebase
    
    // Since we can't distinguish, we'll proceed to Firebase BUT:
    // If Firebase also fails, we'll show a combined error message
    // This allows normal users to login while preventing unnecessary Firebase calls for admin attempts
    
    // Continue to user login flow below
    adminLoginSucceeded = false;
  }

  // Only proceed to Firebase if admin login clearly indicated "not admin"
  // (i.e., we got a 401 with "invalid admin credentials" message)

  /* ==========================
     👤 STEP 2: USER LOGIN (FIREBASE + BACKEND USER)
     - Only reached if admin login failed with 401 (credentials don't match admin)
     - This could be normal user credentials OR wrong admin credentials
     - Try Firebase to determine which case it is
     ========================== */
  try {
    // Firebase email/password authentication with retry logic
    let firebaseResult = await loginWithEmail(emailOrPhone, password);

    // Retry once on network-related failures (not credential errors)
    if (!firebaseResult.success) {
      const firebaseError = firebaseResult.error || '';
      const isNetworkError = firebaseError.toLowerCase().includes('network') ||
                             firebaseError.toLowerCase().includes('timeout') ||
                             firebaseError.toLowerCase().includes('unavailable') ||
                             firebaseError.toLowerCase().includes('internal-error');

      if (isNetworkError) {
        console.log('🔄 Retrying Firebase authentication due to network error...');
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        firebaseResult = await loginWithEmail(emailOrPhone, password);
      }
    }

    if (!firebaseResult.success) {
      // Firebase also failed - this could mean:
      // 1. Wrong admin credentials (admin email not in Firebase)
      // 2. Wrong user credentials (user email not in Firebase)
      //
      // Since admin login also failed, show a helpful error message
      const firebaseError = firebaseResult.error || '';
      const isInvalidCredential = firebaseError.toLowerCase().includes('invalid-credential') ||
                                  firebaseError.toLowerCase().includes('invalid credential') ||
                                  firebaseError.toLowerCase().includes('user-not-found') ||
                                  firebaseError.toLowerCase().includes('wrong-password');

      if (isInvalidCredential) {
        // Both admin and Firebase failed - likely wrong credentials
        // Show a message that covers both cases
        setErrors({
          general: 'Invalid credentials. Please check your email and password. If you are an admin, ensure your admin credentials are correct.'
        });
      } else {
        // Firebase error for other reasons (network, etc.)
        const isMobileNetworkError = firebaseError.toLowerCase().includes('network') ||
                                     firebaseError.toLowerCase().includes('timeout') ||
                                     firebaseError.toLowerCase().includes('unavailable');
        if (isMobileNetworkError) {
          setErrors({
            general: 'Network error. Please check your internet connection and try again. If using mobile data, try switching to Wi-Fi.'
          });
        } else {
          setErrors({ general: firebaseResult.error });
        }
      }

      setIsLoading(false);
      return;
    }

    // Backend user login with Firebase UID
    const data = await authAPI.login({
      email: emailOrPhone.trim(),
      password,
      firebaseUid: firebaseResult.user.uid
    });

    // Update AuthContext with user data
    login(
      { ...data.data.user, token: data.data.token },
      firebaseResult.user
    );

    // Navigate to user dashboard
    if (onClose) {
      onClose();
    } else {
      navigate('/');
    }

  } catch (error) {
    console.error('❌ Login error:', error);
    setErrors({ general: handleApiError(error) });
  } finally {
    setIsLoading(false);
  }
};
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            navigate('/');
        }
    };

    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setErrors({});

        try {
            const result = await signInWithGoogle();

            if (!result.success) {
                setErrors({ general: result.error });
                return;
            }

            if (!validateSocialAuthResult(result)) {
                setErrors({ general: 'Invalid authentication result. Please try again.' });
                return;
            }

            const { user } = result;

            // Process user data for backend
            const socialAuthData = processSocialAuthUser(user, 'google');
            socialAuthData.isVerified = true; // Social auth users are pre-verified

            const data = await authAPI.socialAuth(socialAuthData);

            // Auto login after successful social authentication
            login({
                ...data.data.user,
                token: data.data.token
            }, user);

            // Close modal and go to dashboard (social auth users don't need email verification)
            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('Google authentication error:', error);
            setErrors({ general: handleSocialAuthError(error, 'Google') });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFacebookAuth = async () => {
        setIsLoading(true);
        setErrors({});

        try {
            const result = await signInWithFacebook();

            if (!result.success) {
                setErrors({ general: result.error });
                return;
            }

            if (!validateSocialAuthResult(result)) {
                setErrors({ general: 'Invalid authentication result. Please try again.' });
                return;
            }

            const { user } = result;

            // Process user data for backend
            const socialAuthData = processSocialAuthUser(user, 'facebook');
            socialAuthData.isVerified = true; // Social auth users are pre-verified

            const data = await authAPI.socialAuth(socialAuthData);

            // Auto login after successful social authentication
            login({
                ...data.data.user,
                token: data.data.token
            }, user);

            // Close modal and go to dashboard (social auth users don't need email verification)
            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('Facebook authentication error:', error);
            setErrors({ general: handleSocialAuthError(error, 'Facebook') });
        } finally {
            setIsLoading(false);
        }
    
    };

    return (
        <>
            {/* Background overlay with blur */}
            <div className={`absolute inset-0 backdrop-blur-sm  ${isDark ? 'bg-black/85' : 'bg-white/85'}`} onClick={handleClose}></div>

            {/* Login Modal Container */}
            <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
                <div
                    className={`relative rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm p-4 sm:p-6 transition-colors duration-300 
        ${isDark ? 'bg-[#1B1C1E] text-white' : 'bg-white text-gray-900'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className={`absolute top-4 right-4 transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        <X size={22} />
                    </button>

                    {/* Logo */}
                    <div className="text-center mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#053780] to-[#0ECCEE]">
                            CRWDCTRL
                        </h1>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Error Message */}
                        {errors.general && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                                <span className="block sm:inline">{errors.general}</span>
                                {errors.general.includes('No account found') && (
                                    <button
                                        onClick={onSwitchToRegister}
                                        className="block mt-2 text-blue-600 hover:text-blue-700 font-medium underline"
                                    >
                                        Go to Register Page
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Email or Phone Input */}
                        <div>
                            <input
                                type="text"
                                placeholder="Enter your Email "
                                value={emailOrPhone}
                                onChange={(e) => setEmailOrPhone(e.target.value)}
                                className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                        ${errors.emailOrPhone ? 'border-red-500' : ''}
                        ${isDark
                                        ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                        : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                    } focus:outline-none focus:ring-2`}
                            />
                            {errors.emailOrPhone && <p className="text-red-500 text-sm mt-1">{errors.emailOrPhone}</p>}
                        </div>

                        {/* Password Input */}
                        <div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                            ${errors.password ? 'border-red-500' : ''}
                            ${isDark
                                            ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                            : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                        } focus:outline-none focus:ring-2`}
                                />
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    type="button"
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                        </div>

                        {/* Continue Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full font-semibold py-2 sm:py-2.5 rounded-lg transition-colors ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                } text-white`}
                        >
                            {isLoading ? 'Logging in...' : 'Continue'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-3 sm:my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className={`w-full border-t ${isDark ? 'border-gray-700' : 'border-gray-300'}`}></div>
                        </div>

                        <div className={`relative flex justify-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-white'} px-4`}>
                                or continue with
                            </span>
                        </div>
                    </div>

                    {/* Social Buttons */}
                    <div className="flex flex-col gap-3">

                        {/* Facebook */}
                        <button
                            onClick={handleFacebookAuth}
                            disabled={isLoading}
                            className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm ${isLoading
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                                } ${isDark
                                    ? 'bg-[#2A2B2D] text-white hover:bg-[#3A3B3D]'
                                    : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="#1877F2" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>

                            {isLoading ? 'Connecting...' : 'Continue with Facebook'}
                        </button>

                        {/* Google */}
                        <button
                            onClick={handleGoogleAuth}
                            disabled={isLoading}
                            className={`flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm ${isLoading
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                                } ${isDark
                                    ? 'bg-[#2A2B2D] text-white hover:bg-[#3A3B3D]'
                                    : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>

                            {isLoading ? 'Connecting...' : 'Continue with Google'}
                        </button>

                    </div>


                    {/* Register Link */}
                    <div className="text-center mt-4">
                        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                            Don't have an account?{' '}
                            <button
                                onClick={() => {
                                    if (onSwitchToRegister) {
                                        onSwitchToRegister();
                                    } else {
                                        navigate('/register');
                                    }
                                }}
                                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                            >
                                Sign Up
                            </button>
                        </p>
                    </div>
                </div>
            </div>

        </>
    );
}