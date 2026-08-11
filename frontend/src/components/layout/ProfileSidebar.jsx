import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, User, HelpCircle, LogOut, Sun, Moon, Footprints, Mountain, CalendarDays, MapPinned, KeyRound } from 'lucide-react';
import { isCampusHuntEnabled, CAMPUS_HUNT_PATHS } from '../../features/campus-hunt/config';
import { fetchCampusHuntProfileEntries } from '../../features/campus-hunt/services/campusHunt.api';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import ProfileAvatarUpload from '../ProfileAvatarUpload';
import ProfileSidebarLoadingSkeleton from '../ProfileSidebarLoadingSkeleton';
import { usePageTransition } from './PageTransition';
import {
    fetchClubManagerProfileEligible,
    tryRunClubOrganizerAppSession,
} from '../../services/api/runClubOrganizer.api';
import {
    fetchTrekCommunityProfileEligible,
    tryTrekOrganizerAppSession,
} from '../../services/api/trekOrganizer.api';
import {
    fetchEventOrganizerProfileEligible,
    tryEventOrganizerAppSession,
} from '../../services/api/eventShowOrganizer.api';
import { resolveAuthToken, hasUsableAuthToken } from '../../utils/authToken';
import { prepareLogin } from '../../utils/loginFlow';

/** Session caches so reopening Profile does not wait on the network again */
let campusHuntProfileCache = null;
let organizerEligibilityCache = null;

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
    const { prepareRouteNavigation } = usePageTransition();
    const [clubManagerEligible, setClubManagerEligible] = useState(
        () => Boolean(organizerEligibilityCache?.club),
    );
    const [trekCommunityEligible, setTrekCommunityEligible] = useState(
        () => Boolean(organizerEligibilityCache?.trek),
    );
    const [eventOrganizerEligible, setEventOrganizerEligible] = useState(
        () => Boolean(organizerEligibilityCache?.event),
    );
    const [campusHuntLoginLive, setCampusHuntLoginLive] = useState(
        () => Boolean(campusHuntProfileCache?.showLogin),
    );
    const [campusHuntLeaderboardLive, setCampusHuntLeaderboardLive] = useState(
        () => Boolean(campusHuntProfileCache?.showLeaderboard),
    );

    const authPending = isLoading || isAuthProcessing || isRedirectProcessing;
    // Only skeleton on cold auth bootstrap — never block on organizer / hunt API calls
    const isProfileLoading = isOpen && authPending && !isAuthenticated && !user;
    const campusHuntCacheKey = isAuthenticated
        ? `u:${String(user?.uid || user?.id || user?.email || 'auth').toLowerCase()}`
        : 'guest';

    // Drop profile caches on confirmed logout (skip cold auth bootstrap)
    useEffect(() => {
        if (authPending || isAuthenticated) return undefined;
        campusHuntProfileCache = null;
        organizerEligibilityCache = null;
        setCampusHuntLoginLive(false);
        setCampusHuntLeaderboardLive(false);
        setClubManagerEligible(false);
        setTrekCommunityEligible(false);
        setEventOrganizerEligible(false);
        return undefined;
    }, [isAuthenticated, authPending]);

    // Campus Hunt Profile entries — admin toggles login / leaderboard separately
    useEffect(() => {
        if (!isOpen || !isCampusHuntEnabled()) {
            if (!isCampusHuntEnabled()) {
                setCampusHuntLoginLive(false);
                setCampusHuntLeaderboardLive(false);
            }
            return undefined;
        }

        // Only reuse cache for the same auth identity
        if (campusHuntProfileCache?.key === campusHuntCacheKey) {
            setCampusHuntLoginLive(Boolean(campusHuntProfileCache.showLogin));
            setCampusHuntLeaderboardLive(Boolean(campusHuntProfileCache.showLeaderboard));
        } else if (campusHuntProfileCache) {
            campusHuntProfileCache = null;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetchCampusHuntProfileEntries();
                if (cancelled) return;
                const next = {
                    key: campusHuntCacheKey,
                    showLogin: Boolean(res.data?.showLogin),
                    showLeaderboard: Boolean(res.data?.showLeaderboard),
                };
                campusHuntProfileCache = next;
                setCampusHuntLoginLive(next.showLogin);
                setCampusHuntLeaderboardLive(next.showLeaderboard);
            } catch {
                if (!cancelled && !campusHuntProfileCache) {
                    setCampusHuntLoginLive(false);
                    setCampusHuntLeaderboardLive(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, isAuthenticated, campusHuntCacheKey]);

    // Organizer rows load in the background; menu is usable immediately
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;

        if (!isAuthenticated) {
            setClubManagerEligible(false);
            setTrekCommunityEligible(false);
            setEventOrganizerEligible(false);
            organizerEligibilityCache = null;
            return undefined;
        }

        if (authPending) return undefined;

        const authToken = resolveAuthToken(token);
        if (!hasUsableAuthToken(authToken)) return undefined;

        const cacheKey = String(user?.email || authToken).toLowerCase();
        if (organizerEligibilityCache?.key === cacheKey) {
            setClubManagerEligible(Boolean(organizerEligibilityCache.club));
            setTrekCommunityEligible(Boolean(organizerEligibilityCache.trek));
            setEventOrganizerEligible(Boolean(organizerEligibilityCache.event));
            return undefined;
        }

        (async () => {
            try {
                const [clubData, trekData, eventData] = await Promise.all([
                    fetchClubManagerProfileEligible(authToken).catch(() => ({ eligible: false })),
                    fetchTrekCommunityProfileEligible(authToken).catch(() => ({ eligible: false })),
                    fetchEventOrganizerProfileEligible(authToken).catch(() => ({ eligible: false })),
                ]);
                if (cancelled) return;
                const next = {
                    key: cacheKey,
                    club: Boolean(clubData?.eligible),
                    trek: Boolean(trekData?.eligible),
                    event: Boolean(eventData?.eligible),
                };
                organizerEligibilityCache = next;
                setClubManagerEligible(next.club);
                setTrekCommunityEligible(next.trek);
                setEventOrganizerEligible(next.event);
            } catch {
                /* keep prior / empty */
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, isAuthenticated, authPending, user?.email, token]);

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
        campusHuntProfileCache = null;
        organizerEligibilityCache = null;
        setCampusHuntLoginLive(false);
        setCampusHuntLeaderboardLive(false);
        setClubManagerEligible(false);
        setTrekCommunityEligible(false);
        setEventOrganizerEligible(false);
        logout();
        onClose();
        navigate('/');
    };

    const MENU_ROUTES = {
        'Edit profile': '/edit-profile',
        'Help Center': '/help-center',
        'Campus Hunt login': CAMPUS_HUNT_PATHS.profileLogin,
        'Campus Hunt leaderboard': CAMPUS_HUNT_PATHS.leaderboard,
    };

    const goToPath = (path) => {
        if (location.pathname === path) {
            onClose();
            return;
        }
        prepareRouteNavigation(path);
        navigate(path);
        onClose();
    };

    const handleMenuItemClick = async (label) => {
        if (label === 'Campus Hunt login') {
            if (!isAuthenticated) {
                // Same bottom Google sheet as Profile icon (Runs / Treks style)
                if (onShowLogin) {
                    onShowLogin();
                    // Set after onShowLogin so Profile's prepareLogin doesn't wipe the return path
                    prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.profileLogin });
                } else {
                    prepareLogin({ returnPath: CAMPUS_HUNT_PATHS.profileLogin });
                    prepareRouteNavigation('/login');
                    navigate('/login', {
                        state: { from: { pathname: CAMPUS_HUNT_PATHS.profileLogin } },
                    });
                }
                onClose();
                return;
            }
            goToPath(CAMPUS_HUNT_PATHS.profileLogin);
            return;
        }

        if (label === 'Club manager') {
            try {
                const booted = await tryRunClubOrganizerAppSession(token);
                goToPath(booted?.token ? '/run-club-organizer' : '/run-club-organizer/login');
            } catch (err) {
                // Profile-email invite without organizer account → signup, not a failed login loop
                goToPath(err?.code === 'no_organizer_account'
                    ? '/run-club-organizer/signup'
                    : '/run-club-organizer/login');
            }
            return;
        }

        if (label === 'Trek community') {
            try {
                const booted = await tryTrekOrganizerAppSession(token);
                goToPath(booted?.token ? '/trek-organizer' : '/trek-organizer/login');
            } catch (err) {
                goToPath(err?.code === 'no_organizer_account'
                    ? '/trek-organizer/signup'
                    : '/trek-organizer/login');
            }
            return;
        }

        if (label === 'Event organizer') {
            try {
                const booted = await tryEventOrganizerAppSession(token);
                goToPath(booted?.token ? '/event-organizer' : '/event-organizer/login');
            } catch (err) {
                goToPath(err?.code === 'no_organizer_account'
                    ? '/event-organizer/signup'
                    : '/event-organizer/login');
            }
            return;
        }

        const path = MENU_ROUTES[label];
        if (!path) return;
        goToPath(path);
    };

    const campusHuntItems = [
        ...(campusHuntLoginLive
            ? [{ icon: KeyRound, label: 'Campus Hunt login', hint: 'Google sign-in · enter team code' }]
            : []),
        ...(campusHuntLeaderboardLive
            ? [{ icon: MapPinned, label: 'Campus Hunt leaderboard', hint: 'Live college scores' }]
            : []),
    ];

    const menuItems = [
        { icon: User, label: 'Edit profile' },
        ...campusHuntItems,
        ...(clubManagerEligible
            ? [{ icon: Footprints, label: 'Club manager', hint: 'Runs, guests, check-in & notify' }]
            : []),
        ...(trekCommunityEligible
            ? [{ icon: Mountain, label: 'Trek community', hint: 'Treks, participants, check-in & notify' }]
            : []),
        ...(eventOrganizerEligible
            ? [{ icon: CalendarDays, label: 'Event organizer', hint: 'Events, guests, check-in & notify' }]
            : []),
    ];

    const secondaryItems = [
        { icon: HelpCircle, label: 'Help Center' },
    ];

    // Mobile menu items - filtered based on authentication status
    const allMobileMenuItems = [
        { icon: User, label: 'Edit profile', requiresAuth: true },
        ...(campusHuntLoginLive
            ? [{ icon: KeyRound, label: 'Campus Hunt login', requiresAuth: false, hint: 'Google sign-in · enter team code' }]
            : []),
        ...(campusHuntLeaderboardLive
            ? [{ icon: MapPinned, label: 'Campus Hunt leaderboard', requiresAuth: false, hint: 'Live college scores' }]
            : []),
        ...(clubManagerEligible
            ? [{ icon: Footprints, label: 'Club manager', requiresAuth: true, hint: 'Runs, guests, check-in & notify' }]
            : []),
        ...(trekCommunityEligible
            ? [{ icon: Mountain, label: 'Trek community', requiresAuth: true, hint: 'Treks, participants, check-in & notify' }]
            : []),
        ...(eventOrganizerEligible
            ? [{ icon: CalendarDays, label: 'Event organizer', requiresAuth: true, hint: 'Events, guests, check-in & notify' }]
            : []),
        { icon: HelpCircle, label: 'Help Center', requiresAuth: false },
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

    const authLocked = !isAuthenticated;
    const lockClass = authLocked
        ? 'pointer-events-none select-none blur-[6px] opacity-70'
        : '';

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
                    <div className={`relative h-full rounded-l-2xl shadow-xl overflow-hidden overflow-y-auto scrollbar-hide ${isDark ? 'bg-[#161718]' : 'bg-white'
                        }`}>
                        {/* Header stays usable so guest can dismiss */}
                        <div className="relative z-20 px-4 pt-4">
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

                        <div className={`relative ${lockClass}`}>
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
                                        onShowLogin?.();
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

                        {authLocked && (
                            <button
                                type="button"
                                onClick={() => onShowLogin?.()}
                                className="absolute inset-0 z-10 cursor-pointer bg-transparent"
                                aria-label="Sign in with Google to unlock profile"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile View - Visible only on mobile */}
            <div className="block md:hidden profile-sidebar-layer">
                {/* Mobile Profile Screen */}
                <div className={`fixed inset-0 z-9999 profile-sidebar-mobile flex flex-col h-dvh max-h-dvh overflow-hidden ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                    <div className={`profile-sidebar-mobile__scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-hide ${lockClass}`}>
                        <main className="px-4 pt-[calc(var(--safe-top)+1rem)] sm:px-6 pb-4">
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
                                    onClick={() => onShowLogin?.()}
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

                    {authLocked && (
                        <button
                            type="button"
                            onClick={() => onShowLogin?.()}
                            className="absolute inset-0 z-[5] cursor-pointer bg-black/15"
                            aria-label="Sign in with Google to unlock profile"
                        />
                    )}

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