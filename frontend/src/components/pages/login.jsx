import { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import { storage } from '../../utils/storage';

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

    // Determine if this is being used as a modal or a page
    const isModal = !!onClose;
    const isAdminLogin = location.pathname === '/admin/login';

    // Get the intended destination after login
    // Priority: 1) location.state.from, 2) sessionStorage redirect, 3) home
    const getRedirectDestination = () => {
        // Check if passed via router state
        if (location.state?.from?.pathname) {
            console.log('📍 [LOGIN] Redirect from router state:', location.state.from.pathname);
            return location.state.from.pathname;
        }
        // Check sessionStorage for redirect URL (set before navigating to login)
        const savedRedirect = sessionStorage.getItem('auth_redirect_url');
        if (savedRedirect) {
            console.log('📍 [LOGIN] Redirect from sessionStorage:', savedRedirect);
            sessionStorage.removeItem('auth_redirect_url');
            return savedRedirect;
        }
        // Default to home
        console.log('📍 [LOGIN] No redirect found, going to home');
        return '/';
    };

    // Redirect admin if already logged in (when visiting /login page directly)
    useEffect(() => {
        if (!isModal && location.pathname === '/login') {
            const adminToken = storage.getItem('admin_token');
            if (adminToken) {
                navigate('/admin', { replace: true });
            }
        }
    }, [isModal, location.pathname, navigate]);

    // Auto-dismiss errors after 5 seconds (but not "Redirecting..." messages)
    useEffect(() => {
        if (errors.general && !errors.general.includes('Redirecting')) {
            const timer = setTimeout(() => {
                setErrors({});
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errors]);

    // Email/Password Login Handler
    const handleLogin = async (e) => {
        e.preventDefault();
        setErrors({});
        setIsLoading(true);

        if (!emailOrPhone.trim() || !password.trim()) {
            setErrors({ general: 'Email and password are required' });
            setIsLoading(false);
            return;
        }

        try {
            console.log('🔐 [LOGIN] Starting email/password login...');
            
            const result = await authService.loginWithEmail(emailOrPhone.trim(), password);

            if (result.success) {
                if (result.isAdmin) {
                    // Admin login - redirect to admin dashboard
                    console.log('✅ [LOGIN] Admin login successful');
                    if (isModal && onClose) {
                        onClose();
                    }
                    navigate('/admin', { replace: true });
                } else {
                    // User login - update AuthContext and close modal
                    console.log('✅ [LOGIN] User login successful');
                    login({
                        ...result.user,
                        token: result.token
                    });
                    
                    if (isModal && onClose) {
                        onClose();
                    } else {
                        // Not a modal - navigate to intended destination
                        const destination = getRedirectDestination();
                        console.log('🔐 [LOGIN] Not a modal - navigating to:', destination);
                        navigate(destination, { replace: true });
                    }
                }
            } else {
                setErrors({ general: 'Login failed. Please try again.' });
            }
        } catch (error) {
            console.error('❌ [LOGIN] Login error:', error);
            setErrors({ general: error.message || 'Login failed. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            // If not a modal, navigate back to home
            navigate('/');
        }
    };

    // Google Social Login Handler
    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setErrors({});

        try {
            console.log('🚀 [LOGIN] Starting Google authentication...');
            
            const result = await authService.loginWithGoogle();

            // Handle redirect case (mobile)
            if (result.redirectInitiated) {
                console.log('🔄 [LOGIN] Redirect initiated - browser will redirect to Google...');
                setErrors({ 
                    general: result.message || 'Redirecting to Google... Please wait.' 
                });
                setIsLoading(false);
                return;
            }

            if (result.success) {
                console.log('✅ [LOGIN] Google login successful');
                
                // Update AuthContext
                console.log('🔐 [LOGIN] Calling AuthContext login()...');
                login({
                    ...result.user,
                    token: result.token
                }, result.firebaseUser);
                console.log('🔐 [LOGIN] AuthContext login() completed');

                if (isModal && onClose) {
                    console.log('🔐 [LOGIN] Calling onClose() to close modal...');
                    onClose();
                    console.log('🔐 [LOGIN] onClose() called');
                } else {
                    // Not a modal - navigate to intended destination
                    const destination = getRedirectDestination();
                    console.log('🔐 [LOGIN] Not a modal - navigating to:', destination);
                    navigate(destination, { replace: true });
                }
            } else {
                setErrors({ general: result.error || 'Google sign-in failed. Please try again.' });
            }
        } catch (error) {
            console.error('❌ [LOGIN] Google auth error:', error);
            
            let errorMessage = 'Google sign-in failed. Please try again.';
            
            if (error.message.includes('in-app-browser')) {
                setErrors({ 
                    general: error.message,
                    showOpenInBrowser: true,
                    errorDetails: error.errorDetails || null,
                    openInBrowser: error.openInBrowser || null
                });
            } else if (error.message.includes('unauthorized-domain')) {
                errorMessage = 'This domain is not authorized for Google Sign-In. Please contact support.';
                setErrors({ general: errorMessage });
            } else {
                setErrors({ general: error.message || errorMessage });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Facebook Social Login Handler
    const handleFacebookAuth = async () => {
        setIsLoading(true);
        setErrors({});

        try {
            console.log('🚀 [LOGIN] Starting Facebook authentication...');
            
            const result = await authService.loginWithFacebook();

            // Handle redirect case (mobile)
            if (result.redirectInitiated) {
                console.log('🔄 [LOGIN] Redirect initiated - browser will redirect to Facebook...');
                setErrors({ 
                    general: result.message || 'Redirecting to Facebook... Please wait.' 
                });
                return;
            }

            if (result.success) {
                console.log('✅ [LOGIN] Facebook login successful');
                
                // Update AuthContext
                login({
                    ...result.user,
                    token: result.token
                }, result.firebaseUser);

                if (isModal && onClose) {
                    onClose();
                } else {
                    // Not a modal - navigate to intended destination
                    const destination = getRedirectDestination();
                    console.log('🔐 [LOGIN] Not a modal - navigating to:', destination);
                    navigate(destination, { replace: true });
                }
            } else {
                setErrors({ general: result.error || 'Facebook sign-in failed. Please try again.' });
            }
        } catch (error) {
            console.error('❌ [LOGIN] Facebook auth error:', error);
            
            let errorMessage = 'Facebook sign-in failed. Please try again.';
            
            if (error.message.includes('in-app-browser')) {
                setErrors({ 
                    general: error.message,
                    showOpenInBrowser: true,
                    errorDetails: error.errorDetails || null,
                    openInBrowser: error.openInBrowser || null
                });
            } else {
                setErrors({ general: error.message || errorMessage });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Background overlay with blur - only show for modal */}
            {isModal && (
                <div className={`fixed inset-0 backdrop-blur-sm ${isDark ? 'bg-black/85' : 'bg-white/85'}`} onClick={handleClose}></div>
            )}

            {/* Login Modal Container */}
            <div className={`${isModal ? 'fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto' : 'min-h-screen flex items-center justify-center p-4'}`}>
                <div
                    className={`relative rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm p-4 sm:p-6 transition-colors duration-300 my-8
        ${isDark ? 'bg-[#1B1C1E] text-white' : 'bg-white text-gray-900'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button - only show for modal or if not admin login */}
                    {(isModal || !isAdminLogin) && (
                        <button
                            onClick={handleClose}
                            className={`absolute top-4 right-4 transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <X size={22} />
                        </button>
                    )}

                    {/* Logo */}
                    <div className="text-center mb-4 sm:mb-6">
                        <h1 className="text-xl sm:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#053780] to-[#0ECCEE]">
                            CRWDCTRL
                        </h1>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Error Message - Toast Style */}
                        {errors.general && (
                            <div className={`p-4 rounded-lg flex items-start justify-between gap-3 ${
                                errors.general.includes('Redirecting') 
                                    ? 'bg-blue-100 border border-blue-400 text-blue-700'
                                    : 'bg-red-100 border border-red-400 text-red-700'
                            }`}>
                                <span className="block flex-1">{errors.general}</span>
                                <button
                                    type="button"
                                    onClick={() => setErrors({})}
                                    className="text-xl leading-none hover:opacity-70"
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        {errors.general && errors.showOpenInBrowser && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                {/* Enhanced Error Message */}
                                {errors.errorDetails ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-2xl">{errors.errorDetails.icon}</span>
                                            <h3 className="font-semibold text-amber-800">{errors.errorDetails.title}</h3>
                                        </div>
                                        <p className="text-amber-700 text-sm">{errors.errorDetails.suggestion}</p>
                                        <div className="bg-amber-100 rounded p-3 mt-2">
                                            <p className="text-xs text-amber-800 font-medium mb-1">How to open in your browser:</p>
                                            <p className="text-xs text-amber-700">{errors.errorDetails.instructions}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-amber-700 text-sm">{errors.general}</p>
                                )}
                                
                                {/* Open in Browser Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (errors.openInBrowser && typeof errors.openInBrowser === 'function') {
                                            // Use the enhanced openInBrowser function
                                            errors.openInBrowser();
                                        } else {
                                            // Fallback to the old method
                                            const currentUrl = window.location.href;
                                            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                                                window.open(`googlechrome://${currentUrl}`, '_blank') || 
                                                window.open(`firefox://open-url?url=${encodeURIComponent(currentUrl)}`, '_blank') ||
                                                window.open(currentUrl, '_blank');
                                            } else {
                                                window.open(`intent://${currentUrl.replace(/https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`, '_blank') ||
                                                window.open(currentUrl, '_blank');
                                            }
                                        }
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <span>🌐</span>
                                    <span>Open in Browser</span>
                                </button>
                                
                                {/* Alternative: Continue with Email */}
                                <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-2">Or continue without social login:</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setErrors({});
                                            // Focus on email input
                                            document.querySelector('input[type="email"]')?.focus();
                                        }}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
                                    >
                                        Use Email & Password Instead
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Email Input */}
                        <div>
                            <input
                                type="text"
                                placeholder="Enter your Email"
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
                        {/* Google */}
                        <button
                            type="button"
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
                    </div>

                    {/* Register Link */}
                    <div className="text-center mt-4">
                        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                            Don't have an account?{' '}
                            <button
                                onClick={() => {
                                    if (isModal && onSwitchToRegister) {
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
