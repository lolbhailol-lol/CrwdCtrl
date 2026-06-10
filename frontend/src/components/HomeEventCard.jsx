import ContentImage from './ContentImage';
import CardFavoriteButton from './CardFavoriteButton';
import CardShareButton from './CardShareButton';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { toCardText } from '../utils/cardText';

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
            className={`card-surface cursor-pointer overflow-hidden ${cardRadius}
                ${wideCard ? 'card-carousel-wide' : 'card-carousel'}
                transition-transform duration-200 active:scale-[0.98]
                ${cardBottomPad}
                ${className}`}
            onClick={onViewDetails}
        >
            {/* Carousel cards: image flush to top + sides; others keep inset */}
            <div
                className={`relative w-full overflow-hidden ${
                    prominentImage
                        ? (tallImage ? 'aspect-[11/10]' : 'aspect-[3/2]')
                        : (tallImage ? 'aspect-[11/10]' : 'aspect-[4/3]')
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
                        prominentImage ? (wideCard ? 267 : (tallImage ? 273 : 200)) : 225,
                        '#6366f1',
                        event.title || 'Event',
                    )}
                />
                {onToggleFavorite && (
                    <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                )}
            </div>

            {/* Title + share */}
            <div className={`flex items-center justify-between ${titleRowClass}`}>
                <div className="min-w-0 flex-1">
                    <h3 className={`card-event-title line-clamp-1${isTrendingCard ? ' card-event-title--prominent' : ''} ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        {toCardText(event.title)}
                    </h3>
                    {event.subtitle && (
                        <p className={`card-event-subtitle line-clamp-1 ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                            {toCardText(event.subtitle)}
                        </p>
                    )}
                </div>
                <CardShareButton onClick={handleShare} isDark={isDark} />
            </div>
        </div>
    );
}
