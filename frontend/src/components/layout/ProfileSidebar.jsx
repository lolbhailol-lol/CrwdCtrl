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

function GoogleIcon({ className = 'w-6 h-6' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

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
    const [campusHuntMyTeams, setCampusHuntMyTeams] = useState(
        () => campusHuntProfileCache?.myTeams || [],
    );

    const authPending = isLoading || isAuthProcessing || isRedirectProcessing;
    // Only skeleton on cold auth bootstrap — never block on organizer / hunt API calls
    const isProfileLoading = isOpen && authPending && !isAuthenticated && !user;
    // Primitive identity for effect deps (strings compare by value — not by reference)
    const campusHuntIdentity = isAuthenticated
        ? String(user?.uid || user?.id || user?.email || '').toLowerCase()
        : '';

    // Drop profile caches on confirmed logout (skip cold auth bootstrap)
    useEffect(() => {
        if (authPending || isAuthenticated) return undefined;
        campusHuntProfileCache = null;
        organizerEligibilityCache = null;
        setCampusHuntLoginLive(false);
        setCampusHuntLeaderboardLive(false);
        setCampusHuntMyTeams([]);
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
                setCampusHuntMyTeams([]);
            }
            return undefined;
        }

        // Avoid a throwaway fetch as `u:auth` before user fields hydrate after login
        if (isAuthenticated && !campusHuntIdentity) return undefined;

        const cacheKey = isAuthenticated ? `u:${campusHuntIdentity}` : 'guest';

        // Cache hit for this identity → apply UI state, skip network
        if (campusHuntProfileCache?.key === cacheKey) {
            setCampusHuntLoginLive(Boolean(campusHuntProfileCache.showLogin));
            setCampusHuntLeaderboardLive(Boolean(campusHuntProfileCache.showLeaderboard));
            setCampusHuntMyTeams(campusHuntProfileCache.myTeams || []);
            return undefined;
        }

        if (campusHuntProfileCache) {
            campusHuntProfileCache = null;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetchCampusHuntProfileEntries();
                if (cancelled) return;
                const next = {
                    key: cacheKey,
                    showLogin: Boolean(res.data?.showLogin),
                    showLeaderboard: Boolean(res.data?.showLeaderboard),
                    myTeams: Array.isArray(res.data?.myTeams) ? res.data.myTeams : [],
                };
                campusHuntProfileCache = next;
                setCampusHuntLoginLive(next.showLogin);
                setCampusHuntLeaderboardLive(next.showLeaderboard);
                setCampusHuntMyTeams(next.myTeams);
            } catch {
                if (!cancelled && !campusHuntProfileCache) {
                    setCampusHuntLoginLive(false);
                    setCampusHuntLeaderboardLive(false);
                    setCampusHuntMyTeams([]);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, isAuthenticated, campusHuntIdentity]);

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
        setCampusHuntMyTeams([]);
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
        const teamEntry = campusHuntMyTeams.find(
            (t) => label === `Team ${t.teamCode}` || label === t.teamCode,
        );
        if (teamEntry?.loginPath) {
            goToPath(teamEntry.loginPath);
            return;
        }

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

    const campusHuntTeamItems = (campusHuntMyTeams || []).map((t) => ({
        icon: KeyRound,
        label: `Team ${t.teamCode}`,
        hint: t.teamName || t.college || 'Open team login',
    }));

    const campusHuntItems = [
        ...campusHuntTeamItems,
        ...(campusHuntLoginLive && campusHuntTeamItems.length === 0
            ? [{ icon: KeyRound, label: 'Campus Hunt login', hint: 'Google sign-in · enter team code' }]
            : []),
        ...(campusHuntLoginLive && campusHuntTeamItems.length > 0
            ? [{ icon: KeyRound, label: 'Campus Hunt login', hint: 'Enter another team code' }]
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
        ...campusHuntTeamItems.map((item) => ({ ...item, requiresAuth: false })),
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

    return (
        <>
            {/* Desktop/Laptop View - Hidden on mobile */}
            <div className="hidden md:block profile-sidebar-layer">
                {/* Full Screen Overlay */}
                <div
                    className={`fixed inset-0 z-60 transition-opacity duration-300 ${isDark ? 'bg-black/40' : 'bg-black/20'}`}
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

                        <div className="relative">
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
                                    onClick={() => onShowLogin?.()}
                                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl transition-colors group bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 active:scale-[0.98]"
                                >
                                    <GoogleIcon className="w-5 h-5" />
                                    <span className="font-medium text-black">
                                        Continue with Google
                                    </span>
                                </button>
                            )}
                        </div>
                        </>
                        )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Mobile View - Visible only on mobile */}
            <div className="block md:hidden profile-sidebar-layer">
                {/* Mobile Profile Screen */}
                <div className={`fixed inset-0 z-9999 profile-sidebar-mobile flex flex-col h-dvh max-h-dvh overflow-hidden ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                    <div className="profile-sidebar-mobile__scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-hide">
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
                                    <GoogleIcon />
                                    <span className="font-semibold text-black text-lg">
                                        Continue with Google
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