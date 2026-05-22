import React from 'react';
import { ChevronLeft, ChevronRight, User, Calendar, HelpCircle, LogOut, Heart, Bell, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

export default function ProfileSidebar({ isOpen, onClose, onShowLogin, onShowRegister }) {
    const { isDark, toggleDarkMode } = useDarkMode();
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/');
    };

    const handleMenuItemClick = (label) => {
        console.log('Menu item clicked:', label); // Debug log

        if (label === 'Edit profile') {
            console.log('Navigating to /edit-profile'); // Debug log
            navigate('/edit-profile');
            onClose();
        } else if (label === 'Registered fest') {
            navigate('/registered-fest');
            onClose();
        } else if (label === 'Help Center') {
            navigate('/help-center');
            onClose();
        } else if (label === 'Favourites') {
            navigate('/favorites');
            onClose();
        } else if (label === 'Notifications') {
            navigate('/notifications');
            onClose();
        }
        // Add other navigation cases here if needed
    };

    const menuItems = [
        { icon: User, label: 'Edit profile', color: 'text-blue-500' },
        { icon: Calendar, label: 'Registered fest', color: 'text-blue-500' },
    ];

    const secondaryItems = [
        { icon: HelpCircle, label: 'Help Center', color: 'text-blue-500' },
    ];

    // Mobile menu items - filtered based on authentication status
    const allMobileMenuItems = [
        { icon: User, label: 'Edit profile', color: 'text-blue-500', requiresAuth: true },
        { icon: Heart, label: 'Favourites', color: 'text-blue-500', requiresAuth: false },
        { icon: Calendar, label: 'Registered fest', color: 'text-blue-500', requiresAuth: false },
        { icon: HelpCircle, label: 'Help Center', color: 'text-blue-500', requiresAuth: false },
        { icon: Bell, label: 'Notifications', color: 'text-blue-500', requiresAuth: true },
    ];

    // Filter menu items based on authentication status for mobile view
    const mobileMenuItems = allMobileMenuItems.filter(item =>
        !item.requiresAuth || isAuthenticated
    );

    const _handleBottomNavClick = (path) => {
        navigate(path);
        if (path !== '/profile') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Desktop/Laptop View - Hidden on mobile */}
            <div className="hidden md:block">
                {/* Full Screen Overlay */}
                <div
                    className={`fixed inset-0 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isDark ? 'bg-[#161718]/50' : 'bg-white/30'}`}
                    onClick={onClose}
                />

                {/* Sidebar */}
                <div className={`fixed right-0 top-0 z-[70] w-full max-w-md h-full transform transition-all duration-300 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                    }`}>
                    <div className={`h-full rounded-l-2xl shadow-xl overflow-hidden overflow-y-auto scrollbar-hide ${isDark ? 'bg-[#111213] ' : 'bg-[#EDEDF2]'
                        }`}>
                        {/* Header */}
                        <div className={`px-6 py-6 border-b flex items-center justify-between ${isDark ? 'bg-[#111213] border-[#111213]' : 'bg-[#EDEDF2] border-[#EDEDF2]'}
                            }`}>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={onClose}
                                    className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                        }`}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Profile
                                </h1>
                            </div>
                            {/* Dark Mode Toggle */}

                        </div>

                        {/* Profile Section */}
                        <div className={`px-6 py-8 ${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isAuthenticated
                                    ? 'bg-gradient-to-br from-[#007BFF] to-[#00C9A7]'
                                    : isDark
                                        ? 'bg-gray-700'
                                        : 'bg-gray-200'
                                    }`}>
                                    {isAuthenticated && user?.name ? (
                                        <span className="text-white text-2xl font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    ) : (
                                        <User className={`w-8 h-8 ${isDark ? 'text-gray-300' : 'text-gray-600'
                                            }`} />
                                    )}
                                </div>
                                <div>
                                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {isAuthenticated && user?.name ? user.name : 'guest'}
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {isAuthenticated && user?.email ? user.email : 'student'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="px-6 py-4 space-y-2">
                            {menuItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleMenuItemClick(item.label)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors group ${isDark ? 'hover:bg-gray-700' : 'hover:bg-[#EDEDF2]'}
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-900/50' : 'bg-blue-50'
                                            }`}>
                                            <item.icon className={`w-5 h-5 ${item.color}`} />
                                        </div>
                                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 transition-colors ${isDark
                                        ? 'text-gray-500 group-hover:text-gray-300'
                                        : 'text-gray-400 group-hover:text-gray-600'
                                        }`} />
                                </button>
                            ))}
                        </div>

                        {/* Secondary Items */}
                        <div className="px-6 py-4 space-y-2">
                            {secondaryItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleMenuItemClick(item.label)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors group ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-900/50' : 'bg-blue-50'
                                            }`}>
                                            <item.icon className={`w-5 h-5 ${item.color}`} />
                                        </div>
                                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 transition-colors ${isDark
                                        ? 'text-gray-500 group-hover:text-gray-300'
                                        : 'text-gray-400 group-hover:text-gray-600'
                                        }`} />
                                </button>
                            ))}
                        </div>

                        {/* Log Out Button */}
                        <div className="px-6 py-6">
                            {isAuthenticated ? (
                                <button
                                    onClick={handleLogout}
                                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl transition-colors group ${isDark
                                        ? 'bg-gray-700 hover:bg-gray-600'
                                        : 'bg-[#EDEDF2] hover:bg-gray-100'
                                        }`}
                                >
                                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Log Out
                                    </span>
                                    <LogOut className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (onShowLogin) {
                                            onShowLogin();
                                            onClose();
                                        } else {
                                            navigate('/login');
                                            onClose();
                                        }
                                    }}
                                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl transition-colors group ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                >
                                    <span className="font-medium text-white">
                                        Log In
                                    </span>
                                    <User className="w-5 h-5 text-white" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View - Visible only on mobile */}
            <div className="block md:hidden">
                {/* Overlay */}
                <div
                    className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}
                />

                {/* Mobile Profile Screen */}
                <div className={`fixed inset-0 z-[9999] profile-sidebar-mobile ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                    {/* Scrollable content container */}
                    <div className="h-full overflow-y-auto scrollbar-hide pb-32">
                        <div className="min-h-full">
                            {/* Header */}
                            <div className={`px-6 py-6 pt-12 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                            <div className="flex items-center justify-between">
                                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Profile
                                </h1>
                                {/* Dark Mode Toggle */}
                                <button
                                    onClick={toggleDarkMode}
                                    className={`flex items-center gap-1 px-4 py-2 rounded-full transition-all duration-300 ${isDark
                                        ? 'bg-gray-800 hover:bg-gray-700'
                                        : 'bg-[#EDEDF2] hover:bg-gray-100 shadow-md'
                                        }`}
                                    aria-label="Toggle dark mode"
                                >
                                    <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${isDark ? 'text-yellow-400' : 'text-gray-600'
                                        }`}>
                                        {isDark ? <Moon size={16} /> : <Sun size={16} />}
                                    </div>
                                    <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${isDark ? 'text-gray-600' : 'text-yellow-500'
                                        }`}>
                                        {isDark ? <Sun size={16} /> : <Moon size={16} />}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Profile Avatar Section */}
                        <div className={`px-6 py-8 flex flex-col items-center ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${isAuthenticated
                                ? 'bg-gradient-to-br from-[#007BFF] to-[#00C9A7]'
                                : isDark
                                    ? 'bg-gray-700'
                                    : 'bg-gray-200'
                                }`}>
                                {isAuthenticated && user?.name ? (
                                    <span className="text-white text-3xl font-bold">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                ) : (
                                    <User className={`w-12 h-12 ${isDark ? 'text-gray-300' : 'text-gray-600'
                                        }`} />
                                )}
                            </div>
                            <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {isAuthenticated && user?.name ? user.name : 'Guest'}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                student
                            </p>
                        </div>

                        {/* Menu Items */}
                        <div className="px-6 py-4">
                            <div className="space-y-3">
                                {mobileMenuItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleMenuItemClick(item.label)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 ${isDark
                                            ? 'bg-gray-700/50 hover:bg-gray-700 active:scale-95'
                                            : 'bg-[#EDEDF2] hover:bg-gray-100 shadow-sm active:scale-95'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'
                                                }`}>
                                                <item.icon className={`w-6 h-6 ${item.color}`} />
                                            </div>
                                            <span className={`font-medium text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                        <ChevronRight className={`w-6 h-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Log Out Button */}
                        <div className="px-6 py-6">
                            {isAuthenticated ? (
                                <button
                                    onClick={handleLogout}
                                    className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-200 active:scale-95 ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                >
                                    <LogOut className="w-6 h-6 text-white" />
                                    <span className="font-semibold text-white text-lg">
                                        Log Out
                                    </span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (onShowLogin) {
                                            onShowLogin();
                                            onClose();
                                        } else {
                                            navigate('/login');
                                            onClose();
                                        }
                                    }}
                                    className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-200 active:scale-95 ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                >
                                    <User className="w-6 h-6 text-white" />
                                    <span className="font-semibold text-white text-lg">
                                        Log In
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Mobile Bottom Navigation - Fixed at actual bottom with proper z-index and safe-area */}
                    <div 
                        className="fixed bottom-0 left-0 right-0 z-[10000]"
                        style={{
                            paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
                            paddingLeft: 'env(safe-area-inset-left)',
                            paddingRight: 'env(safe-area-inset-right)'
                        }}
                    >
                            <MobileBottomNav 
                                onShowLogin={onShowLogin} 
                                onProfileClick={() => {
                                    // When profile is clicked in ProfileSidebar, close it
                                    onClose();
                                }}
                                onNavigate={(path) => {
                                    // When other nav items are clicked, navigate and close sidebar
                                    if (path !== '/profile') {
                                        navigate(path);
                                        onClose();
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}