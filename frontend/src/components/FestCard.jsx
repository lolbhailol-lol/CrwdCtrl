import React from 'react';
import { Zap, Clock, ArrowRight } from 'lucide-react';
import ContentImage from './ContentImage';
import CardFavoriteButton from './CardFavoriteButton';
import CardShareButton from './CardShareButton';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

const FestCard = ({ image, title, subtitle, emoji, venue, isFavorite, onToggleFavorite, onViewDetails, isDark, eventId, status }) => {

    // Get status badge styling with gradients and icons
    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'ongoing':
                return {
                    gradient: 'bg-linear-to-r from-green-500 to-emerald-600',
                    glow: 'shadow-green-500/30',
                    icon: Zap
                };
            case 'upcoming':
                return {
                    gradient: 'bg-linear-to-r from-orange-500 to-amber-600',
                    glow: 'shadow-orange-500/30',
                    icon: Clock
                };
            case 'completed':
                return {
                    gradient: 'bg-linear-to-r from-gray-500 to-slate-600',
                    glow: 'shadow-gray-500/20',
                    icon: Clock
                };
            case 'lastyearhit':
                return {
                    gradient: 'bg-linear-to-r from-purple-500 to-violet-600',
                    glow: 'shadow-purple-500/30',
                    icon: Zap
                };
            default:
                return {
                    gradient: 'bg-linear-to-r from-orange-500 to-amber-600',
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
            className="card-surface group relative rounded-2xl overflow-hidden cursor-pointer mb-6 mx-2 transition-all duration-300 ease-in-out"
            onClick={handleViewDetailsClick}
        >
            {/* Image Section with Overlay */}
            <div className="relative overflow-hidden">
                <ContentImage
                    src={image}
                    alt={title}
                    preset="cardLg"
                    className="w-full h-40 sm:h-44 object-cover"
                    onError={(e) => {
                        handleImageErrorWithFallback(e, 300, 176, '#6366f1', title || 'Event');
                    }}
                />
                
                {/* Subtle Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 ease-in-out" />

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

                <CardFavoriteButton isFavorite={isFavorite} onClick={handleLike} className="z-20" />
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

                    <CardShareButton onClick={handleShare} isDark={isDark} className="z-10" />
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
                               bg-linear-to-b from-blue-500 to-blue-600 
                               hover:from-blue-600 hover:to-blue-700
                               active:from-blue-700 active:to-blue-800
                               shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40
                               border-2 border-blue-400/50 hover:border-blue-300/60
                               transform hover:scale-[1.02] active:scale-[0.98]
                               transition-all duration-200 ease-out
                               relative overflow-hidden
                               before:absolute before:inset-0 before:bg-linear-to-r 
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
