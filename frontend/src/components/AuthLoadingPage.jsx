import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import MainLogo from '../assets/logo01_.svg';

const AuthLoadingPage = () => {
    const { isDark } = useDarkMode();

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300 ${
            isDark ? 'bg-[#161718]' : 'bg-white'
        }`}>
            <div className="flex flex-col items-center justify-center space-y-0">
                {/* Logo Container */}
                <div className="relative">
                    <img 
                        src={MainLogo}
                        alt="CrwdCtrl"
                        className="h-60 w-auto animate-pulse transition-all duration-300"
                    />
                </div>
            </div>
        </div>
    );
};

export default AuthLoadingPage;