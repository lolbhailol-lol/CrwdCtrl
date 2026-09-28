import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Play, Heart, Calendar } from 'lucide-react';
import ContentImage from './ContentImage';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { preloadImages } from '../utils/preloadImages';
import { extractCardTags, formatCardDate, toCardText } from '../utils/cardText';

export default function HeroBanner({
    events = [],
    onEventClick,
    ctaLabel = 'Check Now',
    className = '',
    isDark = true,
    isFavorite,
    onToggleFavorite,
    showSidebar = false,
    isHome = false,
}) {
    const [activeIdx, setActiveIdx] = useState(0);
    const pauseAutoUntilRef = useRef(0);
    const items = events.slice(0, 5);

    useEffect(() => {
        const slice = events.slice(0, 5);
        if (!slice.length) return;
        const urls = slice.slice(0, 3).map((item) => {
            const raw = item.image;
            if (!raw) return null;
            return optimizeImageUrl(getImageUrl(raw) || raw, 'hero');
        });
        preloadImages(urls, { limit: 3 });
    }, [events]);

    const scrollToSlide = useCallback((index) => {
        const clamped = Math.min(Math.max(index, 0), items.length - 1);
        setActiveIdx(clamped);
    }, [items.length]);

    const next = useCallback(() => {
        if (Date.now() < pauseAutoUntilRef.current) return;
        if (items.length <= 1) return;
        setActiveIdx((prev) => (prev + 1) % items.length);
    }, [items.length]);

    const prev = useCallback(() => {
        pauseAutoUntilRef.current = Date.now() + 8000;
        if (items.length <= 1) return;
        setActiveIdx((prev) => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(next, 5000);
        return () => clearInterval(t);
    }, [items.length, next]);

    useEffect(() => {
        setActiveIdx(0);
    }, [events]);

    if (!items.length) return null;

    const safeIdx = Math.min(activeIdx, items.length - 1);
    const active = items[safeIdx];
    if (!active) return null;

    const handleEventClick = (eventItem) => {
        const target = eventItem || active;
        if (target?.id != null) onEventClick?.(target.id);
    };

    // Thumbnails for right sidebar: 3 preview cards
    const sidebarItems = items.filter((_, idx) => idx !== safeIdx).slice(0, 3);
    if (sidebarItems.length < 3 && items.length >= 4) {
        sidebarItems.push(...items.filter((_, idx) => idx === safeIdx).slice(0, 3 - sidebarItems.length));
    }

    const rawTags = extractCardTags(active);
    const activeTags = rawTags
        .map((t) => (typeof t === 'object' ? (t.name || t.label || '') : String(t)))
        .filter((t) => Boolean(t) && t.toLowerCase() !== 'weekend');
    const rawDateText = formatCardDate(active.dateTime || active.date || active.festDate);
    const dateText = (rawDateText && rawDateText.toLowerCase() !== 'weekend' && rawDateText.toLowerCase() !== 'date tba') ? rawDateText : '';
    const locationText = active.city || active.location || active.basedIn || active.subtitle || 'Pune';
    const descriptionText = active.description || active.about || '3 KM of fun, fitness and fierce competition. Are you ready to run?';

    return (
        <div className={`hero-banner-shell w-full my-4 relative ${className}`}>
            <div className="relative rounded-3xl overflow-hidden bg-[#09090b] border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.08)] p-3 sm:p-4 lg:p-5">
                {/* Outer Layout: Main Hero + Side Column */}
                <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[340px] sm:min-h-[380px] lg:min-h-[420px]">
                    
                    {/* Main Featured Banner */}
                    <div
                        className="relative flex-1 rounded-2xl overflow-hidden cursor-pointer group min-h-[300px] sm:min-h-[360px] lg:min-h-[400px] flex flex-col justify-between p-4 sm:p-6 lg:p-8"
                        onClick={() => handleEventClick(active)}
                    >
                        {/* Background Cover Image */}
                        <ContentImage
                            src={active.image}
                            alt={active.title || 'Featured event'}
                            preset="hero"
                            loading="eager"
                            fetchPriority="high"
                            showPlaceholderUntilLoad
                            placeholderClassName="bg-[#09090b]"
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out z-0"
                            onError={(e) => handleImageErrorWithFallback(e, 800, 450, '#09090b', active.title || 'Event')}
                        />
                        
                        {/* Subtle Dark Gradient Overlay — Light & Bright Image */}
                        <div className="pointer-events-none absolute inset-0 z-1 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* Top Row: Clean Date Badge & Heart Favorite (Perfectly Equal Aligned) */}
                        <div className="relative z-10 flex items-center justify-between w-full h-9">
                            {dateText ? (
                                <div className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white/90 text-xs font-semibold shadow-md">
                                    <Calendar size={13} className="text-cyan-400 shrink-0" />
                                    <span>{dateText}</span>
                                </div>
                            ) : <div />}

                            {/* Heart Favorite Button with Hover Cyan Glow */}
                            {onToggleFavorite ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFavorite(active);
                                    }}
                                    className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-xl border border-white/30 hover:bg-black/75 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.5)] flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 shadow-md"
                                >
                                    <Heart size={16} className={isFavorite?.(active.id) ? "fill-rose-500 text-rose-500" : "text-white"} />
                                </button>
                            ) : null}
                        </div>

                        {/* Center Minimal Play Icon (No Glow) */}
                        <div className="relative z-10 flex items-center justify-center my-auto pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                <Play size={20} className="fill-white text-white translate-x-0.5" />
                            </div>
                        </div>

                        {/* Bottom Info Section — Uncluttered & Sleek */}
                        <div className="relative z-10 max-w-2xl text-left space-y-1.5 mt-auto">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-1">
                                {toCardText(active.title || 'Featured Event')}
                            </h2>

                            {/* Tags & Subtitle */}
                            {activeTags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-cyan-400">
                                    <span>{activeTags.join(' • ')}</span>
                                </div>
                            )}

                            {/* Location */}
                            {locationText && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
                                    <MapPin size={13} className="text-cyan-400 shrink-0" />
                                    <span>{locationText}</span>
                                </div>
                            )}

                            {/* Carousel Dots */}
                            {items.length > 1 && (
                                <div className="flex items-center gap-1.5 pt-2">
                                    {items.map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                pauseAutoUntilRef.current = Date.now() + 8000;
                                                scrollToSlide(idx);
                                            }}
                                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                                idx === safeIdx
                                                    ? 'w-6 bg-cyan-400'
                                                    : 'w-1.5 bg-white/40 hover:bg-white/70'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side Column Thumbnails (Desktop) — Only on Home page or when showSidebar is true */}
                    {(showSidebar || isHome) && items.length > 1 && (
                        <div className="hidden lg:flex flex-col justify-between gap-3 w-[240px] xl:w-[260px] shrink-0">
                            {sidebarItems.map((thumbItem) => {
                                const originalIndex = items.findIndex((i) => (i.id || i._id) === (thumbItem.id || thumbItem._id));
                                return (
                                    <div
                                        key={thumbItem.id || thumbItem._id || originalIndex}
                                        onClick={() => {
                                            pauseAutoUntilRef.current = Date.now() + 8000;
                                            scrollToSlide(originalIndex >= 0 ? originalIndex : 0);
                                        }}
                                        className="relative flex-1 rounded-xl overflow-hidden cursor-pointer group/thumb border border-white/10 hover:border-white/30 transition-all duration-300 min-h-[100px]"
                                    >
                                        <ContentImage
                                            src={thumbItem.image}
                                            alt={thumbItem.title}
                                            preset="cardWideFit"
                                            loading="lazy"
                                            className="absolute inset-0 w-full h-full object-cover object-center group-hover/thumb:scale-105 transition-transform duration-500"
                                            onError={(e) => handleImageErrorWithFallback(e, 260, 130, '#09090b', thumbItem.title || 'Event')}
                                        />
                                        <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-transparent transition-colors" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Left/Right Circular Arrow Navigation */}
                {items.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={prev}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 hover:scale-105 transition-all"
                            aria-label="Previous Slide"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/70 hover:scale-105 transition-all"
                            aria-label="Next Slide"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

