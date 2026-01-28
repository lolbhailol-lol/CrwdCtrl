import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNavigate } from 'react-router-dom';
import { authAPI, handleApiError } from '../../utils/api';
import { processSocialAuthUser, handleSocialAuthError, validateSocialAuthResult } from '../../utils/socialAuth';
import { registerWithEmail, signInWithGoogle, signInWithFacebook } from '../../firebase';

export default function CrwdCtrlRegister({ onClose, onSwitchToLogin }) {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [showSocialFields, setShowSocialFields] = useState(false);
    const [socialAuthData, setSocialAuthData] = useState(null);
    const [authProvider, setAuthProvider] = useState('');
    const { login } = useAuth();
    const { isDark } = useDarkMode();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setErrors({});
        setIsLoading(true);

        const newErrors = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!email.trim()) newErrors.email = 'Email is required';
        if (!phone.trim()) newErrors.phone = 'Phone number is required';
        if (!password.trim()) newErrors.password = 'Password is required';
        if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) newErrors.email = 'Please enter a valid email address';

        const phoneRegex = /^\d{10}$/;
        if (phone && !phoneRegex.test(phone)) newErrors.phone = 'Please enter exactly 10 digits';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsLoading(false);
            return;
        }

        try {
            // Firebase registration (NO verification handling)
            const firebaseResult = await registerWithEmail(email, password);

            if (!firebaseResult.success) {
                setErrors({ general: firebaseResult.error });
                setIsLoading(false);
                return;
            }

            // Backend registration
            const userData = {
                name: name.trim(),
                email: email.trim(),
                phoneNumber: phone.trim(),
                password: password,
                role: 'student',
                firebaseUid: firebaseResult.user.uid,
                isVerified: true
            };

            const data = await authAPI.register(userData);

            if (!data || !data.data || !data.data.user || !data.data.token) {
                setErrors({ general: 'Invalid response from server. Please try again.' });
                setIsLoading(false);
                return;
            }

            // Auto login directly
            login(
                {
                    ...data.data.user,
                    token: data.data.token
                },
                firebaseResult.user
            );

            // Direct redirect (NO verification page)
            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }

        } catch (error) {
            setErrors({ general: handleApiError(error) });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialAuthCompletion = async (e) => {
        e.preventDefault();
        setErrors({});
        setIsLoading(true);

        const newErrors = {};
        if (!phone.trim()) newErrors.phone = 'Phone number is required';
        if (!dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';

        const phoneRegex = /^\d{10}$/;
        if (phone && !phoneRegex.test(phone)) newErrors.phone = 'Please enter exactly 10 digits';

        if (dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(dateOfBirth);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
            if (age < 13) newErrors.dateOfBirth = 'You must be at least 13 years old';
            if (birthDate > today) newErrors.dateOfBirth = 'Date of birth cannot be in the future';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setIsLoading(false);
            return;
        }

        try {
            if (!socialAuthData) {
                setErrors({ general: 'Social authentication data is missing. Please try again.' });
                setIsLoading(false);
                return;
            }

            const completeAuthData = {
                ...socialAuthData,
                phoneNumber: phone.trim(),
                dateOfBirth: dateOfBirth,
                isVerified: true
            };

            const data = await authAPI.socialAuth(completeAuthData);

            if (!data || !data.data || !data.data.user || !data.data.token) {
                setErrors({ general: 'Invalid response from server. Please try again.' });
                setIsLoading(false);
                return;
            }

            login({
                ...data.data.user,
                token: data.data.token
            });

            if (onClose) {
                onClose();
            } else {
                navigate('/');
            }

        } catch (error) {
            console.error(`${authProvider} authentication completion error:`, error);
            setErrors({ general: handleApiError(error) });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (onClose) onClose();
        else navigate('/');
    };

    const handleGoogleAuth = async () => {
        setIsLoading(true);
        setErrors({});
        
        // ✅ MOBILE FIX: Add retry logic for mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const maxAttempts = isMobile ? 3 : 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`📍 Google auth attempt ${attempt}/${maxAttempts}...`);
                const result = await signInWithGoogle();
                
                if (!result || !result.success || !validateSocialAuthResult(result)) {
                    const errorMsg = result?.error || 'Google authentication failed. Please try again.';
                    
                    if (attempt < maxAttempts && isMobile) {
                        console.log(`⏳ Mobile retry in 1 second (attempt ${attempt}/${maxAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
                    setErrors({ general: errorMsg });
                    setIsLoading(false);
                    return;
                }
                
                const { user } = result;
                const processedSocialAuthData = processSocialAuthUser(user, 'google');
                setSocialAuthData(processedSocialAuthData);
                setAuthProvider('Google');
                setName(user.displayName || '');
                setEmail(user.email || '');
                setShowSocialFields(true);
                setIsLoading(false);
                return; // Exit after successful authentication
                
            } catch (error) {
                console.error(`❌ Google auth error (attempt ${attempt}/${maxAttempts}):`, error);
                
                if (attempt < maxAttempts && isMobile) {
                    console.log(`⏳ Mobile retry in 1 second (error: ${error.message})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                setErrors({ general: handleSocialAuthError(error, 'Google') });
                setIsLoading(false);
            }
        }
    };

    const handleFacebookAuth = async () => {
        setIsLoading(true);
        setErrors({});
        
        // ✅ MOBILE FIX: Add retry logic for mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const maxAttempts = isMobile ? 3 : 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`📍 Facebook auth attempt ${attempt}/${maxAttempts}...`);
                const result = await signInWithFacebook();
                
                if (!result || !result.success || !validateSocialAuthResult(result)) {
                    const errorMsg = result?.error || 'Facebook authentication failed. Please try again.';
                    
                    if (attempt < maxAttempts && isMobile) {
                        console.log(`⏳ Mobile retry in 1 second (attempt ${attempt}/${maxAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
                    setErrors({ general: errorMsg });
                    setIsLoading(false);
                    return;
                }
                
                const { user } = result;
                const processedSocialAuthData = processSocialAuthUser(user, 'facebook');
                setSocialAuthData(processedSocialAuthData);
                setAuthProvider('Facebook');
                setName(user.displayName || '');
                setEmail(user.email || '');
                setShowSocialFields(true);
                setIsLoading(false);
                return; // Exit after successful authentication
                
            } catch (error) {
                console.error(`❌ Facebook auth error (attempt ${attempt}/${maxAttempts}):`, error);
                
                if (attempt < maxAttempts && isMobile) {
                    console.log(`⏳ Mobile retry in 1 second (error: ${error.message})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                setErrors({ general: handleSocialAuthError(error, 'Facebook') });
                setIsLoading(false);
            }
        }
    };

    return (
        <>
            {/* Background overlay with blur */}
            <div className={`fixed inset-0 backdrop-blur-sm ${isDark ? 'bg-black/85' : 'bg-white/85'}`} onClick={handleClose}></div>

            {/* Register Modal Container - Fixed positioning with proper centering */}
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div
                    className={`relative rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm p-4 sm:p-6 transition-colors duration-300 my-8
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
                        {showSocialFields && (
                            <p className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                Complete your {authProvider} registration
                            </p>
                        )}
                    </div>

                    {/* Form */}
                    <form onSubmit={showSocialFields ? handleSocialAuthCompletion : handleRegister} className="space-y-4">
                        {/* Error Message */}
                        {errors.general && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                                <span className="block sm:inline">{errors.general}</span>
                            </div>
                        )}

                        {!showSocialFields && (
                            <>
                                {/* Name */}
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Enter your Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                                ${errors.name ? 'border-red-500' : ''}
                                ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                            } focus:outline-none focus:ring-2`}
                                    />
                                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Enter your Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                                ${errors.email ? 'border-red-500' : ''}
                                ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                                : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                            } focus:outline-none focus:ring-2`}
                                    />
                                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                                </div>

                                {/* Password */}
                                <div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password (min 6 characters)"
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
                            </>
                        )}

                        {showSocialFields && (
                            <>
                                {/* Info Message */}
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-blue-50 border border-blue-200'}`}>
                                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                        <span className="font-medium">Almost done!</span> Please provide your phone number and date of birth to complete your registration.
                                    </p>
                                </div>

                                {/* Display Name (Read-only) */}
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        value={name}
                                        readOnly
                                        className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                                ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-gray-300 cursor-not-allowed'
                                                : 'bg-gray-100 border-gray-200 placeholder-gray-400 text-gray-600 cursor-not-allowed'
                                            } focus:outline-none`}
                                    />
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        From your {authProvider} account
                                    </p>
                                </div>

                                {/* Display Email (Read-only) */}
                                <div>
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        readOnly
                                        className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                                ${isDark
                                                ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-gray-300 cursor-not-allowed'
                                                : 'bg-gray-100 border-gray-200 placeholder-gray-400 text-gray-600 cursor-not-allowed'
                                            } focus:outline-none`}
                                    />
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        From your {authProvider} account
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Phone - Always required */}
                        <div>
                            <input
                                type="tel"
                                placeholder={showSocialFields ? "Phone Number (Required)*" : "Phone Number (10 digits only)*"}
                                value={phone}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setPhone(value);
                                }}
                                maxLength={10}
                                className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                        ${errors.phone ? 'border-red-500' : ''}
                        ${isDark
                                        ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                        : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                    } focus:outline-none focus:ring-2`}
                            />
                            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                            {showSocialFields && (
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Enter exactly 10 digits
                                </p>
                            )}
                        </div>

                        {/* Date of Birth - Required for social auth */}
                        {showSocialFields && (
                            <div>
                                <input
                                    type="date"
                                    placeholder="Date of Birth (Required)*"
                                    value={dateOfBirth}
                                    onChange={(e) => setDateOfBirth(e.target.value)}
                                    max={new Date(Date.now() - 13 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Minimum 13 years old
                                    className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border text-sm transition-colors
                            ${errors.dateOfBirth ? 'border-red-500' : ''}
                            ${isDark
                                            ? 'bg-[#2A2B2D] border-gray-700 placeholder-gray-500 text-white focus:ring-blue-500'
                                            : 'bg-gray-50 border-gray-200 placeholder-gray-400 text-gray-900 focus:ring-blue-500'
                                        } focus:outline-none focus:ring-2`}
                                />
                                {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    You must be at least 13 years old
                                </p>
                            </div>
                        )}

                        {/* Register Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full font-semibold py-2 sm:py-2.5 rounded-lg transition-colors ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                } text-white`}
                        >
                            {isLoading
                                ? (showSocialFields ? 'Completing Registration...' : 'Registering...')
                                : (showSocialFields ? 'Complete Registration' : 'Register')
                            }
                        </button>

                        {/* Back button for social auth */}
                        {showSocialFields && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSocialFields(false);
                                    setSocialAuthData(null);
                                    setAuthProvider('');
                                    setName('');
                                    setEmail('');
                                    setPhone('');
                                    setDateOfBirth('');
                                    setErrors({});
                                }}
                                disabled={isLoading}
                                className={`w-full font-medium py-2 sm:py-2.5 rounded-lg transition-colors ${isLoading
                                    ? 'opacity-50 cursor-not-allowed'
                                    : isDark
                                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                    }`}
                            >
                                Back to Registration Options
                            </button>
                        )}
                    </form>

                    {/* Divider - Only show for regular registration */}
                    {!showSocialFields && (
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
                    )}

                    {/* Social Buttons - Only show for regular registration */}
                    {!showSocialFields && (
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
                    )}

                    {/* Login Link - Only show for regular registration */}
                    {!showSocialFields && (
                        <div className="text-center mt-4">
                            <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                                Already have an account?{" "}
                                <button
                                    onClick={onSwitchToLogin}
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}