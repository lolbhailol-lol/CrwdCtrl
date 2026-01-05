import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import MainLogo from '../assets/logo01_.svg';
import DarkModeLogo from '../assets/loading-image/dark-mode-logo.svg';
import LightModeLogo from '../assets/loading-image/light-mode.svg';

const LoadingBar = ({ message = "Loading...", showPoweredBy = true }) => {
    const { isDark } = useDarkMode();

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300 ${
            isDark ? 'bg-[#0E0E0F]' : 'bg-white'
        }`}>
            <div className="flex flex-col items-center justify-center space-y-0">
                {/* Logo Container */}
                <div className="relative">
                    <img 
                        src={MainLogo}
                        alt="FestBuzzzZ"
                        className="h-60 w-auto animate-pulse transition-all duration-300"
                    />
                </div>

               {showPoweredBy && (
                        <div className="flex items-center justify-center space-x-2 -mt-16">
                            <span className={`text-sm ${
                                isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                                Powered by
                            </span>
                            <img 
                                src={isDark ? LightModeLogo : DarkModeLogo}
                                alt="DevHub"
                                className="h-3 w-auto"
                            />
                        </div>
                    )}

              
              
                
            </div>
        </div>
    );
};

export default LoadingBar;