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
            placeholderClassName="bg-[#0D1222]"
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
    tallImage = false,
    wideCard = false,
    miniCard = false,
    portraitCard = false,
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

    // Tagline should be explicit event tagline/subtitle from backend, NEVER location or hardcoded fallback
    const tagline = (event.tagline && !isLocationString(event.tagline) ? event.tagline : null) ||
        (event.subtitle && !isLocationString(event.subtitle) ? event.subtitle : null);

    const description = event.description || event.about || (
        theme === 'blue' ? '3 KM of fun, fitness and fierce competition.' :
        theme === 'pink' ? 'A celebration of music and culture.' :
        theme === 'teal' ? 'Turn simple materials into a work of art.' :
        'Join us for an unforgettable community experience.'
    );

    const communityName = (
        (event.communityName && !isLocationString(event.communityName) ? event.communityName : null) ||
        (typeof event.communityId === 'object' && event.communityId?.name) ||
        (event.clubName && !isLocationString(event.clubName) ? event.clubName : null) ||
        (typeof event.runClubId === 'object' && event.runClubId?.name) ||
        (typeof event.club === 'object' && event.club?.name) ||
        (typeof event.organizer === 'object' && event.organizer?.name) ||
        (typeof event.organizerId === 'object' && event.organizerId?.name) ||
        (event.organizerName && !isLocationString(event.organizerName) ? event.organizerName : null) ||
        (event.hostedBy && !isLocationString(event.hostedBy) ? event.hostedBy : null) ||
        (event.by && !isLocationString(event.by) ? event.by : null) ||
        (event.collegeName && !isLocationString(event.collegeName) ? event.collegeName : null) ||
        (event.category ? `${event.category} Community` : null) ||
        (theme === 'blue' ? 'CrwdCtrl Athletics' :
         theme === 'pink' ? 'Vibe Culture Club' :
         theme === 'teal' ? 'Artisans Collective' :
         'CrwdCtrl Community')
    );

    const themeStyles = {
        blue: {
            border: isDark ? 'border-blue-500/50 hover:border-cyan-400 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'border-blue-300 hover:border-blue-500 shadow-md',
            tag1: isDark ? 'bg-blue-600/50 border-blue-400/30 text-blue-100' : 'bg-blue-100 border-blue-200 text-blue-800',
            priceBg: isDark ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700 font-semibold',
            gradient: 'from-[#0E1528] via-[#090E1B] to-[#070A14]',
        },
        pink: {
            border: isDark ? 'border-pink-500/50 hover:border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.25)] hover:shadow-[0_0_30px_rgba(236,72,153,0.4)]' : 'border-pink-300 hover:border-pink-500 shadow-md',
            tag1: isDark ? 'bg-pink-600/50 border-pink-400/30 text-pink-100' : 'bg-pink-100 border-pink-200 text-pink-800',
            priceBg: isDark ? 'bg-pink-500/20 border-pink-400/40 text-pink-300' : 'bg-pink-50 border-pink-200 text-pink-700 font-semibold',
            gradient: 'from-[#230C20] via-[#0D091B] to-[#070A14]',
        },
        teal: {
            border: isDark ? 'border-teal-500/50 hover:border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.25)] hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]' : 'border-teal-300 hover:border-teal-500 shadow-md',
            tag1: isDark ? 'bg-teal-600/50 border-teal-400/30 text-teal-100' : 'bg-teal-100 border-teal-200 text-teal-800',
            priceBg: isDark ? 'bg-teal-500/20 border-teal-400/40 text-teal-300' : 'bg-teal-50 border-teal-200 text-teal-700 font-semibold',
            gradient: 'from-[#0A1F1D] via-[#08121B] to-[#070A14]',
        },
        cyan: {
            border: isDark ? 'border-cyan-500/50 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'border-cyan-300 hover:border-cyan-500 shadow-md',
            tag1: isDark ? 'bg-cyan-600/50 border-cyan-400/30 text-cyan-100' : 'bg-cyan-100 border-cyan-200 text-cyan-800',
            priceBg: isDark ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700 font-semibold',
            gradient: 'from-[#0B1A28] via-[#080E1B] to-[#070A14]',
        },
    }[theme] || {
        border: isDark ? 'border-cyan-500/50 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]' : 'border-cyan-300 hover:border-cyan-500 shadow-md',
        tag1: isDark ? 'bg-cyan-600/50 border-cyan-400/30 text-cyan-100' : 'bg-cyan-100 border-cyan-200 text-cyan-800',
        priceBg: isDark ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700 font-semibold',
        gradient: 'from-[#0B1A28] via-[#080E1B] to-[#070A14]',
    };

    const cardWidthClass = portraitCard
        ? 'card-portrait'
        : miniCard
        ? 'card-carousel-sm'
        : wideCard
        ? 'card-carousel-wide'
        : 'card-carousel';

    return (
        <div
            className={`card-surface group cursor-pointer overflow-hidden rounded-[1.75rem] border ${themeStyles.border} transition-all duration-300 relative bg-transparent flex flex-col min-w-0 ${cardWidthClass} ${className}`}
            onClick={onViewDetails}
        >
            {/* Full Poster Image Container */}
            <div className="relative w-full aspect-[4/4.8] overflow-hidden shrink-0 bg-[#090E1B]/80 rounded-[1.75rem]">
                <CardCoverImage
                    src={event.image}
                    alt={event.title}
                    preset={tallImage ? 'cardTrending' : 'cardWideFit'}
                    loading={loading}
                    fetchPriority={fetchPriority}
                    className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-108 transition-transform duration-700 pointer-events-none z-0 brightness-[1.06] contrast-[1.02]"
                    onError={(e) => handleImageErrorWithFallback(
                        e,
                        320,
                        360,
                        FALLBACK_BG,
                        event.title || 'Event',
                    )}
                />

                {/* Top Vignette Overlay */}
                <div className="pointer-events-none absolute top-0 inset-x-0 h-24 z-1 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />

                {/* Bottom Vignette Overlay */}
                <div className="pointer-events-none absolute bottom-0 inset-x-0 h-44 z-1 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                {/* Top Bar: Right Favorite Heart */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between h-9 pointer-events-none">
                    {displayDate ? (
                        <div className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-black/45 backdrop-blur-xl border border-white/30 text-white text-xs font-bold tracking-wide shadow-xl pointer-events-auto">
                            {isCommunityCard ? <Users size={13} className="text-cyan-400 shrink-0" /> : <Calendar size={13} className="text-cyan-400 shrink-0" />}
                            <span>{displayDate}</span>
                        </div>
                    ) : <div />}

                    {/* Top-Right Favorite Heart */}
                    {onToggleFavorite && (
                        <div className="pointer-events-auto">
                            <CardFavoriteButton isFavorite={isFavorite} onClick={handleFav} />
                        </div>
                    )}
                </div>

                {/* Bottom Overlay: Title, Tagline, Description & Community Name */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex items-end justify-between gap-3 text-white">
                    <div className="flex flex-col min-w-0 space-y-0.5">
                        <h3 className="font-extrabold text-white text-lg sm:text-xl leading-snug line-clamp-1 group-hover:text-cyan-300 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                            {toCardText(event.title)}
                        </h3>

                        {tagline && (
                            <p className="text-xs text-cyan-200 font-semibold line-clamp-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                                {tagline}
                            </p>
                        )}
                        {description && description !== tagline && (
                            <p className="text-[11px] text-gray-300 line-clamp-1 opacity-90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                                {description}
                            </p>
                        )}

                        {/* Community Name in place of Location */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium pt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                            <Users size={13} className="text-cyan-400 shrink-0" />
                            <span className="truncate">{communityName}</span>
                        </div>
                    </div>

                    {/* Bottom-Right Share Button */}
                    <CardShareButton
                        onClick={handleShare}
                        isDark={true}
                        className="shrink-0 w-9 h-9 rounded-full bg-black/45 backdrop-blur-xl border border-white/30 hover:bg-black/75 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.5)] flex items-center justify-center text-white transition-all shadow-xl hover:scale-110 active:scale-95"
                        size={15}
                    />
                </div>
            </div>
        </div>
    );
}
