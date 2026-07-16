import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, User, Calendar, HelpCircle, LogOut, Heart, Bell, Sun, Moon, Footprints } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import ProfileAvatarUpload from '../ProfileAvatarUpload';
import ProfileSidebarLoadingSkeleton from '../ProfileSidebarLoadingSkeleton';
import { SKELETON_LOADING_MS } from '../../constants/skeletonLoading';
import { usePageTransition } from './PageTransition';
import { tryRunClubOrganizerAppSession } from '../../services/api/runClubOrganizer.api';

export default function ProfileSidebar({
    isOpen,
    onClose,
    onProfileClose = onClose,
    onShowLogin,
    onShowRegister: _onShowRegister,
    embedBottomNav = true,
}) {
    const { isDark, toggleDarkMode } = useDarkMode();
    const { user, logout, isAuthenticated, isLoading, isAuthProcessing, isRedirectProcessing, token } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { prepareRouteNavigation, startOverlayTransition } = usePageTransition();
    const [sidebarRevealReady, setSidebarRevealReady] = useState(false);
    const [clubManagerEligible, setClubManagerEligible] = useState(false);
    const [clubManagerLoading, setClubManagerLoading] = useState(false);

    const authPending = isLoading || isAuthProcessing || isRedirectProcessing;

    useEffect(() => {
        if (!isOpen) {
            setSidebarRevealReady(false);
            return undefined;
        }

        setSidebarRevealReady(false);
        const revealTimer = window.setTimeout(() => setSidebarRevealReady(true), SKELETON_LOADING_MS);
        return () => window.clearTimeout(revealTimer);
    }, [isOpen]);

    // Only admin-approved emails / approved organizers see Club manager in Profile
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;

        if (!isAuthenticated || authPending) {
            if (!isAuthenticated) {
                setClubManagerEligible(false);
                setClubManagerLoading(false);
            }
            return undefined;
        }

        setClubManagerLoading(true);
        (async () => {
            try {
                const data = await fetchClubManagerProfileEligible(token);
                if (!cancelled) setClubManagerEligible(Boolean(data.eligible));
            } catch {
                if (!cancelled) setClubManagerEligible(false);
            } finally {
                if (!cancelled) setClubManagerLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, isAuthenticated, authPending, user?.email, token]);

    const isProfileLoading = isOpen && (
        !sidebarRevealReady
        || authPending
        || (isAuthenticated && clubManagerLoading)
    );

    useEffect(() => {
        if (!isOpen) return undefined;

        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        if (!isMobile) return undefined;

        document.body.classList.add('profile-sidebar-open');
        return () => {
            document.body.classList.remove('profile-sidebar-open');
        };
    }, [isOpen]);

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/');
    };

    const MENU_ROUTES = {
        'Edit profile': '/edit-profile',
        Bookings: '/booking',
        'Help Center': '/help-center',
        Favourites: '/favorites',
        Notifications: '/notifications',
    };

    const handleMenuItemClick = async (label) => {
        if (label === 'Club manager') {
            const booted = await tryRunClubOrganizerAppSession(token);
            const path = booted?.token ? '/run-club-organizer' : '/run-club-organizer/login';
            prepareRouteNavigation(path);
            navigate(path);
            onClose();
            return;
        }

        const path = MENU_ROUTES[label];
        if (!path) return;

        // Already on the destination — just close, briefly showing its skeleton.
        if (location.pathname === path) {
            startOverlayTransition(path, onClose);
            return;
        }

        // Show the destination skeleton immediately so the home/previous page
        // doesn't flash ("peep") during the route change, then navigate + close.
        prepareRouteNavigation(path);
        navigate(path);
        onClose();
    };

    const menuItems = [
        { icon: User, label: 'Edit profile' },
        ...(clubManagerEligible
            ? [{ icon: Footprints, label: 'Club manager', hint: 'Runs, guests, check-in & notify' }]
            : []),
        { icon: Calendar, label: 'Bookings' },
    ];

    const secondaryItems = [
        { icon: HelpCircle, label: 'Help Center' },
    ];

    // Mobile menu items - filtered based on authentication status
    const allMobileMenuItems = [
        { icon: User, label: 'Edit profile', requiresAuth: true },
        ...(clubManagerEligible
            ? [{ icon: Footprints, label: 'Club manager', requiresAuth: true, hint: 'Runs, guests, check-in & notify' }]
            : []),
        { icon: Heart, label: 'Favourites', requiresAuth: false },
        { icon: Calendar, label: 'Bookings', requiresAuth: false },
        { icon: HelpCircle, label: 'Help Center', requiresAuth: false },
        { icon: Bell, label: 'Notifications', requiresAuth: true },
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
            <div className="hidden md:block profile-sidebar-layer">
                {/* Full Screen Overlay */}
                <div
                    className={`fixed inset-0 backdrop-blur-sm z-60 transition-opacity duration-300 ${isDark ? 'bg-[#161718]/50' : 'bg-white/30'}`}
                    onClick={onClose}
                />

                {/* Sidebar */}
                <div className={`fixed right-0 top-0 z-70 w-full max-w-md h-full transform transition-all duration-300 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                    }`}>
                    <div className={`h-full rounded-l-2xl shadow-xl overflow-hidden overflow-y-auto scrollbar-hide ${isDark ? 'bg-[#161718]' : 'bg-white'
                        }`}>
                        {/* Header */}
                        <div className="px-4 pt-4">
                            <div className="flex items-center justify-between pb-8">
                                <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Profile
                                </h1>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                                    aria-label="Close profile"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Profile Section */}
                        {isProfileLoading ? (
                            <ProfileSidebarLoadingSkeleton variant="desktop" isDark={isDark} />
                        ) : (
                        <>
                        <div className="px-6 pt-2 pb-6">
                            <div className="flex items-center gap-4">
                                <ProfileAvatarUpload
                                    isDark={isDark}
                                    sizeClass="w-20 h-20"
                                    initialClass="text-3xl"
                                    guestIconClass="w-10 h-10"
                                    cameraBtnClass="w-7 h-7"
                                    className="items-start!"
                                />
                                <div>
                                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {isAuthenticated && user?.name ? user.name : 'guest'}
                                    </h2>
                                    <p className={`text-base font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {isAuthenticated && user?.email ? user.email : 'student'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="px-6 py-2 space-y-1.5">
                            {menuItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleMenuItemClick(item.label)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl shadow-lg transition-all duration-300 group ${
                                        isDark
                                            ? 'border border-gray-800 bg-[#111213] hover:bg-gray-800'
                                            : 'border border-gray-100 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'
                                            }`}>
                                            <item.icon className="w-5 h-5 text-[#0ECCEE]" />
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
                        <div className="px-6 pt-0 pb-2 space-y-1.5">
                            {secondaryItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleMenuItemClick(item.label)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl shadow-lg transition-all duration-300 group ${
                                        isDark
                                            ? 'border border-gray-800 bg-[#111213] hover:bg-gray-800'
                                            : 'border border-gray-100 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'
                                            }`}>
                                            <item.icon className="w-5 h-5 text-[#0ECCEE]" />
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <span className={`font-medium block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {item.label}
                                            </span>
                                            {item.hint ? (
                                                <span className={`text-[11px] block truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {item.hint}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 shrink-0 transition-colors ${isDark
                                        ? 'text-gray-500 group-hover:text-gray-300'
                                        : 'text-gray-400 group-hover:text-gray-600'
                                        }`} />
                                </button>
                            ))}
                        </div>

                        {/* Log Out Button */}
                        <div className="px-6 pt-2 pb-6">
                            {isAuthenticated ? (
                                <button
                                    onClick={handleLogout}
                                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl shadow-lg transition-all duration-300 group ${
                                        isDark
                                            ? 'border border-gray-800 bg-[#111213] hover:bg-gray-800'
                                            : 'border border-gray-100 bg-white hover:bg-gray-50'
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
                                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl transition-colors group bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 active:scale-[0.98]`}
                                >
                                    <span className="font-medium text-black">
                                        Log In
                                    </span>
                                    <User className="w-5 h-5 text-black" />
                                </button>
                            )}
                        </div>
                        </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile View - Visible only on mobile */}
            <div className="block md:hidden profile-sidebar-layer">
                {/* Mobile Profile Screen */}
                <div className={`fixed inset-0 z-9999 profile-sidebar-mobile flex flex-col h-dvh max-h-dvh overflow-hidden ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                    <div className="profile-sidebar-mobile__scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-hide">
                        <main className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 pb-4">
                            <div
                                className={`mx-auto w-full max-w-md rounded-2xl ${
                                    isDark ? 'bg-[#161718]' : 'bg-white'
                                }`}
                            >
                                <div className="px-4 pt-4">
                                    <div className="flex items-start justify-between gap-3 pb-8">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                Profile
                                            </h1>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleDarkMode();
                                            }}
                                            className={`relative z-10 flex shrink-0 items-center gap-1 px-4 py-2 rounded-full transition-all duration-300 touch-manipulation ${isDark
                                                ? 'bg-[#111213] hover:bg-gray-800'
                                                : 'bg-gray-100 hover:bg-gray-200'
                                                }`}
                                            aria-label="Toggle dark mode"
                                        >
                                            <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${isDark ? 'text-yellow-400' : 'text-gray-600'}`}>
                                                {isDark ? <Moon size={16} /> : <Sun size={16} />}
                                            </div>
                                            <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 ${isDark ? 'text-gray-600' : 'text-yellow-500'}`}>
                                                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="px-2.5 py-6 sm:px-4">
                        {isProfileLoading ? (
                            <ProfileSidebarLoadingSkeleton
                                variant="mobile"
                                menuCount={Math.max(mobileMenuItems.length, 3)}
                                isDark={isDark}
                            />
                        ) : (
                        <>
                        {/* Profile Avatar Section */}
                        <div className="pb-6 flex flex-col items-center">
                            <ProfileAvatarUpload
                                isDark={isDark}
                                className="mb-3"
                            />
                            <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {isAuthenticated && user?.name ? user.name : 'Guest'}
                            </h2>
                            <p className={`text-base font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                student
                            </p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                            <div className="space-y-3">
                                {mobileMenuItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleMenuItemClick(item.label)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl shadow-lg transition-all duration-300 active:scale-95 ${
                                            isDark
                                                ? 'border border-gray-800 bg-[#111213] hover:bg-gray-800'
                                                : 'border border-gray-100 bg-white hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'
                                                }`}>
                                                <item.icon className="w-6 h-6 text-[#0ECCEE]" />
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <span className={`font-medium text-lg block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {item.label}
                                                </span>
                                                {item.hint ? (
                                                    <span className={`text-xs block truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {item.hint}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-6 h-6 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Log Out Button */}
                        <div className="pt-2 pb-2">
                            {isAuthenticated ? (
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-200 active:scale-95 bg-[#0ECCEE] hover:bg-[#0ECCEE]/90"
                                >
                                    <LogOut className="w-6 h-6 text-black" />
                                    <span className="font-semibold text-black text-lg">
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
                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-200 active:scale-95 bg-[#0ECCEE] hover:bg-[#0ECCEE]/90"
                                >
                                    <User className="w-6 h-6 text-black" />
                                    <span className="font-semibold text-black text-lg">
                                        Log In
                                    </span>
                                </button>
                            )}
                        </div>
                        </>
                        )}
                                </div>
                            </div>
                        </main>
                    </div>

                    {embedBottomNav && (
                    <MobileBottomNav
                        onShowLogin={onShowLogin}
                        isProfileOpen
                        onProfileClose={onProfileClose}
                        onNavigate={(path) => {
                            if (path === '/profile') return;
                            const alreadyThere = path === '/'
                                ? location.pathname === '/' || location.pathname === '/dashboard'
                                : location.pathname === path;
                            if (alreadyThere) {
                                onProfileClose?.();
                                return;
                            }
                            onProfileClose?.();
                            navigate(path);
                        }}
                    />
                    )}
                </div>
            </div>
        </>
    );
}