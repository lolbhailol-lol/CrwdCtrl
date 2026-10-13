import { MapPin, Calendar, Tag, Activity, Users, Music, Sparkles, Palette, Wand2, Smile } from 'lucide-react';
import ContentImage from './ContentImage';
import CardFavoriteButton from './CardFavoriteButton';
import CardShareButton from './CardShareButton';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { toCardText, formatCardDate, extractRealPrice, extractCardTags, getCardTheme } from '../utils/cardText';
import { shareContent } from '../utils/externalLink';

const FALLBACK_BG = '#070A14';

function TagIcon({ type }) {
    switch (type) {
        case 'sports': return <Activity size={12} />;
        case 'community': return <Users size={12} />;
        case 'music': return <Music size={12} />;
        case 'cultural': return <Sparkles size={12} />;
        case 'workshop': return <Palette size={12} />;
        case 'creative': return <Wand2 size={12} />;
        case 'comedy': return <Smile size={12} />;
        default: return <Sparkles size={12} />;
    }
}

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
            placeholderClassName="bg-[#0D1222] dark:bg-[#1A1B1D]"
            className={className}
            onError={onError}
        />
    );
}

export default function HomeEventCard({
    event,
    isDark = true,
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
    const handleShare = (e) => {
        e.stopPropagation();
        const url = shareUrl || `${window.location.origin}/view-details/${event?.id}`;
        shareContent({
            title: event?.title || 'Event',
            text: `Check out ${event?.title || 'Event'}`,
            url,
        });
    };

    const handleFav = (e) => {
        e.stopPropagation();
        onToggleFavorite?.();
    };

    if (!event) return null;

    const isCommunityCard = Boolean(
        event.isCommunity === true ||
        event.isClub === true ||
        event._type === 'community' ||
        event.type === 'community' ||
        event._type === 'club' ||
        event.type === 'club' ||
        event._type === 'runclub' ||
        event.type === 'runclub' ||
        event.section === 'communities' ||
        event._section === 'communities' ||
        event.sectionSlug === 'communities' ||
        (event.category?.toLowerCase() === 'community' && !event.festDate && !event.date && !event.dateTime)
    );

    // Helper to check if string is a city/location
    const isLocationString = (str) => {
        if (!str || typeof str !== 'string') return false;
        const s = str.trim().toLowerCase();
        const city = (event.city || '').trim().toLowerCase();
        const loc = (event.location || '').trim().toLowerCase();
        const based = (event.basedIn || '').trim().toLowerCase();
        return s === city || s === loc || s === based || ['pune', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'nigdi', 'kalyani nagar'].includes(s);
    };

    const theme = getCardTheme(event);
    const tags = extractCardTags(event);
    const realDate = formatCardDate(event);
    const displayDate = realDate || event.festDate || event.date || event.dateTime || (isCommunityCard ? 'Community' : '27 Sep 2025');
    const realPrice = extractRealPrice(event);
    const locationText = (
        (event.basedIn && !isLocationString(event.basedIn) ? event.basedIn : null) ||
        (event.subtitle && !isLocationString(event.subtitle) ? event.subtitle : null) ||
        event.city ||
        event.location ||
        event.basedIn ||
        'Pune'
    );

    if (isCommunityCard) {
        return (
            <div
                className={`group cursor-pointer overflow-hidden rounded-[1.25rem] border border-white/15 hover:border-white/30 bg-[#09090b] transition-all duration-300 relative flex flex-col min-w-0 w-[150px] sm:w-[170px] lg:w-[185px] shrink-0 shadow-lg ${className}`}
                onClick={onViewDetails}
            >
                {/* Full Poster Cover Image Container */}
                <div className="relative w-full aspect-[3/4.2] overflow-hidden rounded-[1.25rem] bg-[#0d0d10]">
                    <CardCoverImage
                        src={event.image}
                        alt={event.title}
                        preset="cardWideFit"
                        loading={loading}
                        fetchPriority={fetchPriority}
                        className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                        onError={(e) => handleImageErrorWithFallback(e, 200, 260, '#0d0d10', event.title || 'Community')}
                    />

                    {/* Dark Vignette Overlay for Text Legibility */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-1" />

                    {/* Top Right Favorite Button */}
                    {onToggleFavorite && (
                        <div className="absolute top-2.5 right-2.5 z-10">
                            <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                        </div>
                    )}

                    {/* Bottom Overlay Info (Directly on top of Image) */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-10 flex flex-col gap-0.5 text-white">
                        <div className="flex items-center justify-between gap-1.5">
                            <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1 group-hover:text-cyan-400 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                {toCardText(event.title)}
                            </h3>
                            <CardShareButton
                                onClick={handleShare}
                                isDark={true}
                                className="shrink-0 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md border border-white/20 hover:border-cyan-400 flex items-center justify-center text-white transition-all hover:scale-105"
                                size={13}
                            />
                        </div>
                        {locationText && (
                            <p className="text-[11px] text-gray-300/90 font-medium line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                                {locationText}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const isWeekendWideCard = wideCard && !heroCard;
    if (isWeekendWideCard) {
        return (
            <div
                className={`card-surface card-wide rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 min-w-0 ${className}`}
                onClick={onViewDetails}
            >
                <div className={`card-wide-image relative ${isDark ? 'bg-[#0B0C0D]' : 'bg-[#E8EAED]'}`}>
                    <CardCoverImage
                        src={event.image}
                        alt={event.title}
                        preset="cardWideFit"
                        loading={loading}
                        fetchPriority={fetchPriority}
                        className="w-full h-full object-contain object-center absolute inset-0"
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
                        {event.subtitle && toCardText(event.subtitle).toLowerCase() !== toCardText(event.title).toLowerCase() ? (
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

    const isTrendingCard = prominentImage && tallImage && !wideCard && !miniCard && !portraitCard && !heroCard;
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
        : wideCard
        ? 'card-carousel-wide'
        : 'card-carousel';

    const imagePreset = portraitCard
        ? 'cardPortraitFit'
        : wideCard
            ? 'cardWideFit'
            : heroCard
                ? 'hero'
                : tallImage
                    ? 'cardTrending'
                    : 'cardWideFit';

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
                className={`relative overflow-hidden shrink-0 ${isDark ? 'bg-[#0B0C0D]' : 'bg-[#E8EAED]'} ${
                    portraitCard
                        ? 'card-portrait-image w-full'
                        : `w-full ${prominentImage ? '' : 'rounded-2xl'} ${
                            heroCard
                                ? 'aspect-2/1'
                                : tallImage
                                    ? 'aspect-11/10'
                                    : prominentImage
                                        ? 'aspect-3/2'
                                        : 'aspect-4/3'
                        }`
                }`}
            >
                <CardCoverImage
                    src={event.image}
                    alt={event.title}
                    preset={imagePreset}
                    loading={loading}
                    fetchPriority={fetchPriority}
                    className="absolute inset-0 z-0 h-full w-full object-contain object-center pointer-events-none"
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
                    {event.subtitle && toCardText(event.subtitle).toLowerCase() !== toCardText(event.title).toLowerCase() ? (
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
