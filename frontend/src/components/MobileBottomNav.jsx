import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Heart, Calendar, User } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = ({ onProfileClick, onShowLogin, onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark } = useDarkMode();
    const { isAuthenticated } = useAuth();
    const [mounted, setMounted] = useState(false);
    const lastTapRef = React.useRef(0);

    useEffect(() => { setMounted(true); }, []);

    const isItemActive = (itemPath, itemId) => {
        const p = location.pathname;
        if (itemId === 'home')       return p === '/';
        if (itemId === 'favorites')  return p === '/favorites';
        if (itemId === 'registered') return p === '/registered-fest';
        if (itemId === 'profile')    return p.includes('/profile') || p.includes('/edit-profile') || p.includes('/help-center') || p.includes('/list-your-fest') || p.includes('/notifications');
        return p === itemPath;
    };

    const navItems = [
        { id: 'home',       icon: Home,     label: 'Home',       path: '/' },
        { id: 'favorites',  icon: Heart,    label: 'Favourite',  path: '/favorites' },
        { id: 'registered', icon: Calendar, label: 'My Reg', path: '/registered-fest' },
        { id: 'profile',    icon: User,     label: 'Profile',    path: '/profile' },
    ];

    const handleNavClick = (path, itemId) => {
        if (itemId === 'profile' && !isAuthenticated) {
            onShowLogin?.();
            return;
        }
        // Double-tap on profile while already on profile → go home
        if (itemId === 'profile' && isItemActive(path, itemId)) {
            const now = Date.now();
            if (now - lastTapRef.current < 350) {
                navigate('/');
                lastTapRef.current = 0;
                return;
            }
            lastTapRef.current = now;
            return;
        }
        navigate(path);
        if (itemId === 'profile') onProfileClick?.();
        else onNavigate?.(path);
    };

    if (!mounted) return null;

    // Portal renders directly into document.body — completely immune to ancestor
    // transforms, stacking contexts, or display:none that break position:fixed on iOS
    return createPortal(
        <>
            {/* ── Bottom nav rendered at body level via portal ── */}
            <div
                id="crwdctrl-bottom-nav"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 99999,
                    paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
                    paddingLeft: 0,
                    paddingRight: 0,
                    pointerEvents: 'auto',
                    /* Promote to own compositor layer — keeps nav rock-solid during iOS scroll */
                    WebkitTransform: 'translate3d(0,0,0)',
                    transform: 'translate3d(0,0,0)',
                    willChange: 'transform',
                }}
            >
                <div
                    style={{
                        margin: '0 12px',
                        borderRadius: '20px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'}`,
                        backgroundColor: isDark
                            ? 'rgba(10, 10, 10, 0.98)'
                            : 'rgba(245, 246, 250, 0.98)',
                        WebkitBackdropFilter: 'blur(20px)',
                        backdropFilter: 'blur(20px)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            alignItems: 'center',
                            padding: '14px 4px',
                        }}
                    >
                        {navItems.map((item) => {
                            const active = isItemActive(item.path, item.id);
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item.path, item.id)}
                                    aria-label={item.label}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '8px 20px',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        WebkitTapHighlightColor: 'transparent',
                                        WebkitAppearance: 'none',
                                        color: active
                                            ? '#00C2CB'
                                            : isDark ? '#e5e7eb' : '#6b7280',
                                        transition: 'color 0.2s ease',
                                    }}
                                >
                                    <IconComponent
                                        size={24}
                                        strokeWidth={2}
                                        style={{
                                            transform: active ? 'scale(1.15)' : 'scale(1)',
                                            transition: 'transform 0.2s ease',
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Spacer injected at body level so pages know to pad their content */}
            <div style={{ height: 'calc(68px + max(env(safe-area-inset-bottom), 8px))' }} />
        </>,
        document.body
    );
};

export default MobileBottomNav;
