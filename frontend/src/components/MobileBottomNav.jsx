import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Calendar, User } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';
import { usePageTransition } from './PageTransition';

const MobileBottomNav = ({ onProfileClick, onProfileClose, onShowLogin, onNavigate, isProfileOpen = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark } = useDarkMode();
    const { isAuthenticated } = useAuth();
    const { isTransitioning, contentVisible, startOverlayTransition } = usePageTransition();
    const [mounted, setMounted] = useState(false);
    const lastTapRef = React.useRef(0);

    useEffect(() => { setMounted(true); }, []);

    const isItemActive = (itemPath, itemId) => {
        const p = location.pathname;
        if (itemId === 'profile')    return isProfileOpen || p.includes('/profile') || p.includes('/edit-profile') || p.includes('/help-center') || p.includes('/list-your-fest') || p.includes('/notifications');
        // Profile is an overlay — underlying route (e.g. /) must not stay highlighted
        if (isProfileOpen) return false;
        if (itemId === 'home')       return p === '/';
        if (itemId === 'favorites')  return p === '/favorites';
        if (itemId === 'booking') return p === '/booking';
        return p === itemPath;
    };

    const navItems = [
        { id: 'home',       icon: Home,     label: 'Home',       path: '/' },
        { id: 'favorites',  icon: Heart,    label: 'Favourite',  path: '/favorites' },
        { id: 'booking', icon: Calendar, label: 'Bookings', path: '/booking' },
        { id: 'profile',    icon: User,     label: 'Profile',    path: '/profile' },
    ];

    const handleNavClick = (path, itemId) => {
        if (itemId === 'profile' && !isAuthenticated) {
            onShowLogin?.();
            return;
        }
        if (itemId === 'profile') {
            // Profile is a sidebar overlay — do not navigate (avoids skeleton flash over profile)
            if (isProfileOpen) {
                const now = Date.now();
                if (now - lastTapRef.current < 350) {
                    onProfileClose?.();
                    if (location.pathname === '/profile') navigate('/');
                    lastTapRef.current = 0;
                    return;
                }
                lastTapRef.current = now;
                return;
            }
            startOverlayTransition('/profile', () => onProfileClick?.());
            return;
        }
        navigate(path);
        onNavigate?.(path);
    };

    if (!mounted || isTransitioning || !contentVisible) return null;

    // Portal renders directly into document.body — completely immune to ancestor
    // transforms, stacking contexts, or display:none that break position:fixed on iOS
    return createPortal(
        <>
            {/* ── Bottom nav rendered at body level via portal ── */}
            <div id="crwdctrl-bottom-nav" className="bottom-nav-shell">
                <div
                    className="bottom-nav-pill"
                    style={{
                        backgroundColor: isDark ? '#0A0A0A' : '#F5F6FA',
                    }}
                >
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
                                    style={{
                                        color: active
                                            ? '#00C2CB'
                                            : isDark ? '#e5e7eb' : '#111827',
                                    }}
                                >
                                    <span className="bottom-nav-item__icon crisp-icon-svg">
                                        <IconComponent size={26} strokeWidth={2} />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Spacer injected at body level so pages know to pad their content */}
            <div className="bottom-nav-spacer" aria-hidden="true" />
        </>,
        document.body
    );
};

export default MobileBottomNav;
