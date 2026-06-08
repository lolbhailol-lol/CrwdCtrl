import { Heart, Share2 } from 'lucide-react';
import ContentImage from './ContentImage';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

export default function HomeEventCard({
    event,
    isDark = false,
    isFavorite = false,
    onToggleFavorite,
    onViewDetails,
    shareUrl,
    className = '',
    prominentImage = false,
}) {
    const handleShare = (e) => {
        e.stopPropagation();
        const url = shareUrl || `${window.location.origin}/view-details/${event.id}`;
        if (navigator.share) {
            navigator.share({
                title: event.title,
                text: `Check out ${event.title}`,
                url,
            }).catch(() => {});
        }
    };

    const handleFav = (e) => {
        e.stopPropagation();
        onToggleFavorite?.();
    };

    return (
        <div
            className={`shrink-0 w-[280px] sm:w-[300px] cursor-pointer rounded-3xl
                transition-all duration-200 active:scale-[0.98]
                ${prominentImage ? 'px-2.5 pt-2.5 pb-3' : 'p-4'}
                ${isDark ? (prominentImage ? 'bg-black' : 'bg-[#1a1b1e]') : 'bg-[#F2F4F7]'}
                ${className}`}
            onClick={onViewDetails}
        >
            {/* Image — larger inset on carousel cards, same outer card size */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset={prominentImage ? 'card' : 'card'}
                    className="h-full w-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(
                        e,
                        prominentImage ? 320 : 300,
                        prominentImage ? 213 : 225,
                        '#6366f1',
                        event.title || 'Event',
                    )}
                />
                {onToggleFavorite && (
                    <button
                        type="button"
                        onClick={handleFav}
                        className={`absolute left-3 top-3 flex size-8 items-center justify-center rounded-full
                            transition-all duration-200 active:scale-90
                            ${isFavorite
                                ? 'bg-red-500/90'
                                : 'border border-white/80 bg-black/20'
                            }`}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Heart
                            size={16}
                            strokeWidth={2}
                            className={`crisp-icon-svg ${isFavorite ? 'fill-white text-white' : 'text-white'}`}
                        />
                    </button>
                )}
            </div>

            {/* Title + share */}
            <div className={`flex items-start justify-between gap-3 ${prominentImage ? 'mt-2' : 'mt-3'}`}>
                <div className="min-w-0 flex-1">
                    <h3 className={`text-[15px] leading-snug line-clamp-1
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title}
                    </h3>
                    {event.subtitle && (
                        <p className={`mt-0.5 text-xs leading-snug line-clamp-1
                            ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {event.subtitle}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleShare}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full active:opacity-80
                        ${isDark ? 'bg-[#2a2b2e]' : 'bg-[#E4E7EC]'}`}
                    aria-label={`Share ${event.title}`}
                >
                    <Share2
                        size={16}
                        strokeWidth={2}
                        className={`crisp-icon-svg ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                    />
                </button>
            </div>
        </div>
    );
}
