import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileSidebar from '../ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';

const ProfilePage = () => {
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(true);
    const { isDark } = useDarkMode();

    const handleClose = () => {
        setIsOpen(false);

        // Only navigate back to home after a delay, and only if we're still on profile page
        setTimeout(() => {
            // Check if we're still on the profile page (not navigated away)
            if (window.location.pathname === '/profile') {
                navigate('/');
            }
        }, 300); // Wait for animation to complete
    };

    return (
        <div className={`min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <ProfileSidebar
                isOpen={isOpen}
                onClose={handleClose}
            />
        </div>
    );
};

export default ProfilePage;