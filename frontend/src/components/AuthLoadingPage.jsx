import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import MainLogo from '../assets/logo01_.svg';

const AuthLoadingPage = () => {
    const { isDark } = useDarkMode();

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300 ${
            isDark ? 'bg-[#0E0E0F]' : 'bg-white'
        }`}>
            <div className="flex flex-col items-center justify-center space-y-6">
                {/* Logo Container */}
                <div className="relative">
                    <img 
                        src={MainLogo}
                        alt="CrwdCtrl"
                        className="h-32 w-auto animate-pulse transition-all duration-300"
                    />
                </div>

                {/* Authentication Status */}
                <div className="flex flex-col items-center space-y-2">
                    <div className={`text-lg font-medium ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        Completing Sign In...
                    </div>
                    <div className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                        Please wait while we process your authentication
                    </div>
                </div>

                {/* Loading Spinner */}
                <div className="flex items-center justify-center">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${
                        isDark ? 'border-white' : 'border-gray-900'
                    }`}></div>
                </div>
            </div>
        </div>
    );
};

export default AuthLoadingPage;