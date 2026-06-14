import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileSidebar from '../ProfileSidebar';

const ProfilePage = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(true);

    const handleClose = () => {
        setIsOpen(false);
        if (window.location.pathname === '/profile') {
            navigate('/', { replace: true });
        }
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors">
            <ProfileSidebar
                isOpen={isOpen}
                onClose={handleClose}
                onProfileClose={handleClose}
            />
        </div>
    );
};

export default ProfilePage;
