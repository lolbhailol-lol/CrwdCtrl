import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Calendar, User } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = ({ onProfileClick, onShowLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark } = useDarkMode();
    const { isAuthenticated } = useAuth();

    // Helper function to determine if a nav item should be active
    const isItemActive = (itemPath, itemId) => {
        const currentPath = location.pathname;

        if (itemId === 'home') {
            // Home should ONLY be active on exact home path, not on fest pages
            return currentPath === '/';
        } else if (itemId === 'favorites') {
            // Favorites should ONLY be active on exact favorites path
            return currentPath === '/favorites';
        } else if (itemId === 'registered') {
            // Registered should ONLY be active on exact registered path
            return currentPath === '/registered-fest';
        } else if (itemId === 'profile') {
            // Profile includes multiple related paths but NOT registered-fest
            return currentPath.includes('/profile') ||
                currentPath.includes('/edit-profile') ||
                currentPath.includes('/help-center') ||
                currentPath.includes('/list-your-fest') ||
                currentPath.includes('/notifications');
        } else {
            // For other items, exact path match
            return currentPath === itemPath;
        }
    };

    const navItems = [
        {
            id: 'home',
            icon: Home,
            label: 'Home',
            path: '/',
            isActive: isItemActive('/', 'home')
        },
        {
            id: 'favorites',
            icon: Heart,
            label: 'Favourite',
            path: '/favorites',
            isActive: isItemActive('/favorites', 'favorites')
        },
        {
            id: 'registered',
            icon: Calendar,
            label: 'Registered',
            path: '/registered-fest',
            isActive: isItemActive('/registered-fest', 'registered')
        },
        {
            id: 'profile',
            icon: User,
            label: 'Profile',
            path: '/profile',
            isActive: isItemActive('/profile', 'profile')
        }
    ];

    const handleNavClick = (path, itemId) => {
        if (itemId === 'profile') {
            if (!isAuthenticated) {
                // If not authenticated, show login modal or navigate to login
                if (onShowLogin) {
                    onShowLogin();
                } else {
                    // Fallback to URL parameter method
                    const url = new URL(window.location);
                    url.searchParams.set('showLogin', 'true');
                    window.history.pushState({}, '', url);
                    window.location.reload();
                }
            } else if (onProfileClick) {
                // If authenticated and there's a profile click handler, use it (for opening profile sidebar)
                onProfileClick();
            } else {
                // Fallback to navigation
                navigate(path);
            }
        } else {
            navigate(path);
        }
    };

    return (
        <>
            {/* Mobile Bottom Navigation - Only visible on small screens */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className={`rounded-3xl mx-4 my-2 transition-all duration-300 mb-2 border border-gray-600/50 ${isDark
                    ? 'bg-[#0a0a0a]'
                    : 'bg-[#F5F6FA] border-gray-200'
                    }`}>
                    <div className="flex items-center justify-around px-4 py-4">
                        {navItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item.path, item.id)}
                                    className={`flex flex-col items-center justify-center p-2 transition-all duration-300 touch-manipulation ${item.isActive
                                        ? isDark
                                            ? 'text-blue-400'
                                            : 'text-blue-600'
                                        : isDark
                                            ? 'text-white hover:text-blue-400'
                                            : 'text-gray-500 hover:text-blue-600'
                                        }`}
                                    aria-label={item.label}
                                >
                                    <IconComponent
                                        size={24}
                                        strokeWidth={2}
                                        fill="none"
                                        className={`transition-all duration-200 ${item.isActive ? 'scale-110' : 'scale-100'
                                            }`}
                                    />
                                </button>
                            );
                        })}


                    </div>
                </div>
            </div>

            {/* Spacer to prevent content from being hidden behind the nav */}
            <div className="h-24 md:hidden"></div>
        </>
    );
};

export default MobileBottomNav;