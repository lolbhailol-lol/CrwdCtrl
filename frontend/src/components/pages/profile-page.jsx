import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileSidebar from '../ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { usePageTransition } from '../PageTransition';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { startOverlayTransition } = usePageTransition();

    const [isOpen, setIsOpen] = useState(true);
    const { isDark } = useDarkMode();

    const handleDismiss = () => {
        setIsOpen(false);
    };

    const handleClose = () => {
        handleDismiss();
        startOverlayTransition('/', () => {
            if (window.location.pathname === '/profile') {
                navigate('/');
            }
        });
    };

    return (
        <div className={`min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <ProfileSidebar
                isOpen={isOpen}
                onClose={handleClose}
                onProfileClose={handleDismiss}
            />
        </div>
    );
};

export default ProfilePage;
