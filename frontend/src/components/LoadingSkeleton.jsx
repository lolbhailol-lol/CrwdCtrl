import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

const LoadingSkeleton = ({ count = 3 }) => {
    const { isDark } = useDarkMode();
    
    return (
        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide px-1">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className={`card-carousel lg:min-w-[21.25rem] lg:w-[21.25rem] rounded-xl shadow-sm overflow-hidden animate-pulse ${
                        isDark ? 'bg-[#111213]' : 'bg-white'
                    }`}
                >
                    {/* Image Skeleton */}
                    <div className={`aspect-[13/10] ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div className="relative h-full">
                            {/* Status Badge Skeleton */}
                            <div className={`absolute top-2 left-2 w-16 h-6 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                            {/* Heart Button Skeleton */}
                            <div className={`absolute top-2 right-2 w-9 h-9 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                        </div>
                    </div>

                    {/* Content Skeleton */}
                    <div className="p-3 sm:p-4">
                        {/* Title Skeleton */}
                        <div className={`h-6 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                        
                        {/* Subtitle Skeleton */}
                        <div className={`h-4 rounded mb-3 w-3/4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                        
                        {/* Button Skeleton */}
                        <div className={`h-10 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LoadingSkeleton;


