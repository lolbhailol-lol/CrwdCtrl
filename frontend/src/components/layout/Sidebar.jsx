import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Home,
    Calendar,
    Heart,
    Grid,
    Sun,
    Moon,
    Menu,
    X,
    LogOut,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import AppLogo from '../AppLogo';

const Sidebar = ({ onShowLogin }) => {
    const { isDark, toggleDarkMode } = useDarkMode();
    const { getFavoriteCount } = useFavorites();
    const { logout, isAuthenticated } = useAuth();
    const { isCollapsed, toggleCollapse, isMobileMenuOpen, setIsMobileMenuOpen } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();

    const favoriteCount = getFavoriteCount();

    // Primary navigation items matching current features
    const primaryNavigationItems = [
        { id: 'home', icon: Home, label: 'Home', path: '/' },
        { id: 'favorites', icon: Heart, label: 'Favorites', path: '/favorites', count: favoriteCount },
        { id: 'bookings', icon: Calendar, label: 'Bookings', path: '/booking' },
    ];

    // Secondary navigation items matching current features
    const secondaryNavigationItems = [
        { id: 'view-all', icon: Grid, label: 'View All', path: '/fests' },
    ];

    // Check if route matches navigation item path
    const isItemActive = (itemPath) => {
        if (itemPath === '/') {
            return location.pathname === '/' || location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(itemPath);
    };

    const handleNavigation = (path) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    const handleLogout = () => {
        if (logout) {
            logout();
        }
        setIsMobileMenuOpen(false);
    };

    const handleLoginClick = () => {
        setIsMobileMenuOpen(false);
        if (onShowLogin) {
            onShowLogin();
        }
    };

    return (
        <aside
            className={`hidden lg:flex fixed left-3 top-3 bottom-3 z-50 flex-col justify-between py-4 transition-all duration-300 ease-in-out backdrop-blur-2xl rounded-[2rem] border ${isDark
                ? 'bg-[#09090b]/95 border-white/20 text-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                : 'bg-[#F3F4F9] border-gray-200/90 text-gray-800 shadow-gray-200/50'
                } ${isCollapsed ? 'w-20 px-2' : 'w-56 px-3'
                }`}
        >
            {/* Top Section: Header & Navigation Links */}
            <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
                {/* Header Row: App Logo & Collapse Arrow Toggle */}
                <div className="flex flex-col items-center mb-5 w-full px-1 overflow-hidden transition-all duration-300">
                    {isCollapsed ? (
                        <div className="flex flex-col items-center justify-center gap-3 w-full pt-1">
                            <div
                                onClick={() => handleNavigation('/')}
                                className="flex items-center justify-center cursor-pointer group shrink-0"
                                title="Home"
                            >
                                <AppLogo size={32} />
                            </div>
                            <button
                                type="button"
                                aria-label="Expand sidebar"
                                title="Expand Sidebar"
                                onClick={toggleCollapse}
                                className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none ${isDark
                                    ? 'text-[#007BFF] hover:bg-white/10 bg-white/5'
                                    : 'text-[#007BFF] hover:bg-black/5 bg-black/5'
                                    }`}
                            >
                                <ChevronRight className="w-5 h-5 text-[#007BFF]" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full min-h-[3.25rem] px-1">
                            <div
                                onClick={() => handleNavigation('/')}
                                className="flex items-center cursor-pointer group shrink-0"
                                title="Home"
                            >
                                <AppLogo size={44} />
                            </div>
                            <button
                                type="button"
                                aria-label="Collapse sidebar"
                                title="Collapse Sidebar"
                                onClick={toggleCollapse}
                                className={`hidden lg:flex items-center justify-center p-2 rounded-xl transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none ${isDark
                                    ? 'text-gray-400 hover:text-white hover:bg-white/10'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
                                    }`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Primary Navigation Items */}
                <nav className="space-y-1.5 px-0.5">
                    {primaryNavigationItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item.path);

                        return (
                            <div key={item.id} className="relative group">
                                <button
                                    type="button"
                                    onClick={() => handleNavigation(item.path)}
                                    className={`group relative w-full flex items-center transition-colors duration-200 outline-none focus:outline-none select-none cursor-pointer active:scale-98 ${isCollapsed
                                        ? 'lg:justify-center lg:px-0 px-3 py-2.5 rounded-xl text-xs font-medium'
                                        : 'gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold'
                                        } ${active
                                            ? isDark ? 'text-white font-bold' : 'text-[#007BFF] font-bold'
                                            : isDark ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]' : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                                        }`}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="sidebar-active-pill"
                                            className={`absolute inset-0 rounded-xl pointer-events-none ${isDark
                                                ? 'bg-[#141417] border border-white/20 shadow-md'
                                                : 'bg-[#EAF2FE] shadow-xs'
                                                }`}
                                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                        />
                                    )}
                                    <div className="relative z-10 flex items-center justify-center">
                                        <Icon
                                            className={`w-5 h-5 shrink-0 transition-colors duration-200 group-hover:scale-105 ${active
                                                ? isDark ? 'text-cyan-400' : 'text-[#007BFF]'
                                                : isDark ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'
                                                }`}
                                        />
                                        {/* Counter Badge Dot in Collapsed Desktop Mode */}
                                        {isCollapsed && item.count > 0 && (
                                            <span className="hidden lg:flex absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 items-center justify-center shadow-xs ring-2 ring-[#0B0F19]">
                                                {item.count > 99 ? '99+' : item.count}
                                            </span>
                                        )}
                                    </div>

                                    {/* Label text - visible when expanded */}
                                    <span className={`relative z-10 truncate text-left ${isCollapsed ? 'lg:hidden flex-1' : 'flex-1'
                                        }`}>
                                        {item.label}
                                    </span>

                                    {/* Counter Badge Pill - expanded mode */}
                                    {(!isCollapsed || false) && item.count > 0 && (
                                        <span className={`relative z-10 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2 min-w-[18px] h-4 flex items-center justify-center shadow-xs ${isCollapsed ? 'lg:hidden' : ''
                                            }`}>
                                            {item.count > 99 ? '99+' : item.count}
                                        </span>
                                    )}
                                </button>

                                {/* Desktop Hover Tooltip when Sidebar is Collapsed */}
                                {isCollapsed && (
                                    <div className="hidden lg:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap">
                                        {item.label}
                                        {item.count > 0 && ` (${item.count})`}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Section Divider Line */}
                <div className="my-4 px-1">
                    <div className={`h-px transition-all duration-300 ${isCollapsed ? 'lg:w-8 lg:mx-auto w-full' : 'w-full'
                        } ${isDark ? 'bg-white/10' : 'bg-gray-300/80'}`} />
                </div>

                {/* Secondary Navigation Items */}
                <nav className="space-y-1.5 px-0.5">
                    {secondaryNavigationItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item.path);

                        return (
                            <div key={item.id} className="relative group">
                                <button
                                    type="button"
                                    onClick={() => handleNavigation(item.path)}
                                    className={`group relative w-full flex items-center transition-colors duration-200 outline-none focus:outline-none select-none cursor-pointer active:scale-98 ${isCollapsed
                                        ? 'lg:justify-center lg:px-0 px-3 py-2.5 rounded-xl text-xs font-medium'
                                        : 'gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold'
                                        } ${active
                                            ? isDark ? 'text-white font-bold' : 'text-[#007BFF] font-bold'
                                            : isDark ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]' : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                                        }`}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="sidebar-active-pill"
                                            className={`absolute inset-0 rounded-xl pointer-events-none ${isDark
                                                ? 'bg-[#141417] border border-white/20 shadow-md'
                                                : 'bg-[#EAF2FE] shadow-xs'
                                                }`}
                                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                        />
                                    )}
                                    <Icon
                                        className={`relative z-10 w-5 h-5 shrink-0 transition-colors duration-200 group-hover:scale-105 ${active
                                            ? isDark ? 'text-cyan-400' : 'text-[#007BFF]'
                                            : isDark ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'
                                            }`}
                                    />

                                    <span className={`relative z-10 truncate text-left ${isCollapsed ? 'lg:hidden flex-1' : 'flex-1'
                                        }`}>
                                        {item.label}
                                    </span>
                                </button>

                                {/* Desktop Hover Tooltip when Sidebar is Collapsed */}
                                {isCollapsed && (
                                    <div className="hidden lg:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap">
                                        {item.label}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Section: Full-Width Theme Switcher & Log Out */}
            <div className="pt-4 space-y-2 border-t border-white/10">
                {/* Theme Switcher Button matching Logout length */}
                <div className={`relative group ${isCollapsed ? 'lg:flex lg:justify-center' : ''}`}>
                    <button
                        type="button"
                        aria-label="Toggle theme"
                        onClick={() => toggleDarkMode(!isDark)}
                        className={`group flex items-center transition-all duration-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 select-none ${isCollapsed
                            ? 'lg:w-10 lg:h-10 lg:justify-center lg:rounded-xl w-full gap-3 px-3 py-2.5 rounded-2xl'
                            : 'w-full justify-between gap-3 px-3 py-2.5 rounded-2xl'
                            } text-xs font-medium ${isDark
                                ? 'text-gray-300 hover:text-white hover:bg-white/5'
                                : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'
                            }`}
                        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        <div className="flex items-center gap-3">
                            {isDark ? (
                                <Moon className="w-4 h-4 shrink-0 text-[#007BFF]" />
                            ) : (
                                <Sun className="w-4 h-4 shrink-0 text-yellow-500" />
                            )}
                            <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                                {isDark ? 'Dark Mode' : 'Light Mode'}
                            </span>
                        </div>

                        {/* Switch Pill on Right side */}
                        <div className={`w-8 h-4 rounded-full relative p-0.5 transition-colors duration-300 ${isCollapsed ? 'lg:hidden flex items-center' : 'flex items-center'
                            } ${isDark ? 'bg-[#007BFF]' : 'bg-gray-400'}`}>
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isDark ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                        </div>
                    </button>

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                        <div className="hidden lg:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap">
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                        </div>
                    )}
                </div>

                {/* Log Out / Log In Button directly below theme toggle button */}
                <div className={`relative group ${isCollapsed ? 'lg:flex lg:justify-center' : ''}`}>
                    {isAuthenticated ? (
                        <button
                            type="button"
                            onClick={handleLogout}
                            className={`group flex items-center text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 select-none ${isCollapsed
                                ? 'lg:w-10 lg:h-10 lg:justify-center lg:rounded-xl w-full gap-3 px-3 py-2.5 rounded-2xl'
                                : 'w-full gap-3 px-3 py-2.5 rounded-2xl'
                                }`}
                        >
                            <LogOut className="w-4 h-4 shrink-0 text-red-400 group-hover:text-red-300" />
                            <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>Log Out</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleLoginClick}
                            className={`group flex items-center text-xs font-medium text-[#007BFF] hover:bg-[#007BFF]/10 transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 select-none ${isCollapsed
                                ? 'lg:w-10 lg:h-10 lg:justify-center lg:rounded-xl w-full gap-3 px-3 py-2.5 rounded-2xl'
                                : 'w-full gap-3 px-3 py-2.5 rounded-2xl'
                                }`}
                        >
                            <LogOut className="w-4 h-4 shrink-0 text-[#007BFF]" />
                            <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>Log In</span>
                        </button>
                    )}

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                        <div className="hidden lg:block absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap">
                            {isAuthenticated ? 'Log Out' : 'Log In'}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
