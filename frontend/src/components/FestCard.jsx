import React from 'react';
import { Heart, Zap, Clock, ArrowRight } from 'lucide-react';
import ShareIcon from '../assets/share.svg';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

const FestCard = ({ image, title, subtitle, emoji, venue, isFavorite, onToggleFavorite, onViewDetails, isDark, eventId, status }) => {

    // Get status badge styling with gradients and icons
    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'ongoing':
                return {
                    gradient: 'bg-gradient-to-r from-green-500 to-emerald-600',
                    glow: 'shadow-green-500/30',
                    icon: Zap
                };
            case 'upcoming':
                return {
                    gradient: 'bg-gradient-to-r from-orange-500 to-amber-600',
                    glow: 'shadow-orange-500/30',
                    icon: Clock
                };
            case 'completed':
                return {
                    gradient: 'bg-gradient-to-r from-gray-500 to-slate-600',
                    glow: 'shadow-gray-500/20',
                    icon: Clock
                };
            case 'lastyearhit':
                return {
                    gradient: 'bg-gradient-to-r from-purple-500 to-violet-600',
                    glow: 'shadow-purple-500/30',
                    icon: Zap
                };
            default:
                return {
                    gradient: 'bg-gradient-to-r from-orange-500 to-amber-600',
                    glow: 'shadow-orange-500/30',
                    icon: Clock
                };
        }
    };

    const handleLike = (e) => {
        e.stopPropagation();
        onToggleFavorite();
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
        onViewDetails();
    };

    const statusStyle = getStatusBadgeStyle(status);
    const StatusIcon = statusStyle.icon;

    return (
        <div
            className={`group relative rounded-2xl overflow-hidden cursor-pointer mb-6 mx-2 
                       transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                       ${isDark 
                           ? 'bg-black/20 backdrop-blur-3xl border border-white/20 shadow-2xl shadow-black/50' 
                           : 'bg-white/40 backdrop-blur-3xl border border-white/50 shadow-xl shadow-black/10'
                       }`}
            onClick={handleViewDetailsClick}
        >
            {/* Image Section with Overlay */}
            <div className="relative overflow-hidden">
                <img
                    src={getImageUrl(image)}
                    alt={title}
                    className="w-full h-40 sm:h-44 object-cover transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                             group-hover:scale-105"
                    onError={(e) => {
                        handleImageErrorWithFallback(e, 300, 176, '#6366f1', title || 'Event');
                    }}
                />
                
                {/* Subtle Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" />

                {/* Status Badge with Premium Glass Effect */}
                {status && (
                    <div className="absolute top-3 left-3 z-20">
                        <div className={`${statusStyle.gradient} ${statusStyle.glow} shadow-xl
                                       text-white text-xs px-3 py-1.5 rounded-full font-semibold capitalize
                                       flex items-center gap-1.5 backdrop-blur-2xl border-2 border-white/40
                                       bg-white/20`}>
                            <StatusIcon className="w-3 h-3" />
                            {status}
                        </div>
                    </div>
                )}

                {/* Heart Icon with Premium Glass Effect */}
                <button
                    onClick={handleLike}
                    className={`absolute top-3 right-3 w-10 h-10 rounded-full z-20
                               transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                               hover:scale-110 active:scale-95
                               ${isDark 
                                   ? 'bg-black/30 hover:bg-black/40 backdrop-blur-2xl border-2 border-white/30' 
                                   : 'bg-white/50 hover:bg-white/70 backdrop-blur-2xl border-2 border-white/60'
                               }
                               shadow-xl hover:shadow-2xl
                               ${isFavorite 
                                   ? 'shadow-red-500/40 border-red-500/60 bg-red-500/20' 
                                   : ''
                               }`}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart
                        className={`w-5 h-5 mx-auto transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                                   ${isFavorite
                                       ? 'text-red-500 fill-red-500 scale-110 animate-pulse' 
                                       : isDark 
                                           ? 'text-white hover:text-red-400 hover:scale-110' 
                                           : 'text-gray-800 hover:text-red-500 hover:scale-110'
                                   }`}
                    />
                </button>
            </div>

            {/* Content Section with Perfect Glass Background */}
            <div className={`p-5 relative
                           ${isDark 
                               ? 'bg-black/30 backdrop-blur-2xl' 
                               : 'bg-white/60 backdrop-blur-2xl'
                           }`}>
                {/* Title and Share Button */}
                <div className='flex items-start justify-between mb-3'>
                    <h3 className={`text-xl font-bold leading-tight flex-1 pr-2
                                   ${isDark ? 'text-white' : 'text-gray-900'}
                                   transition-all duration-300`}>
                        {title} {emoji}
                    </h3>

                    {/* Share Button with Cool Glass Effect */}
                    <button
                        className={`w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 z-10
                                   transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]
                                   hover:scale-110 active:scale-95
                                   ${isDark 
                                       ? 'bg-white/10 hover:bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-lg' 
                                       : 'bg-white/50 hover:bg-white/70 backdrop-blur-xl border-2 border-white/60 shadow-lg'
                                   }`}
                        onClick={handleShare}
                        aria-label={`Share ${title}`}
                    >
                        <img
                            src={ShareIcon}
                            alt="Share"
                            className={`w-4 h-4 transition-all duration-200
                                       ${isDark ? 'filter brightness-0 invert opacity-90 hover:opacity-100' : 'opacity-70 hover:opacity-90'}`}
                        />
                    </button>
                </div>

                {/* Meta Information with Glass Background */}
                <div className={`space-y-2 mb-4 p-3 rounded-xl
                               ${isDark 
                                   ? 'bg-black/20 backdrop-blur-xl border border-white/10' 
                                   : 'bg-white/40 backdrop-blur-xl border border-white/40'
                               }`}>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {subtitle}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'} flex items-center gap-1`}>
                        <span className="w-1 h-1 bg-current rounded-full opacity-60"></span>
                        {venue}
                    </p>
                </div>

                {/* View Details Button with Blue 3D Effect */}
                <button
                    onClick={handleViewDetailsClick}
                    className="w-full px-4 py-3 rounded-lg text-sm font-bold text-white
                               bg-gradient-to-b from-blue-500 to-blue-600 
                               hover:from-blue-600 hover:to-blue-700
                               active:from-blue-700 active:to-blue-800
                               shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40
                               border-2 border-blue-400/50 hover:border-blue-300/60
                               transform hover:scale-[1.02] active:scale-[0.98]
                               transition-all duration-200 ease-out
                               relative overflow-hidden
                               before:absolute before:inset-0 before:bg-gradient-to-r 
                               before:from-transparent before:via-white/20 before:to-transparent
                               before:translate-x-[-100%] hover:before:translate-x-[100%]
                               before:transition-transform before:duration-700"
                >
                    <span className="relative z-10">View Details</span>
                </button>
            </div>
        </div>
    );
};

export default FestCard;
