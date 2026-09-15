import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, Sparkles, Filter, Trash2, Plus, Share2 } from 'lucide-react';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import CardShareButton from '../../components/CardShareButton';
import { useFavorites } from '../../context/FavoritesContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { shareContent } from '../../utils/externalLink';

function getCollegeLabel(fest) {
    const raw = fest.collegeName || fest.college || fest.subtitle || fest.basedIn || '';
    return raw.replace(/^based in\s+/i, '').trim();
}

function FavoriteGridCard({ fest, onRemove, onViewDetails, isDark }) {
    const title = fest.title || fest.name || 'Unnamed Event';
    const college = getCollegeLabel(fest);

    const handleShare = (e) => {
        e.stopPropagation();
        const url = fest.detailPath
            ? `${window.location.origin}${fest.detailPath}`
            : fest.id
            ? `${window.location.origin}/view-details/${fest.id}`
            : window.location.href;
        shareContent({ title, text: `Check out ${title}`, url });
    };

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={() => onViewDetails(fest)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewDetails(fest);
                }
            }}
            className="card-surface rounded-3xl overflow-hidden cursor-pointer transition active:scale-[0.98]"
        >
            <div className="relative aspect-4/5 w-full">
                <img
                    src={getImageUrl(fest.heroImage || fest.image, { preset: 'cardPortrait' })}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                        handleImageErrorWithFallback(e, 180, 225, '#2A2B2E', title);
                    }}
                />
                <CardFavoriteButton isFavorite onClick={() => onRemove(fest.id)} />
            </div>
            <div className="px-3.5 py-3.5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h3 className={`text-[15px] font-bold leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {title}
                    </h3>
                    {college && (
                        <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {college}
                        </p>
                    )}
                </div>
                <CardShareButton onClick={handleShare} isDark={isDark} className="shrink-0 mt-0.5" />
            </div>
        </article>
    );
}

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
        <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl shadow-xl border z-10 ${
            isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-200'
        }`}>
            <div className="p-2">
                {filters.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeFilter === filter.id;

                    return (
                        <button
                            key={filter.id}
                            type="button"
                            onClick={() => {
                                onFilterChange(filter.id);
                                onClose();
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isActive
                                    ? 'bg-blue-500 text-white'
                                    : isDark
                                    ? 'text-gray-200 hover:bg-gray-800'
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

function EmptyFavorites({ onExplore, compact = false, isDark }) {
    return (
        <div className={`text-center ${compact ? 'py-16' : 'py-20'}`}>
            <Heart className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={compact ? 48 : 64} />
            <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                No favourites yet
            </h2>
            <p className={`mb-4 ${compact ? 'text-sm' : ''} ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Start adding events to your favourites!
            </p>
            <button
                type="button"
                onClick={onExplore}
                className="bg-[#0ECCEE] hover:opacity-90 text-black font-semibold px-6 py-2.5 rounded-full transition"
            >
                Explore Events
            </button>
        </div>
    );
}

function FestFavoritesPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { removeFavorite, clearAllFavorites, getFavoriteCount, favorites } = useFavorites();
    const [activeFilter, setActiveFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const favoriteEvents = useMemo(
        () => Object.entries(favorites).map(([id, data]) => ({ ...data, id: data.id || id })),
        [favorites],
    );

    const filteredEvents = useMemo(() => {
        if (activeFilter === 'cultural') {
            return favoriteEvents.filter((event) =>
                event.type?.toLowerCase().includes('cultural')
                || event.id?.toLowerCase().includes('cultural')
                || event.title?.toLowerCase().includes('cultural'),
            );
        }
        if (activeFilter === 'tech') {
            return favoriteEvents.filter((event) =>
                event.type?.toLowerCase().includes('tech')
                || event.id?.toLowerCase().includes('tech')
                || event.title?.toLowerCase().includes('tech'),
            );
        }
        if (activeFilter === 'sports') {
            return favoriteEvents.filter((event) =>
                event.type?.toLowerCase().includes('sports')
                || event.id?.toLowerCase().includes('sports')
                || event.title?.toLowerCase().includes('sports'),
            );
        }
        if (activeFilter === 'trending') {
            return favoriteEvents.filter((event) => event.trending);
        }
        return favoriteEvents;
    }, [favoriteEvents, activeFilter]);

    const handleRemove = (eventId) => {
        removeFavorite(eventId);
    };

    const handleViewDetails = (event) => {
        if (event.detailPath) {
            navigate(event.detailPath);
            return;
        }
        if (event.id) {
            navigate(`/view-details/${event.id}`);
            return;
        }
        navigate('/view-details');
    };

    const handleClearAll = () => {
        if (showClearConfirm) {
            clearAllFavorites();
            setShowClearConfirm(false);
        } else {
            setShowClearConfirm(true);
            setTimeout(() => setShowClearConfirm(false), 3000);
        }
    };

    const favoriteCount = getFavoriteCount();

    const handleShareFavorites = () => {
        const url = `${window.location.origin}/favorites`;
        shareContent({ title: 'My Favourites on CrwdCtrl', url });
    };

    const renderGrid = (compact = false) => {
        if (favoriteCount === 0) {
            return <EmptyFavorites onExplore={() => navigate('/')} compact={compact} isDark={isDark} />;
        }
        if (filteredEvents.length === 0) {
            return (
                <div className={`text-center ${compact ? 'py-16' : 'py-20'}`}>
                    <Filter className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} size={compact ? 48 : 64} />
                    <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        No events match this filter
                    </h2>
                    <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className="mt-4 bg-[#0ECCEE] hover:opacity-90 text-black font-semibold px-6 py-2.5 rounded-full transition"
                    >
                        Show All
                    </button>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-x-3 gap-y-5 sm:gap-4">
                {filteredEvents.map((fest) => (
                    <FavoriteGridCard
                        key={fest.id}
                        fest={fest}
                        onRemove={handleRemove}
                        onViewDetails={handleViewDetails}
                        isDark={isDark}
                    />
                ))}
            </div>
        );
    };

    const iconBtn = isDark
        ? 'size-10 rounded-full flex items-center justify-center bg-[#0a0a0a] text-white border border-gray-800 transition active:scale-95'
        : 'size-10 rounded-full flex items-center justify-center bg-white text-gray-900 shadow-sm transition active:scale-95';

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen overflow-x-clip pb-24 lg:pb-8 transition-colors">
            <main className="px-4 pt-[calc(var(--safe-top)+1rem)] sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-md lg:max-w-6xl">
                    <div className="px-4 pt-4">
                        <div className="flex items-start justify-between gap-3 pb-8">
                            <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Favourites
                            </h1>
                            <div className="flex items-center gap-2 shrink-0">
                                <button type="button" onClick={handleShareFavorites} className={iconBtn} aria-label="Share favourites">
                                    <Share2 size={18} />
                                </button>
                                <button type="button" onClick={() => navigate('/')} className={iconBtn} aria-label="Explore events">
                                    <Plus size={20} />
                                </button>
                                {favoriteCount > 0 && (
                                    <>
                                        <div className="relative hidden lg:block">
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                                                    isDark
                                                        ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                                                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                <Filter className="w-4 h-4" />
                                                Filter
                                            </button>
                                            <FilterDropdown
                                                isOpen={isFilterOpen}
                                                onClose={() => setIsFilterOpen(false)}
                                                onFilterChange={setActiveFilter}
                                                activeFilter={activeFilter}
                                                isDark={isDark}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearAll}
                                            className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                                                showClearConfirm
                                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                                    : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                                            }`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {showClearConfirm ? 'Confirm Clear All' : 'Clear All'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-2.5 py-6 sm:px-4 min-h-[420px]">
                        {renderGrid(true)}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default FestFavoritesPage;