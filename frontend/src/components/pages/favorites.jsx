import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Heart, Calendar, MapPin, Clock, Sparkles, Filter, Trash2, ArrowLeft } from 'lucide-react';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import CrwdCtrlLogin from './login';
import CrwdCtrlRegister from './register';
import axios from 'axios';

// Configure axios base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.baseURL = API_BASE_URL;

// Mobile-specific card component for mobile layout
const MobileFestCard = ({ fest, onRemove, onViewDetails, isDark }) => {
    return (
        <div className={`relative rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${isDark ? 'bg-[#111213] border border-gray-800' : 'bg-white border border-gray-100'
            }`}>
            {/* Event Image */}
            <div className="relative h-40">
                <img
                    src={getImageUrl(fest.heroImage || fest.image)}
                    alt={fest.title || fest.name}
                    className="w-full h-full object-cover rounded-t-2xl"
                    onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80';
                    }}
                />
                {/* Remove Button - Circular at top-right of image */}
                <button
                    onClick={() => onRemove(fest.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 backdrop-blur-sm flex items-center justify-center hover:bg-red-600 transition-all duration-200 shadow-lg"
                    title="Remove from favorites"
                >
                    <X className="w-4 h-4 text-white" />
                </button>
            </div>

            {/* Card Content */}
            <div className="p-4">
                {/* Event Name */}
                <h3 className={`text-base font-bold mb-1 leading-tight ${isDark ? 'text-white' : 'text-gray-900'
                    }`}
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                    }}>
                    {fest.title || fest.name}
                </h3>

                {/* College Name */}
                <p className={`text-sm mb-2 leading-tight ${isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                    }}>
                    {fest.subtitle || fest.college || fest.venue}
                </p>

                {/* Date */}
                <div className={`flex items-center gap-2 text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="truncate">{fest.dateTime || fest.date}</span>
                </div>

                {/* View Details Button */}
                <button
                    onClick={() => onViewDetails(fest)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                >
                    View details
                </button>
            </div>
        </div>
    );
};

// Desktop card component (matching Dashboard ArtistCard design)
const FestCard = ({ fest, onRemove, onViewDetails, isDark }) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const handleImageError = () => {
        setImageError(true);
        setImageLoading(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    return (
        <div
            className={`rounded-xl overflow-hidden duration-300 cursor-pointer shadow-md hover:shadow-lg transition-all
    ${isDark
                    ? 'bg-[#111213]'
                    : 'bg-[#EDEDF2]'
                }`}
            onClick={() => onViewDetails(fest)}
        >
            <div className="relative h-[160px] sm:h-[180px] overflow-hidden rounded-t-xl">
                {/* Loading placeholder */}
                {imageLoading && (
                    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#161718]' : 'bg-gray-200'}`}>
                        <div className="animate-pulse text-center">
                            <div className={`w-8 h-8 rounded-full mx-auto mb-2 ${isDark ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                        </div>
                    </div>
                )}

                {/* Error fallback */}
                {imageError ? (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#161718]' : 'bg-gray-200'}`}>
                        <div className="text-center">
                            <div className={`text-4xl mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>🎭</div>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Image unavailable</p>
                        </div>
                    </div>
                ) : (
                    <img
                        src={getImageUrl(fest.heroImage || fest.image)}
                        alt={fest.title || fest.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        style={{ display: imageLoading ? 'none' : 'block' }}
                    />
                )}

                {/* Remove Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(fest.id);
                    }}
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 w-7 sm:w-9 h-7 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-red-500/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                    aria-label="Remove from favorites"
                >
                    <X className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" />
                </button>
            </div>

            <div className={`p-3 ${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'}`}>
                {/* Event Name */}
                <div className="mb-2">
                    <h3 className={`text-sm sm:text-base font-bold mb-1 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {fest.title || fest.name}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {fest.type || 'Event'}
                    </p>
                </div>

                {/* Event Details */}
                <div className="space-y-1 mb-3">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {fest.subtitle || fest.college || fest.venue}
                            </p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {fest.dateTime || fest.date}
                            </p>
                        </div>
                        {fest.ticketPrice && (
                            <div className="text-right shrink-0">
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {fest.ticketPrice}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* View Details Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails(fest);
                    }}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-xs px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                >
                    View details
                </button>
            </div>
        </div>
    );
};

const FilterDropdown = ({ isOpen, onClose, onFilterChange, activeFilter, isDark }) => {
    const filters = [
        { id: 'all', label: 'All Events', icon: Calendar },
        { id: 'cultural', label: 'Cultural Fest', icon: Sparkles },
        { id: 'tech', label: 'Tech Fest', icon: Calendar },
        { id: 'sports', label: 'Sports Fest', icon: Calendar },
        { id: 'trending', label: 'Trending', icon: Sparkles },
    ];

    if (!isOpen) return null;

    return (
        <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl shadow-xl border z-10 ${isDark
            ? 'bg-[#161718] '
            : 'bg-white border-gray-200'
            }`}>
            <div className="p-2">
                {filters.map(filter => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.id;

                    return (
                        <button
                            key={filter.id}
                            onClick={() => {
                                onFilterChange(filter.id);
                                onClose();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                ? 'bg-blue-500 text-white'
                                : isDark
                                    ? 'text-gray-300 hover:bg-gray-900'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {filter.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

function FestFavoritesPage() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { getFavoriteEvents, removeFavorite, clearAllFavorites, getFavoriteCount } = useFavorites();
    const [favoriteEvents, setFavoriteEvents] = useState([]);
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
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

    // Helper function to get event by ID (fallback for missing events)
    const getEventById = (_eventId) => {
        // This is a placeholder function since we don't have access to the full events data
        // In a real app, this would fetch from a central store or API
        return null;
    };

    // Load and process favorite events
    useEffect(() => {
        const favorites = getFavoriteEvents();
        const processedEvents = favorites.map(favorite => {
            // Try to get full event data from eventsData
            const fullEventData = getEventById(favorite.id);
            if (fullEventData) {
                return fullEventData;
            }

            // Fallback to stored favorite data or create minimal data
            return {
                id: favorite.id,
                title: favorite.title || favorite.name || 'Unnamed Event',
                subtitle: favorite.subtitle || favorite.college || '',
                heroImage: favorite.heroImage || favorite.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
                dateTime: favorite.dateTime || favorite.date || 'Date TBA',
                venue: favorite.venue || 'Venue TBA',
                type: favorite.type || 'Event',
                ticketPrice: favorite.ticketPrice || null,
                trending: favorite.trending || false,
                ...favorite
            };
        });

        setFavoriteEvents(processedEvents);
    }, [getFavoriteEvents]);

    // Apply filters
    useEffect(() => {
        let filtered = favoriteEvents;

        if (activeFilter === 'cultural') {
            filtered = favoriteEvents.filter(event =>
                event.type?.toLowerCase().includes('cultural') ||
                event.id?.toLowerCase().includes('cultural') ||
                event.title?.toLowerCase().includes('cultural')
            );
        } else if (activeFilter === 'tech') {
            filtered = favoriteEvents.filter(event =>
                event.type?.toLowerCase().includes('tech') ||
                event.id?.toLowerCase().includes('tech') ||
                event.title?.toLowerCase().includes('tech')
            );
        } else if (activeFilter === 'sports') {
            filtered = favoriteEvents.filter(event =>
                event.type?.toLowerCase().includes('sports') ||
                event.id?.toLowerCase().includes('sports') ||
                event.title?.toLowerCase().includes('sports')
            );
        } else if (activeFilter === 'trending') {
            filtered = favoriteEvents.filter(event => event.trending);
        }

        setFilteredEvents(filtered);
    }, [favoriteEvents, activeFilter]);

    const handleRemove = (eventId) => {
        removeFavorite(eventId);
        // The useEffect will automatically update the favoriteEvents when favorites change
    };

    const handleViewDetails = (event) => {
        if (event.id) {
            navigate(`/view-details/${event.id}`);
        } else {
            // Fallback navigation
            navigate('/view-details');
        }
    };

    const handleClearAll = () => {
        if (showClearConfirm) {
            clearAllFavorites();
            setShowClearConfirm(false);
        } else {
            setShowClearConfirm(true);
            // Auto-hide confirmation after 3 seconds
            setTimeout(() => setShowClearConfirm(false), 3000);
        }
    };

    const favoriteCount = getFavoriteCount();

    return (
        <div className={`min-h-screen flex transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
            {/* Desktop Layout */}
            <div className={`hidden lg:flex lg:flex-1 lg:flex-col transition-all duration-300`}>

                {/* Desktop Page Header */}
                <main className="flex-1 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Favorites
                            </h1>
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {favoriteCount} {favoriteCount === 1 ? 'event' : 'events'} saved
                            </p>
                        </div>

                        {favoriteCount > 0 && (
                            <div className="flex items-center gap-3">
                                {/* Filter Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isDark
                                            ? 'bg-[#161718] border-gray-700 text-gray-300 hover:bg-gray-900'
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Filter className="w-4 h-4" />
                                        <span className="hidden sm:inline">Filter</span>
                                    </button>

                                    <FilterDropdown
                                        isOpen={isFilterOpen}
                                        onClose={() => setIsFilterOpen(false)}
                                        onFilterChange={setActiveFilter}
                                        activeFilter={activeFilter}
                                        isDark={isDark}
                                    />
                                </div>

                                {/* Clear All Button */}
                                <button
                                    onClick={handleClearAll}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showClearConfirm
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : isDark
                                            ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                                            : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                                        }`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">
                                        {showClearConfirm ? 'Confirm Clear All' : 'Clear All'}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </main>

                {/* Desktop Content */}
                <div className="p-4 sm:p-6">
                    {favoriteCount === 0 ? (
                        <div className="text-center py-20">
                            <Heart className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={64} />
                            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                No favorites yet
                            </h2>
                            <p className={`mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Start adding fests to your favorites!
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                Explore Events
                            </button>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="text-center py-20">
                            <Filter className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={64} />
                            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                No events match this filter
                            </h2>
                            <p className={`mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Try selecting a different filter or browse all favorites
                            </p>
                            <button
                                onClick={() => setActiveFilter('all')}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                Show All Favorites
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredEvents.map(fest => (
                                <FestCard
                                    key={fest.id}
                                    fest={fest}
                                    onRemove={handleRemove}
                                    onViewDetails={handleViewDetails}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-1 flex-col">
                {/* Mobile Header */}
                <div className={`sticky top-0 z-40 backdrop-blur-md  transition-all duration-300 ${isDark ? 'bg-[#161718]/90 border-gray-700' : 'bg-white/90 border-gray-200'
                    }`}>
                    <div className="flex items-center px-4 py-3">
                        {/* Back Arrow */}
                        <button
                            onClick={() => navigate(-1)}
                            className={`mr-3 p-2 rounded-xl transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-900 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* Title */}
                        <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                            Favourites
                        </h1>
                    </div>
                </div>

                {/* Mobile Content */}
                <main className="flex-1 px-4 py-4 pb-20">
                    {favoriteCount === 0 ? (
                        <div className="text-center py-16">
                            <Heart className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={48} />
                            <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                No favorites yet
                            </h2>
                            <p className={`mb-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Start adding fests to your favorites!
                            </p>
                            <button
                                onClick={() => navigate('/')}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                Explore Events
                            </button>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="text-center py-16">
                            <Filter className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={48} />
                            <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                No events match this filter
                            </h2>
                            <p className={`mb-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                Try selecting a different filter
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {filteredEvents.map(fest => (
                                <MobileFestCard
                                    key={fest.id}
                                    fest={fest}
                                    onRemove={handleRemove}
                                    onViewDetails={handleViewDetails}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    )}
                </main>

            </div>

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

export default FestFavoritesPage;