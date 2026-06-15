import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Calendar, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/** Prevent duplicate profile opens from double-tap. */
const PROFILE_TAP_COOLDOWN_MS = 400;
const profileTapGuard = { lastAt: 0 };

/** Prevent duplicate route navigations from double-tap / ghost clicks. */
const ROUTE_TAP_COOLDOWN_MS = 450;
const routeTapGuard = { lastAt: 0, path: '' };

const MobileBottomNav = ({ onProfileClick, onProfileClose, onShowLogin, onNavigate, isProfileOpen = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const isSameRoute = (path, itemId) => {
        if (itemId === 'home') {
            return location.pathname === '/' || location.pathname === '/dashboard';
        }
        return location.pathname === path;
    };

    const isItemActive = (itemPath, itemId) => {
        const p = location.pathname;
        if (itemId === 'profile') {
            return isProfileOpen || p.includes('/profile') || p.includes('/edit-profile') || p.includes('/help-center') || p.includes('/list-your-fest') || p.includes('/notifications');
        }
        if (isProfileOpen) return false;
        if (itemId === 'home') return p === '/' || p === '/dashboard';
        if (itemId === 'favorites') return p === '/favorites';
        if (itemId === 'booking') return p === '/booking';
        return p === itemPath;
    };

    const navItems = [
        { id: 'home', icon: Home, label: 'Home', path: '/' },
        { id: 'favorites', icon: Heart, label: 'Favourite', path: '/favorites' },
        { id: 'booking', icon: Calendar, label: 'Bookings', path: '/booking' },
        { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
    ];

    const shouldIgnoreRouteTap = (path) => {
        const now = Date.now();
        if (routeTapGuard.path === path && now - routeTapGuard.lastAt < ROUTE_TAP_COOLDOWN_MS) {
            return true;
        }
        routeTapGuard.lastAt = now;
        routeTapGuard.path = path;
        return false;
    };

    const handleNavClick = (path, itemId) => {
        if (itemId === 'profile' && !isAuthenticated) {
            onShowLogin?.();
            return;
        }

        if (itemId === 'profile') {
            const now = Date.now();
            if (now - profileTapGuard.lastAt < PROFILE_TAP_COOLDOWN_MS) {
                return;
            }
            profileTapGuard.lastAt = now;

            if (isProfileOpen) {
                return;
            }
            onProfileClick?.();
            return;
        }

        if (shouldIgnoreRouteTap(path)) {
            return;
        }

        if (isProfileOpen) {
            if (onNavigate) {
                onNavigate(path);
                return;
            }
            onProfileClose?.();
        }

        if (isSameRoute(path, itemId)) {
            return;
        }

        navigate(path);
    };

    if (!mounted) return null;

    return createPortal(
        <>
            <div
                id="crwdctrl-bottom-nav"
                className={`bottom-nav-shell${isProfileOpen ? ' bottom-nav-shell--profile-open' : ''}`}
            >
                <div className="bottom-nav-pill">
                    <div className="bottom-nav-pill__inner">
                        {navItems.map((item) => {
                            const active = isItemActive(item.path, item.id);
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleNavClick(item.path, item.id)}
                                    aria-label={item.label}
                                    aria-current={active ? 'page' : undefined}
                                    className="bottom-nav-item touch-target"
                                >
                                    <span className="bottom-nav-item__icon crisp-icon-svg">
                                        <IconComponent size={22} strokeWidth={2} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {!isProfileOpen && (
                <div className="bottom-nav-spacer" aria-hidden="true" />
            )}
        </>,
        document.body
    );
};

export default MobileBottomNav;
