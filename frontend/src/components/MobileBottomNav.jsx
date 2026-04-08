import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Calendar, User } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = ({ onProfileClick, onShowLogin, onNavigate }) => {
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
            if (onShowLogin) {
                onShowLogin();
                return;
            }
        }

        // ALWAYS navigate for active state
       navigate(path);

        // Optional sidebar open
        if (onProfileClick) {
            onProfileClick();
        }

    } else {
        navigate(path);

        if (onNavigate) {
            onNavigate(path);
        }
    }
};
    return (
        <>
            {/* Mobile Bottom Navigation - Only visible on small screens */}
          <div 
  className="fixed inset-x-0 z-[9999] md:hidden mobile-bottom-nav"
  style={{
    bottom: 0,
    paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
    WebkitTransform: 'translate3d(0,0,0)',
    transform: 'translate3d(0,0,0)'
  }}
>
               <div className={`rounded-3xl mx-4 mb-0 transition-all duration-300 border border-gray-600/50 backdrop-blur-md ${isDark
    ? 'bg-[#0a0a0a]/95'
    : 'bg-[#F5F6FA]/95 border-gray-200'
    }`}
                    style={{
                        // iOS Safari specific fixes
                        WebkitBackdropFilter: 'blur(12px)',
                        backdropFilter: 'blur(12px)',
                        WebkitTransform: 'translate3d(0,0,0)',
                        transform: 'translate3d(0,0,0)',
                        WebkitBackfaceVisibility: 'hidden',
                        backfaceVisibility: 'hidden'
                    }}
                >
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
                                    style={{
                                        // iOS Safari touch optimization
                                        WebkitTapHighlightColor: 'transparent',
                                        WebkitTouchCallout: 'none',
                                        WebkitUserSelect: 'none',
                                        userSelect: 'none'
                                    }}
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

            {/* Spacer to prevent content from being hidden behind the nav - iOS safe area aware */}
            <div 
                className="md:hidden mobile-bottom-nav-spacer"
                style={{
                    height: `calc(6rem + max(env(safe-area-inset-bottom), 8px))`
                }}
            ></div>
        </>
    );
};

export default MobileBottomNav;