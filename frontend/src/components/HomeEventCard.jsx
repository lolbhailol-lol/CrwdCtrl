import ContentImage from './ContentImage';
import CardFavoriteButton from './CardFavoriteButton';
import CardShareButton from './CardShareButton';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { toCardText } from '../utils/cardText';
import { shareContent } from '../utils/externalLink';

const FALLBACK_BG = '#2A2B2E';

function CardCoverImage({
    src,
    alt,
    preset,
    className,
    loading = 'lazy',
    fetchPriority,
    onError,
}) {
    return (
        <ContentImage
            src={src}
            alt={alt}
            preset={preset}
            loading={loading}
            fetchPriority={fetchPriority}
            showPlaceholderUntilLoad
            placeholderClassName="bg-[#E8EAED] dark:bg-[#1A1B1D]"
            className={className}
            onError={onError}
        />
    );
}

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
    loading = 'lazy',
    fetchPriority,
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
                className={`card-surface card-wide rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 min-w-0 ${className}`}
                onClick={onViewDetails}
            >
                <div className="card-wide-image relative">
                    <CardCoverImage
                        src={event.image}
                        alt={event.title}
                        preset="cardWide"
                        loading={loading}
                        fetchPriority={fetchPriority}
                        className="w-full h-full object-cover absolute inset-0"
                        onError={(e) => handleImageErrorWithFallback(
                            e,
                            320,
                            224,
                            FALLBACK_BG,
                            event.title || 'Event',
                        )}
                    />
                    {onToggleFavorite && (
                        <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                    )}
                </div>

                <div className="flex items-start justify-between gap-2 px-4 py-3 min-w-0">
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className={`card-event-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {toCardText(event.title)}
                        </h3>
                        {event.subtitle ? (
                            <p className={`card-event-subtitle ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {toCardText(event.subtitle)}
                            </p>
                        ) : null}
                    </div>
                    <CardShareButton onClick={handleShare} isDark={isDark} className="mt-0.5 shrink-0 card-share-btn--compact" size={18} />
                </div>
            </div>
        );
    }

    const cardRadius = portraitCard || prominentImage ? 'rounded-2xl' : 'rounded-3xl';
    const cardBottomPad = isTrendingCard ? 'pb-5' : prominentImage ? 'pb-2.5' : portraitCard ? '' : 'p-4';
    const titleRowClass = isTrendingCard
        ? 'mt-4 gap-2.5 px-5 min-w-0'
        : prominentImage
        ? 'mt-2 gap-2 px-2.5 min-w-0'
        : portraitCard
        ? 'mt-0 gap-1.5 w-full min-w-0 px-3 pt-2 pb-3'
        : 'mt-3 gap-2 min-w-0';

    const cardWidthClass = portraitCard
        ? 'card-portrait'
        : miniCard
        ? 'card-carousel-sm'
        : 'card-carousel';

    const imagePreset = portraitCard ? 'cardPortrait' : wideCard ? 'cardWide' : heroCard ? 'hero' : 'cardPortrait';

    return (
        <div
            className={`card-surface cursor-pointer overflow-hidden min-w-0 ${cardRadius}
                ${cardWidthClass}
                transition-transform duration-200 active:scale-[0.98]
                ${portraitCard ? 'flex flex-col' : cardBottomPad}
                ${className}`}
            onClick={onViewDetails}
        >
            <div
                className={`relative overflow-hidden shrink-0 ${
                    portraitCard
                        ? 'card-portrait-image w-full'
                        : `w-full ${prominentImage ? '' : 'rounded-2xl'} ${
                            prominentImage
                                ? (heroCard ? 'aspect-2/1' : tallImage ? 'aspect-11/10' : 'aspect-3/2')
                                : (tallImage ? 'aspect-11/10' : 'aspect-4/3')
                        }`
                }`}
            >
                <CardCoverImage
                    src={event.image}
                    alt={event.title}
                    preset={imagePreset}
                    loading={loading}
                    fetchPriority={fetchPriority}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    onError={(e) => handleImageErrorWithFallback(
                        e,
                        portraitCard ? 160 : prominentImage ? (heroCard ? 400 : 300) : 300,
                        portraitCard ? 200 : prominentImage ? (heroCard ? 200 : (tallImage ? 273 : 200)) : 225,
                        FALLBACK_BG,
                        event.title || 'Event',
                    )}
                />
                {onToggleFavorite && (
                    <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                )}
            </div>

            <div className={`flex items-start justify-between ${titleRowClass}`}>
                <div className="min-w-0 flex-1 overflow-hidden pr-1">
                    <h3 className={`card-event-title${isTrendingCard ? ' card-event-title--prominent' : ''} ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        {toCardText(event.title)}
                    </h3>
                    {event.subtitle ? (
                        <p className={`card-event-subtitle ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                            {toCardText(event.subtitle)}
                        </p>
                    ) : null}
                </div>
                <CardShareButton
                    onClick={handleShare}
                    isDark={isDark}
                    className={`mt-0.5 shrink-0${portraitCard || miniCard ? ' card-share-btn--compact' : ''}`}
                    size={portraitCard || miniCard ? 18 : 20}
                />
            </div>
        </div>
    );
}
