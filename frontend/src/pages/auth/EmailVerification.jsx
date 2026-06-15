import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { verifyEmail, sendVerificationEmail, onAuthStateChange } from '../../firebase';

const EmailVerification = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { _user, _login, _logout } = useAuth();
    const [verificationState, setVerificationState] = useState('loading'); // loading, success, error, pending
    const [message, setMessage] = useState('');
    const [isResending, setIsResending] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Listen to auth state changes
        const unsubscribe = onAuthStateChange((firebaseUser) => {
            setCurrentUser(firebaseUser);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleVerification = async () => {
            const mode = searchParams.get('mode');
            const actionCode = searchParams.get('oobCode');

            if (mode === 'verifyEmail' && actionCode) {
                // Handle email verification from link
                try {
                    const result = await verifyEmail(actionCode);
                    if (result.success) {
                        setVerificationState('success');
                        setMessage('Your email has been verified successfully!');

                        // Wait a moment then redirect to dashboard
                        setTimeout(() => {
                            navigate('/dashboard');
                        }, 2000);
                    } else {
                        setVerificationState('error');
                        setMessage(result.error || 'Verification failed');
                    }
                } catch (error) {
                    console.error('Verification error:', error);
                    setVerificationState('error');
                    setMessage('An unexpected error occurred during verification');
                }
            } else if (currentUser) {
                // Check if current user needs verification
                if (currentUser.emailVerified) {
                    setVerificationState('success');
                    setMessage('Your email is already verified!');
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 1500);
                } else {
                    setVerificationState('pending');
                    setMessage('Please check your email and click the verification link');
                }
            } else {
                // No verification code and no user - redirect to login
                setVerificationState('error');
                setMessage('No verification request found');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            }
        };

        if (currentUser !== null) {
            handleVerification();
        }
    }, [searchParams, currentUser, navigate]);

    const handleResendVerification = async () => {
        if (!currentUser) {
            setMessage('No user found. Please log in again.');
            return;
        }

        setIsResending(true);
        try {
            const result = await sendVerificationEmail();
            if (result.success) {
                setMessage('Verification email sent! Please check your inbox.');
            } else {
                setMessage(result.error || 'Failed to send verification email');
            }
        } catch (error) {
            console.error('Resend error:', error);
            setMessage('Failed to send verification email. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    const handleGoToLogin = () => {
        navigate('/login');
    };

    const renderContent = () => {
        switch (verificationState) {
            case 'loading':
                return (
                    <div className="text-center">
                        <RefreshCw className={`w-16 h-16 mx-auto mb-4 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Verifying your email...
                        </h2>
                        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Please wait while we verify your email address.
                        </p>
                    </div>
                );

            case 'success':
                return (
                    <div className="text-center">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Email Verified Successfully!
                        </h2>
                        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {message}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Redirecting to your dashboard...
                        </p>
                    </div>
                );

            case 'error':
                return (
                    <div className="text-center">
                        <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Verification Failed
                        </h2>
                        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {message}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {currentUser && !currentUser.emailVerified && (
                                <button
                                    onClick={handleResendVerification}
                                    disabled={isResending}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                >
                                    {isResending ? 'Sending...' : 'Resend Verification Email'}
                                </button>
                            )}
                            <button
                                onClick={handleGoToLogin}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                    }`}
                            >
                                <ArrowLeft className="w-4 h-4 inline mr-2" />
                                Back to Login
                            </button>
                        </div>
                    </div>
                );

            case 'pending':
                return (
                    <div className="text-center">
                        <Mail className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Verify Your Email
                        </h2>
                        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {message}
                        </p>
                        {currentUser && (
                            <div className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                    We sent a verification email to:
                                </p>
                                <p className={`font-medium ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>
                                    {currentUser.email}
                                </p>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={handleResendVerification}
                                disabled={isResending}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                            >
                                {isResending ? 'Sending...' : 'Resend Email'}
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                    }`}
                            >
                                I've verified my email
                            </button>
                        </div>
                        <p className={`mt-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Didn't receive the email? Check your spam folder or click "Resend Email"
                        </p>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center p-4">
            <div className={`max-w-md w-full rounded-2xl shadow-xl p-8 ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-[#053780] to-[#0ECCEE]">
                        CRWDCTRL
                    </h1>
                </div>

                {renderContent()}
            </div>
        </div>
    );
};

export default EmailVerification;