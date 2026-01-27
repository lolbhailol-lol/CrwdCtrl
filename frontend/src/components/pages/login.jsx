import { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI, handleApiError } from '../../utils/api';
import { processSocialAuthUser, validateSocialAuthResult } from '../../utils/socialAuth';
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

        if (!emailOrPhone.trim() || !password.trim()) {
            setErrors({ general: 'Email and password are required' });
            setIsLoading(false);
            return;
        }

        // Check network connectivity
        if (!navigator.onLine) {
            setErrors({ general: 'No internet connection. Please check your network and try again.' });
            setIsLoading(false);
            return;
        }

        // Try admin login first
        try {
            const adminData = await authAPI.adminLogin({
                email: emailOrPhone.trim(),
                password
            });

            const adminToken = adminData?.token || adminData?.data?.token;

            if (adminToken) {
                localStorage.setItem('admin_token', adminToken);
                
                if (onClose) {
                    onClose();
                }
                
                navigate('/admin', { replace: true });
                setIsLoading(false);
                return;
            }
        } catch (adminError) {
            // If not admin credentials, try user login
            if (adminError?.status !== 401) {
                setErrors({ general: 'Login failed. Please try again.' });
                setIsLoading(false);
                return;
            }
        }

        // Try user login with Firebase
        try {
            const firebaseResult = await loginWithEmail(emailOrPhone, password);

            if (!firebaseResult.success) {
                setErrors({ general: firebaseResult.error });
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
            console.error('Login error:', error);
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

        console.log('🚀 Starting popup-first Google authentication...');
        console.log('📱 Device info:', {
            userAgent: navigator.userAgent,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            touchPoints: navigator.maxTouchPoints,
            platform: navigator.platform
        });

        try {
            const result = await signInWithGoogle();
            console.log('📊 Google auth result:', { 
                success: result.success, 
                method: result.method,
                redirectInitiated: result.redirectInitiated,
                error: result.error,
                code: result.code
            });

            if (!result.success) {
                console.error('❌ Google auth failed:', result.error);
                
                // ✅ Handle in-app browser warning
                if (result.code === 'auth/in-app-browser' && result.showOpenInBrowser) {
                    setErrors({ 
                        general: result.error,
                        showOpenInBrowser: true
                    });
                } else {
                    setErrors({ general: result.error });
                }
                setIsLoading(false);
                return;
            }

            // ✅ Handle redirect fallback case (rare)
            if (result.redirectInitiated) {
                console.log('🔄 Redirect fallback initiated - page will reload automatically...');
                setErrors({ 
                    general: result.message || 'Popup blocked. Redirecting to Google sign-in... Please wait.' 
                });
                return; // Exit here - redirect will handle the rest
            }

            // ✅ Handle successful popup authentication
            if (!result.user) {
                console.error('❌ No user data in result');
                setErrors({ general: 'Authentication failed. Please try again.' });
                setIsLoading(false);
                return;
            }

            const { user } = result;
            console.log('✅ User authenticated via popup:', user.email);

            // Process user data for backend
            const socialAuthData = processSocialAuthUser(user, 'google');
            socialAuthData.isVerified = true;

            try {
                console.log('🔄 Syncing with backend...');
                const data = await authAPI.socialAuth(socialAuthData);
                console.log('✅ Backend sync successful');

                // Auto login after successful social authentication
                login({
                    ...data.data.user,
                    token: data.data.token
                }, user);

            } catch (backendError) {
                console.error('❌ Backend social auth failed:', backendError);
                
                // ✅ Enhanced fallback with network error detection
                if (backendError.status === 0 || 
                    backendError.networkError || 
                    backendError.message?.includes('fetch')) {
                    
                    console.log('🔄 Network error detected, using Firebase-only fallback...');
                    
                    // Fallback: Login with Firebase user data only
                    const fallbackUser = {
                        _id: user.uid,
                        name: user.displayName || 'Google User',
                        email: user.email,
                        role: 'student',
                        isVerified: true,
                        provider: 'google',
                        profilePic: user.photoURL
                    };
                    
                    const fallbackToken = `firebase_${user.uid}_${Date.now()}`;
                    
                    login({
                        ...fallbackUser,
                        token: fallbackToken
                    }, user);
                    
                    console.log('✅ Fallback authentication successful');
                } else {
                    // Other backend errors
                    setErrors({ 
                        general: 'Authentication failed. Please try again or contact support.' 
                    });
                    setIsLoading(false);
                    return;
                }
            }

            // ✅ Success - Navigate to dashboard
            console.log('✅ Authentication complete, navigating...');
            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }

        } catch (error) {
            console.error('❌ Google authentication error:', error);
            
            // ✅ Comprehensive error handling
            let errorMessage = 'Google sign-in failed. Please try again.';

            if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message?.includes('unauthorized-domain')) {
                errorMessage = 'This website is not authorized for Google sign-in. Please contact support.';
            } else if (error.message?.includes('popup-blocked')) {
                errorMessage = 'Popup was blocked. Please allow popups for this site or try again.';
            } else if (error.message?.includes('operation-not-allowed')) {
                errorMessage = 'Google sign-in is not enabled. Please contact support.';
            }

            setErrors({ general: errorMessage });
        } finally {
            // Only set loading to false if we're not redirecting
            if (!errors.general?.includes('Redirecting')) {
                setIsLoading(false);
            }
        }
    };

    const handleFacebookAuth = async () => {
        setIsLoading(true);
        setErrors({});

        console.log('🚀 Starting popup-first Facebook authentication...');

        try {
            const result = await signInWithFacebook();
            console.log('📊 Facebook auth result:', { 
                success: result.success, 
                method: result.method,
                redirectInitiated: result.redirectInitiated 
            });

            if (!result.success) {
                console.error('❌ Facebook auth failed:', result.error);
                
                // ✅ Handle in-app browser warning
                if (result.code === 'auth/in-app-browser' && result.showOpenInBrowser) {
                    setErrors({ 
                        general: result.error,
                        showOpenInBrowser: true
                    });
                } else {
                    setErrors({ general: result.error });
                }
                setIsLoading(false);
                return;
            }

            // ✅ Handle redirect fallback case (rare)
            if (result.redirectInitiated) {
                console.log('🔄 Facebook redirect fallback initiated - page will reload automatically...');
                setErrors({ 
                    general: result.message || 'Popup blocked. Redirecting to Facebook... Please wait.' 
                });
                return; // Don't set loading to false - redirect is in progress
            }

            if (!result.user) {
                console.error('❌ No user data in Facebook result');
                setErrors({ general: 'Facebook authentication failed. Please try again.' });
                setIsLoading(false);
                return;
            }

            const { user } = result;
            console.log('✅ Facebook user authenticated via popup:', user.email);

            // Process user data for backend
            const socialAuthData = processSocialAuthUser(user, 'facebook');
            socialAuthData.isVerified = true;

            try {
                console.log('🔄 Syncing Facebook user with backend...');
                const data = await authAPI.socialAuth(socialAuthData);
                console.log('✅ Facebook backend sync successful');

                // Auto login after successful social authentication
                login({
                    ...data.data.user,
                    token: data.data.token
                }, user);

            } catch (backendError) {
                console.error('❌ Facebook backend social auth failed:', backendError);
                
                // ✅ Enhanced fallback with better error handling
                if (backendError.status === 0 || backendError.networkError) {
                    console.log('🔄 Network error detected, using Facebook Firebase-only fallback...');
                    
                    // Fallback: Login with Firebase user data only
                    const fallbackUser = {
                        _id: user.uid,
                        name: user.displayName || 'Facebook User',
                        email: user.email,
                        role: 'student',
                        isVerified: true,
                        provider: 'facebook',
                        profilePic: user.photoURL
                    };
                    
                    const fallbackToken = `firebase_${user.uid}_${Date.now()}`;
                    
                    login({
                        ...fallbackUser,
                        token: fallbackToken
                    }, user);
                    
                    console.log('✅ Facebook fallback authentication successful');
                } else {
                    setErrors({ 
                        general: 'Facebook authentication failed. Please try again or contact support.' 
                    });
                    setIsLoading(false);
                    return;
                }
            }

            // ✅ Success - Navigate to dashboard
            console.log('✅ Facebook authentication complete, navigating...');
            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }
        } catch (error) {
            console.error('❌ Facebook authentication error:', error);
            
            let errorMessage = 'Facebook sign-in failed. Please try again.';
            
            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'Sign-in was cancelled. Please try again.';
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = 'Popup was blocked. Please allow popups for this site or try again.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.code === 'auth/unauthorized-domain') {
                errorMessage = 'This domain is not authorized for Facebook sign-in. Please contact support.';
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'Facebook sign-in is not enabled. Please contact support to enable Facebook authentication.';
            } else if (error.message && error.message.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }
            
            setErrors({ general: errorMessage });
        } finally {
            // Only set loading to false if not redirecting
            if (!errors.general || !errors.general.includes('Redirecting')) {
                setIsLoading(false);
            }
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
                                {/* ✅ Open in Browser Button for In-App Browser Warning */}
                                {errors.showOpenInBrowser && (
                                    <button
                                        onClick={() => {
                                            // Try to open in default browser
                                            const currentUrl = window.location.href;
                                            // For iOS
                                            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                                                window.open(`googlechrome://${currentUrl}`, '_blank') || 
                                                window.open(`firefox://open-url?url=${encodeURIComponent(currentUrl)}`, '_blank') ||
                                                window.open(currentUrl, '_blank');
                                            } else {
                                                // For Android and others
                                                window.open(`intent://${currentUrl.replace(/https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`, '_blank') ||
                                                window.open(currentUrl, '_blank');
                                            }
                                        }}
                                        className="block mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
                                    >
                                        Open in Browser
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Email or Phone Input */}
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