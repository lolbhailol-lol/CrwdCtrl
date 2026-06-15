import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useNotifications } from '../../context/NotificationsContext';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import ProfileSidebar from '../../components/ProfileSidebar';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';

function NotificationsPanel() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({}); // Clear URL parameters
    };

    // Handle register modal close
    const handleCloseRegister = () => {
        setShowRegister(false);
    };

    // Switch from login to register
    const handleSwitchToRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };

    // Switch from register to login
    const handleSwitchToLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    // Handle notification click - mark as read
    const handleNotificationClick = (notificationId) => {
        markAsRead(notificationId);
    };

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex transition-colors duration-300 pb-4 lg:pb-8">
            <div className={`hidden lg:flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>
                <main className="flex-1 px-4 pt-4 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-md lg:max-w-2xl overflow-hidden rounded-2xl">
                        <div className={`px-4 pt-4 ${isDark ? 'bg-[#111213]' : 'bg-slate-100'}`}>
                            <div className="flex items-center justify-between pb-8">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate(-1)}
                                        aria-label="Go back"
                                        className={`shrink-0 p-1 rounded-lg transition-colors ${
                                            isDark ? 'text-white hover:bg-gray-800' : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                    <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Notifications
                                    </h1>
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={markAllAsRead}
                                        className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark
                                            ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                            : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                            }`}
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={`px-2.5 py-6 sm:px-4 min-h-[420px] rounded-2xl ${isDark ? 'bg-[#161718]' : 'bg-[#F5F6FA]'}`}>
                            {unreadCount > 0 && (
                                <p className={`mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                                </p>
                            )}
                            <div className="space-y-4">
                                {notifications.length > 0 ? (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification.id)}
                                            className={`p-4 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer ${isDark
                                                ? 'bg-gray-800/80 border border-gray-700/50 hover:border-[#007BFF]/30'
                                                : 'bg-white/90 border border-gray-200/50 hover:border-[#007BFF]/30'
                                                } ${notification.unread ? 'ring-2 ring-[#007BFF]/20' : ''}`}
                                        >
                                            <div className="flex items-start space-x-4">
                                                <div className={`p-2 rounded-xl shrink-0 ${notification.type === 'event'
                                                    ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                                                    : notification.type === 'reminder'
                                                        ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                                                        : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                                                    }`}>
                                                    {notification.type === 'event' ? <Calendar className="w-5 h-5" /> :
                                                        notification.type === 'reminder' ? <Clock className="w-5 h-5" /> :
                                                            <Bell className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between">
                                                        <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {notification.title}
                                                            {notification.unread && (
                                                                <span className="ml-2 w-2 h-2 bg-[#007BFF] rounded-full inline-block"></span>
                                                            )}
                                                        </h3>
                                                        <span className={`text-xs shrink-0 ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {notification.time}
                                                        </span>
                                                    </div>
                                                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        {notification.message}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={`text-center py-12 rounded-2xl ${isDark ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'
                                        }`}>
                                        <div className={`p-4 rounded-xl inline-block mb-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                            <Bell className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        </div>
                                        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            No notifications yet
                                        </h3>
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            You're all caught up! New notifications will appear here.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-1 flex-col w-full">
                <main className="flex-1 px-4 pt-4 sm:px-6 pb-4">
                    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">
                        <div className={`px-4 pt-4 ${isDark ? 'bg-[#111213]' : 'bg-slate-100'}`}>
                            <div className="flex items-center justify-between pb-8">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate(-1)}
                                        aria-label="Go back"
                                        className={`shrink-0 p-1 rounded-lg transition-colors ${
                                            isDark ? 'text-white hover:bg-gray-800' : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                    <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Notifications
                                    </h1>
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={markAllAsRead}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark
                                            ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                            : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                            }`}
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className={`px-2.5 py-6 sm:px-4 min-h-[420px] rounded-2xl ${isDark ? 'bg-[#161718]' : 'bg-[#F5F6FA]'}`}>
                    {unreadCount > 0 && (
                        <p className={`mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                        </p>
                    )}
                    <div className="space-y-3">
                        {notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification.id)}
                                    className={`p-4 rounded-xl shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer ${isDark
                                        ? 'bg-gray-800/60 border border-gray-700/30'
                                        : 'bg-white border border-gray-200/50'
                                        } ${notification.unread ? 'ring-1 ring-[#007BFF]/30' : ''}`}
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-lg shrink-0 ${notification.type === 'event'
                                            ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                                            : notification.type === 'reminder'
                                                ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                                                : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                                            }`}>
                                            {notification.type === 'event' ? <Calendar className="w-4 h-4" /> :
                                                notification.type === 'reminder' ? <Clock className="w-4 h-4" /> :
                                                    <Bell className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-1">
                                                <h3 className={`font-medium text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {notification.title}
                                                    {notification.unread && (
                                                        <span className="ml-1 w-1.5 h-1.5 bg-[#007BFF] rounded-full inline-block"></span>
                                                    )}
                                                </h3>
                                                <span className={`text-xs shrink-0 ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {notification.time}
                                                </span>
                                            </div>
                                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {notification.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`text-center py-16 rounded-xl ${isDark ? 'bg-gray-800/60 border border-gray-700/30' : 'bg-white border border-gray-200/50'
                                }`}>
                                <div className={`p-3 rounded-full inline-block mb-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <Bell className={`w-6 h-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                </div>
                                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    No notifications
                                </h3>
                                <p className={`text-sm px-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    You're all caught up! New notifications will appear here.
                                </p>
                            </div>
                        )}
                    </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Profile Sidebar */}
            <ProfileSidebar
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onShowLogin={() => setShowLogin(true)}
                onShowRegister={() => setShowRegister(true)}
            />

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

export default NotificationsPanel;