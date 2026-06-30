import ContentImage from './ContentImage';
import CardFavoriteButton from './CardFavoriteButton';
import CardShareButton from './CardShareButton';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { toCardText } from '../utils/cardText';
import { shareContent } from '../utils/externalLink';

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
    miniCard = false,
    portraitCard = false,
    heroCard = false,
}) {
    const isWeekendWideCard = wideCard && !heroCard;
    const isTrendingCard = prominentImage && tallImage && !wideCard && !miniCard && !portraitCard && !heroCard;

    const handleShare = (e) => {
        e.stopPropagation();
        const url = shareUrl || `${window.location.origin}/view-details/${event.id}`;
        shareContent({
            title: event.title,
            text: `Check out ${event.title}`,
            url,
        });
    };

    const handleFav = (e) => {
        e.stopPropagation();
        onToggleFavorite?.();
    };

    if (isWeekendWideCard) {
        return (
            <div
                className={`card-surface card-wide rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 ${className}`}
                onClick={onViewDetails}
            >
                <div className="card-wide-image">
                    <ContentImage
                        src={event.image}
                        alt={event.title}
                        preset="cardWide"
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(
                            e,
                            320,
                            224,
                            '#6366f1',
                            event.title || 'Event',
                        )}
                    />
                    {onToggleFavorite && (
                        <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                    )}
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                        <h3 className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {toCardText(event.title)}
                        </h3>
                        {event.subtitle && (
                            <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {toCardText(event.subtitle)}
                            </p>
                        )}
                    </div>
                    <CardShareButton onClick={handleShare} isDark={isDark} className="ml-3 shrink-0" />
                </div>
            </div>
        );
    }

    const cardRadius = portraitCard || prominentImage ? 'rounded-2xl' : 'rounded-3xl';
    const cardBottomPad = isTrendingCard ? 'pb-5' : prominentImage ? 'pb-2.5' : portraitCard ? '' : 'p-4';
    const titleRowClass = isTrendingCard
        ? 'mt-4 gap-3.5 px-5'
        : prominentImage
        ? 'mt-2 gap-2 px-2.5'
        : portraitCard
        ? 'mt-2 gap-2 w-full min-w-0 max-w-(--card-portrait-w)'
        : 'mt-3 gap-3';

    const cardWidthClass = portraitCard
        ? 'card-portrait'
        : miniCard
        ? 'card-carousel-sm'
        : 'card-carousel';

    return (
        <div
            className={`card-surface cursor-pointer overflow-hidden ${cardRadius}
                ${cardWidthClass}
                transition-transform duration-200 active:scale-[0.98]
                ${portraitCard ? 'flex flex-col' : cardBottomPad}
                ${className}`}
            onClick={onViewDetails}
        >
            <div
                className={`relative overflow-hidden ${
                    portraitCard
                        ? 'card-portrait-image w-full'
                        : `w-full ${prominentImage ? '' : 'rounded-2xl'} ${
                            prominentImage
                                ? (heroCard ? 'aspect-2/1' : tallImage ? 'aspect-11/10' : 'aspect-3/2')
                                : (tallImage ? 'aspect-11/10' : 'aspect-4/3')
                        }`
                }`}
            >
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset={portraitCard ? 'cardPortrait' : wideCard ? 'cardWide' : heroCard ? 'hero' : 'cardPortrait'}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    onError={(e) => handleImageErrorWithFallback(
                        e,
                        portraitCard ? 160 : prominentImage ? (heroCard ? 400 : 300) : 300,
                        portraitCard ? 200 : prominentImage ? (heroCard ? 200 : (tallImage ? 273 : 200)) : 225,
                        '#6366f1',
                        event.title || 'Event',
                    )}
                />
                {onToggleFavorite && (
                    <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                )}
            </div>

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
