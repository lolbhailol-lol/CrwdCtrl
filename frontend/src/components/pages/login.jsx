import { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI, handleApiError } from '../../utils/api';
import { processSocialAuthUser } from '../../utils/socialAuth';
import { signInWithGoogle, signInWithFacebook } from '../../firebase';

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

    // Redirect admin if already logged in (when visiting /login page directly)
    useEffect(() => {
        if (!isModal && location.pathname === '/login') {
            const adminToken = localStorage.getItem('admin_token');
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
            console.log('🔐 [ADMIN LOGIN] Attempting with:', { email: emailOrPhone.trim() });
            const adminData = await authAPI.adminLogin({
                email: emailOrPhone.trim(),
                password
            });

            console.log('🔐 [ADMIN LOGIN] Full response:', JSON.stringify(adminData, null, 2));
            console.log('🔐 [ADMIN LOGIN] Response keys:', Object.keys(adminData || {}));

            const accessToken = adminData?.accessToken || adminData?.token;
            const refreshToken = adminData?.refreshToken;

            console.log('🔐 [ADMIN LOGIN] Extracted tokens:', { 
                token: accessToken?.substring(0, 20) + '...', 
                hasToken: !!accessToken, 
                hasRefreshToken: !!refreshToken 
            });

            if (accessToken) {
                localStorage.setItem('admin_token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('admin_refresh_token', refreshToken);
                }
                
                console.log('✅ [ADMIN LOGIN] SUCCESS - Redirecting to /admin');
                
                if (isModal && onClose) {
                    onClose();
                }
                
                navigate('/admin', { replace: true });
                setIsLoading(false);
                return;
            } else {
                console.warn('⚠️ [ADMIN LOGIN] No access token in response');
            }
        } catch (adminError) {
            console.error('🔴 [ADMIN LOGIN] Error caught:', {
                status: adminError?.status,
                message: adminError?.message,
                data: adminError?.data
            });
            
            if (adminError?.status === 401 || adminError?.data?.message === 'Invalid admin credentials') {
                console.log('ℹ️ [ADMIN LOGIN] Got 401 - Not admin, attempting backend user login...');
            } else if (adminError?.status === 0 || adminError?.message?.includes('Failed to fetch')) {
                console.error('🔴 [ADMIN LOGIN] Network error:', adminError);
                setErrors({ general: 'Network error. Please check your connection and try again.' });
                setIsLoading(false);
                return;
            } else {
                console.error('🔴 [ADMIN LOGIN] Server error:', adminError);
                setErrors({ general: adminError?.message || 'Login failed. Please try again.' });
                setIsLoading(false);
                return;
            }
        }

        // Try backend user login
        try {
            console.log('👤 Attempting backend user login with:', { email: emailOrPhone.trim() });
            const response = await authAPI.login({
                email: emailOrPhone.trim(),
                password
            });

            console.log('👤 Backend login response:', response);

            if (!response?.success) {
                console.error('❌ Backend login not successful:', response);
                setErrors({ general: response?.message || 'Login failed.' });
                setIsLoading(false);
                return;
            }

            const userData = response?.data?.user;
            const userToken = response?.data?.token;

            console.log('👤 Extracted credentials:', { 
                hasUser: !!userData, 
                hasToken: !!userToken,
                userName: userData?.name 
            });

            if (!userData || !userToken) {
                console.error('❌ Missing user data or token from response');
                setErrors({ general: 'Login failed. Invalid response from server.' });
                setIsLoading(false);
                return;
            }

            // Store user token and update AuthContext
            login({
                ...userData,
                token: userToken
            });
            
            console.log('✅ Backend user login successful');

            if (isModal && onClose) {
                onClose();
            }

            return;

        } catch (error) {
            console.error('❌ Backend user login error:', error);
            console.error('Error details:', { 
                status: error?.status, 
                message: error?.message,
                data: error?.data 
            });
            
            if (error?.status === 0 || error?.message?.includes('Failed to fetch')) {
                console.log('❌ Network error during login');
                setErrors({ general: 'Network error. Please check your internet connection and try again.' });
            } else if (error?.status === 401) {
                console.log('❌ Invalid credentials for user login');
                setErrors({ general: 'Invalid email/password. Please try again.' });
            } else if (error?.status === 400) {
                console.log('❌ Bad request - validation error');
                setErrors({ general: error?.data?.message || 'Please check your input and try again.' });
            } else {
                console.error('❌ Backend error:', error?.message);
                setErrors({ general: handleApiError(error) || 'Login failed. Please try again.' });
            }
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

    // ✅ UNIFIED GOOGLE AUTHENTICATION - Works for both mobile and desktop
    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setErrors({});

        console.log('🚀 Starting unified Google authentication...');
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log('📱 Device detected:', isMobile ? 'Mobile (will use redirect)' : 'Desktop (will use redirect)');
        
        // ✅ Show user what's happening on mobile
        if (isMobile) {
            setErrors({ 
                general: 'Redirecting to Google Sign-In... (Please wait)' 
            });
        }

        const maxAttempts = 3;
        const retryDelay = 1500;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 Google auth attempt ${attempt}/${maxAttempts}...`);
                console.log('📱 Mobile?', isMobile, '| Will use redirect flow...');
                
                const result = await signInWithGoogle();
                console.log('📊 Google auth result:', { 
                    success: result.success, 
                    method: result.method,
                    redirectInitiated: result.redirectInitiated,
                    error: result.error,
                    code: result.code,
                    hasUser: !!result.user,
                    attempt
                });

                // ✅ Handle redirect case (mobile)
                if (result.redirectInitiated) {
                    console.log('🔄 Redirect initiated - browser will now redirect to Google...');
                    setErrors({ 
                        general: result.message || 'Redirecting to Google... Please wait.' 
                    });
                    setIsLoading(false);
                    // Don't return - let redirect happen
                    return;
                }

                // Handle success (popup, rare on mobile)
                if (result.success && result.user) {
                    console.log('✅ Google authentication successful:', result.user.email);
                    await processSuccessfulAuth(result.user);
                    return;
                }

                // Handle failure cases
                if (!result.success) {
                    console.error('❌ Google auth failed:', result.error);
                    
                    // Special case: In-app browser warning
                    if (result.code === 'auth/in-app-browser' && result.showOpenInBrowser) {
                        setErrors({ 
                            general: result.error,
                            showOpenInBrowser: true
                        });
                        setIsLoading(false);
                        return;
                    }
                    
                    // Special case: Unauthorized domain
                    if (result.code === 'auth/unauthorized-domain') {
                        setErrors({ 
                            general: '❌ This domain is not authorized for Google Sign-In. Please contact support.' 
                        });
                        setIsLoading(false);
                        return;
                    }
                    
                    // Determine if we should retry
                    const retryableErrors = [
                        'auth/popup-blocked',
                        'auth/popup-closed-by-user',
                        'auth/network-request-failed',
                        'auth/cancelled-popup-request'
                    ];
                    
                    if (attempt < maxAttempts && retryableErrors.includes(result.code)) {
                        console.log(`⏳ Retrying in ${retryDelay}ms (${result.code})...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    
                    setErrors({ general: result.error });
                    setIsLoading(false);
                    return;
                }

                // Handle missing user data
                if (!result.user) {
                    console.error('❌ No user data received');
                    
                    if (attempt < maxAttempts) {
                        console.log(`⏳ Retrying for missing user data in ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    
                    setErrors({ general: 'Authentication failed. Please try again.' });
                    setIsLoading(false);
                    return;
                }

            } catch (error) {
                console.error(`❌ Google auth error (attempt ${attempt}/${maxAttempts}):`, error);
                
                const retryableErrors = [
                    'auth/popup-blocked',
                    'auth/popup-closed-by-user',
                    'auth/cancelled-popup-request',
                    'auth/network-request-failed'
                ];
                
                const shouldRetry = attempt < maxAttempts && (
                    retryableErrors.includes(error.code) ||
                    error.name === 'AbortError' ||
                    error.message?.includes('network') ||
                    error.message?.includes('fetch')
                );
                
                if (shouldRetry) {
                    console.log(`⏳ Retrying after error in ${retryDelay}ms (${error.code || error.message})...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                let errorMessage = 'Google sign-in failed. Please try again.';
                
                if (error.code === 'auth/popup-blocked') {
                    errorMessage = 'Popup was blocked. Please allow popups and try again.';
                } else if (error.code === 'auth/popup-closed-by-user') {
                    errorMessage = 'Sign-in was cancelled. Please try again.';
                } else if (error.code === 'auth/network-request-failed' || error.message?.includes('network')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                } else if (error.code === 'auth/unauthorized-domain') {
                    errorMessage = 'This domain is not authorized. Please contact support.';
                }
                
                setErrors({ general: errorMessage });
                break;
            }
        }
        
        setIsLoading(false);
    };

    // Process successful authentication
    const processSuccessfulAuth = async (user) => {
        try {
            console.log('🔄 Processing successful authentication...');
            
            const socialAuthData = processSocialAuthUser(user, 'google');
            socialAuthData.isVerified = true;

            try {
                console.log('🔄 Syncing with backend...');
                const data = await authAPI.socialAuth(socialAuthData);
                console.log('✅ Backend sync successful');

                login({
                    ...data.data.user,
                    token: data.data.token
                }, user);

            } catch (backendError) {
                console.error('❌ Backend sync failed:', backendError);
                
                if (backendError.status === 0 || 
                    backendError.networkError || 
                    backendError.message?.includes('fetch')) {
                    
                    console.log('🔄 Using Firebase-only fallback...');
                    
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
                    throw backendError;
                }
            }

            console.log('✅ Authentication complete');
            if (isModal && onClose) {
                onClose();
            }
            
        } catch (error) {
            console.error('❌ Auth processing failed:', error);
            setErrors({ 
                general: 'Authentication failed. Please try again or contact support.' 
            });
        } finally {
            setIsLoading(false);
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

            if (result.redirectInitiated) {
                console.log('🔄 Facebook redirect fallback initiated - page will reload automatically...');
                setErrors({ 
                    general: result.message || 'Popup blocked. Redirecting to Facebook... Please wait.' 
                });
                return;
            }

            if (!result.user) {
                console.error('❌ No user data in Facebook result');
                setErrors({ general: 'Facebook authentication failed. Please try again.' });
                setIsLoading(false);
                return;
            }

            const { user } = result;
            console.log('✅ Facebook user authenticated via popup:', user.email);

            const socialAuthData = processSocialAuthUser(user, 'facebook');
            socialAuthData.isVerified = true;

            try {
                console.log('🔄 Syncing Facebook user with backend...');
                const data = await authAPI.socialAuth(socialAuthData);
                console.log('✅ Facebook backend sync successful');

                login({
                    ...data.data.user,
                    token: data.data.token
                }, user);

            } catch (backendError) {
                console.error('❌ Facebook backend social auth failed:', backendError);
                
                if (backendError.status === 0 || backendError.networkError) {
                    console.log('🔄 Network error detected, using Facebook Firebase-only fallback...');
                    
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

            console.log('✅ Facebook authentication complete, navigating...');
            if (isModal && onClose) {
                onClose();
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
            if (!errors.general || !errors.general.includes('Redirecting')) {
                setIsLoading(false);
            }
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
                            <button
                                type="button"
                                onClick={() => {
                                    const currentUrl = window.location.href;
                                    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                                        window.open(`googlechrome://${currentUrl}`, '_blank') || 
                                        window.open(`firefox://open-url?url=${encodeURIComponent(currentUrl)}`, '_blank') ||
                                        window.open(currentUrl, '_blank');
                                    } else {
                                        window.open(`intent://${currentUrl.replace(/https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`, '_blank') ||
                                        window.open(currentUrl, '_blank');
                                    }
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
                            >
                                Open in Browser
                            </button>
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