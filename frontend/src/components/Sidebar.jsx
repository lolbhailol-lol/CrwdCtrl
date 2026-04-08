import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Heart, Ticket, Settings, HelpCircle, Sun, Moon, Menu, X, LogOut } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import { useFavorites } from '../context/FavoritesContext';
import logo from '../assets/logo01_.svg';

const Sidebar = () => {
    const { isDark, toggleDarkMode } = useDarkMode();
    const { getFavoriteCount } = useFavorites();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const favoriteCount = getFavoriteCount();

    const navigationItems = [
        { id: 'home', icon: Home, label: 'Home', path: '/' },
      
        { id: 'favorites', icon: Heart, label: 'Favorites', path: '/favorites', count: favoriteCount },
        { id: 'events', icon: Calendar, label: 'Events', path: '/registered-fest' },
    ];

    // Determine active item based on current path
    const getActiveItem = () => {
        const currentPath = location.pathname;
        const activeItem = navigationItems.find(item => item.path === currentPath);
        return activeItem ? activeItem.id : null; // Return null if no exact match found
    };

    const handleNavigation = (item) => {
        navigate(item.path);
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`fixed top-4 left-4 z-50 lg:hidden p-3 rounded-xl transition-all duration-200 ${isDark
                    ? 'bg-dark-950/90 text-white border border-gray-900'
                    : 'bg-white/90 text-gray-800 border border-gray-200 shadow-lg'
                    }`}
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-dark-950/50 z-50 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
               className={`fixed left-0 top-0 bottom-0 w-16 lg:w-20 rounded-tr-[40px] rounded-br-[40px] 
${isDark ? 'bg-[#0a0a0a]' : 'bg-[#F5F6FA]'} 
border-[1px] ${isDark ? 'border-blue-500' : 'border-[#86C4C4]'}
flex flex-col items-center py-6 z-50 backdrop-blur-md transition-transform duration-300 
${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
`}
            >

                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="lg:hidden absolute top-4 right-4 text-white/80 hover:text-white"
                >
                    <X className="w-6 h-6" />
                </button>
                {/* Logo */}
                <div className="mb-8 group">
                    <img
                        src={logo}
                        alt="CrwdCtrl Logo"
                        className="w-16 h-16 object-contain transition-transform duration-300 "
                    />
                </div>

                {/* Navigation Icons */}
                <nav className="flex-1 flex flex-col items-center space-y-8 pt-8">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = getActiveItem() === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavigation(item)}
                                className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 group ${
                                    item.special && !isActive
                                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                                        : isActive
                                            ? item.special 
                                                ? 'bg-gradient-to-r from-purple-600 to-blue-600'
                                                : 'bg-[#4169E1]'
                                            : 'hover:scale-105'
                                    }`}

                            >
                                <Icon
                                    className={`w-6 h-6 transition-all duration-300 ${
                                        item.special
                                            ? 'text-white drop-shadow-lg'
                                            : isActive
                                                ? 'text-white drop-shadow-lg'
                                                : 'text-[#4169E1] group-hover:text-white group-hover:drop-shadow-lg'
                                        }`}
                                />

                                {/* Count Badge for favorites */}
                                {item.count > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium shadow-lg">
                                        {item.count > 99 ? '99+' : item.count}
                                    </div>
                                )}

                                {/* Tooltip */}
                                <div className="absolute left-16 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                                    {item.label}
                                    {item.count > 0 && ` (${item.count})`}
                                </div>

                                {/* Glowing effect for active item */}
                                {isActive && (
                                    <div
                                        className="absolute inset-0 rounded-2xl animate-pulse"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(0, 199, 167, 0.2) 0%, rgba(0, 123, 255, 0.2) 100%)',
                                            filter: 'blur(8px)',
                                            zIndex: -1
                                        }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Bottom Section: Theme Toggle */}
                <div className="flex flex-col items-center space-y-4">
                    <button
                        onClick={() => toggleDarkMode(!isDark)}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 group bg-[#4169E1]`}

                    >
                        {isDark ? (
                            <Sun className="w-5 h-5 text-white/90 group-hover:text-white transition-colors" />
                        ) : (
                            <Moon className="w-5 h-5 text-white/90 group-hover:text-white transition-colors" />
                        )}

                        {/* Tooltip */}
                        <div className="absolute left-16 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                        </div>
                    </button>


                </div>

            </div>
        </>
    );
};

export default Sidebar;