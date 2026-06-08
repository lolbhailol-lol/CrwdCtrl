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
    tallImage = false,
    wideCard = false,
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

    const isTrendingCard = prominentImage && tallImage && !wideCard;
    const cardRadius = prominentImage ? 'rounded-2xl' : 'rounded-3xl';
    const cardBottomPad = isTrendingCard ? 'pb-5' : prominentImage ? 'pb-2.5' : 'p-4';
    const titleRowClass = isTrendingCard
        ? 'mt-4 gap-3.5 px-5'
        : prominentImage
        ? 'mt-2 gap-2 px-2.5'
        : 'mt-3 gap-3';

    return (
        <div
            className={`cursor-pointer overflow-hidden ${cardRadius}
                ${wideCard ? 'card-carousel-wide' : 'card-carousel'}
                transition-transform duration-200 active:scale-[0.98]
                ${cardBottomPad}
                ${isDark ? (prominentImage ? 'bg-black' : 'bg-[#1a1b1e]') : 'bg-[#F2F4F7]'}
                ${className}`}
            onClick={onViewDetails}
        >
            {/* Carousel cards: image flush to top + sides; others keep inset */}
            <div
                className={`relative w-full overflow-hidden ${
                    prominentImage
                        ? (tallImage ? 'aspect-[5/4]' : 'aspect-[3/2]')
                        : (tallImage ? 'aspect-[5/4]' : 'aspect-[4/3]')
                } ${prominentImage ? '' : 'rounded-2xl'}`}
            >
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset="card"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    onError={(e) => handleImageErrorWithFallback(
                        e,
                        prominentImage ? (wideCard ? 400 : 300) : 300,
                        prominentImage ? (wideCard ? 267 : (tallImage ? 240 : 200)) : 225,
                        '#6366f1',
                        event.title || 'Event',
                    )}
                />
                {onToggleFavorite && (
                    <button
                        type="button"
                        onClick={handleFav}
                        className={`card-icon-btn absolute right-2 top-2 rounded-full
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
            <div className={`flex items-center justify-between ${titleRowClass}`}>
                <div className="min-w-0 flex-1">
                    <h3 className={`text-fluid-base leading-tight line-clamp-1
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title}
                    </h3>
                    {event.subtitle && (
                        <p className={`mt-1 text-xs leading-tight line-clamp-1
                            ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {event.subtitle}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleShare}
                    className={`card-icon-btn shrink-0 rounded-full active:opacity-80
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
