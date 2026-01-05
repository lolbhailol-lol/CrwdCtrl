import React from 'react';
import { Heart } from 'lucide-react';
import ShareIcon from '../assets/share.svg';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

const FestCard = ({ image, title, subtitle, emoji, venue, isFavorite, onToggleFavorite, onViewDetails, isDark, eventId, status }) => {

    // Get status badge color based on status
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'ongoing':
                return 'bg-green-500';
            case 'upcoming':
                return 'bg-orange-500';
            case 'completed':
                return 'bg-gray-500';
            case 'lastyearhit':
                return 'bg-purple-500';
            default:
                return 'bg-orange-500';
        }
    };

    const handleLike = (e) => {
        e.stopPropagation();
        onToggleFavorite(); // Call the prop function to handle favoriting
    };

    const handleShare = (e) => {
        e.stopPropagation();
        if (navigator.share) {
            navigator.share({
                title: title,
                text: `Check out this event: ${title}`,
                url: `${window.location.origin}/view-details/${eventId}`,
            }).catch(() => { });
        }
    };

    const handleViewDetailsClick = (e) => {
        e.stopPropagation();
        onViewDetails(); // Call the prop function to handle navigation
    };

    return (
        <div
            className={`rounded-xl shadow-md hover:shadow-lg transition-all  duration-300 overflow-hidden cursor-pointer mb-6 mx-2 ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}
            onClick={handleViewDetailsClick} // Make the whole card clickable 
        >
            {/* Image Section */}
            <div className="relative">
                <img
                    src={getImageUrl(image)}
                    alt={title}
                    className="w-full h-32 sm:h-36 md:h-36 object-cover rounded-t-xl" // Increased mobile height and rounded only top
                    onError={(e) => {
                        handleImageErrorWithFallback(e, 300, 150, '#6366f1', title || 'Event');
                    }}
                />

                {/* Status Badge */}
                {status && (
                    <div className="absolute top-2 left-2">
                        <span className={`${getStatusBadgeColor(status)} text-white text-xs px-2 py-1 rounded-full font-medium capitalize`}>
                            {status}
                        </span>
                    </div>
                )}

                {/* Heart Icon */}
                <button
                    onClick={handleLike}
                    className={`absolute top-2 right-2 w-9 h-9 rounded-full 
                    ${isDark ? 'bg-gray-800/80 hover:bg-gray-700/90' : 'bg-white/90 hover:bg-white'} 
                    shadow-lg flex items-center justify-center transition-all duration-200 z-10
                    border-2 ${isFavorite ? 'border-red-500' : 'border-white/20'}
                    backdrop-blur-sm`}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart
                        className={`w-5 h-5 transition-all duration-200 ${isFavorite
                            ? 'text-red-500 fill-red-500 scale-110'
                            : isDark 
                                ? 'text-white hover:text-red-400' 
                                : 'text-gray-600 hover:text-red-500'
                            }`}
                    />
                </button>
            </div>

            {/* Content Section */}
            <div className="p-3 sm:p-3">
                <div className='flex items-center justify-between mb-1'>
                    <h3 className={`text-sm sm:text-base font-semibold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {title} {emoji}
                    </h3>

                    {/* Share icon */}
                    <button
                        className={`w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full flex-shrink-0 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} z-10`}
                        onClick={handleShare}
                        aria-label={`Share ${title}`}
                    >
                        <img
                            src={ShareIcon}
                            alt="Share"
                            className={`${isDark ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 opacity-90 filter brightness-0 invert' : 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 opacity-70'}`}
                        />
                    </button>
                </div>

                {/* Date & Venue */}
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mb-3 sm:mb-2`}>
                    {subtitle}
                </p>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mb-3 sm:mb-2`}>
                    {venue}
                </p>

                <div>
                    <button
                        onClick={handleViewDetailsClick}
                        className="w-full bg-cyan-400 hover:bg-cyan-500 text-white font-medium text-xs px-3 py-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50"
                    >
                        VIEW DETAILS
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FestCard;
