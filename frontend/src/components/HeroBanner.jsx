import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import ContentImage from './ContentImage';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

export default function HeroBanner({
    events = [],
    onEventClick,
    ctaLabel = 'Check Now',
    className = '',
}) {
    const [activeIdx, setActiveIdx] = useState(0);
    const scrollRef = useRef(null);
    const pauseAutoUntilRef = useRef(0);
    const items = events.slice(0, 5);

    const syncActiveFromScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || el.clientWidth <= 0) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setActiveIdx(Math.min(Math.max(idx, 0), items.length - 1));
    }, [items.length]);

    const scrollToSlide = useCallback((index, behavior = 'smooth') => {
        const el = scrollRef.current;
        if (!el) return;
        const clamped = Math.min(Math.max(index, 0), items.length - 1);
        el.scrollTo({ left: clamped * el.clientWidth, behavior });
        setActiveIdx(clamped);
    }, [items.length]);

    const next = useCallback(() => {
        if (Date.now() < pauseAutoUntilRef.current) return;
        const el = scrollRef.current;
        if (!el || items.length <= 1) return;
        const current = Math.round(el.scrollLeft / el.clientWidth);
        scrollToSlide((current + 1) % items.length);
    }, [items.length, scrollToSlide]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(next, 4000);
        return () => clearInterval(t);
    }, [items.length, next]);

    useEffect(() => {
        setActiveIdx(0);
        const el = scrollRef.current;
        if (el) el.scrollLeft = 0;
    }, [events]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return undefined;

        const onScroll = () => {
            pauseAutoUntilRef.current = Date.now() + 8000;
            syncActiveFromScroll();
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [syncActiveFromScroll, items.length]);

    if (!items.length) return null;

    const active = items[activeIdx];

    const handleCta = (e) => {
        e.stopPropagation();
        onEventClick?.(active.id);
    };

    const handleEventClick = () => {
        if (active?.id != null) onEventClick?.(active.id);
    };

    return (
        <div className={`hero-banner-shell ${className}`}>
            <div className="hero-banner-viewport relative rounded-2xl lg:rounded-3xl overflow-hidden hero-banner-height lg:h-70 shadow-md">
                <div
                    ref={scrollRef}
                    className="hero-banner-track scrollbar-hide"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {items.map((item, i) => (
                        <div key={item.id ?? i} className="hero-banner-slide">
                            <ContentImage
                                src={item.image}
                                alt={item.title || 'Featured event'}
                                preset="hero"
                                loading={i === 0 ? 'eager' : 'lazy'}
                                fetchPriority={i === 0 ? 'high' : 'auto'}
                                width={560}
                                height={280}
                                className="hero-banner-image z-0 pointer-events-none"
                                onError={(e) => handleImageErrorWithFallback(e, 560, 280, '#0ECCEE', item.title || 'Event')}
                            />
                        </div>
                    ))}
                </div>

                {/* Soft bottom gradient for title legibility */}
                <div className="pointer-events-none absolute inset-0 z-1 bg-linear-to-t from-black/55 via-black/10 to-transparent" />

                {/* Interactive layer — above image so taps register on iOS */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                    <button
                        type="button"
                        onClick={handleCta}
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        className="hero-banner-cta pointer-events-auto absolute top-3 right-3"
                    >
                        <span className="hero-banner-cta__label">{ctaLabel}</span>
                        <span className="hero-banner-cta__icon" aria-hidden>
                            <ArrowUpRight size={12} strokeWidth={2.25} />
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleEventClick}
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        className={`pointer-events-auto absolute left-3 max-w-[55%] text-left sm:max-w-[50%] ${items.length > 1 ? 'bottom-7' : 'bottom-2'}`}
                    >
                        <h2 className="text-fluid-lg font-bold leading-snug text-white drop-shadow-md line-clamp-2">
                            {active.title}
                        </h2>
                        {active.dateTime && active.dateTime !== 'Date TBA' && (
                            <p className="mt-0.5 line-clamp-1 text-fluid-2xs text-white/70">
                                {active.dateTime}
                            </p>
                        )}
                    </button>

                    {items.length > 1 && (
                        <div className="pointer-events-auto absolute bottom-2.5 left-0 right-0 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
                                {items.map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pauseAutoUntilRef.current = Date.now() + 8000;
                                            scrollToSlide(i);
                                        }}
                                        aria-label={`Go to slide ${i + 1}`}
                                        aria-current={i === activeIdx ? 'true' : undefined}
                                        style={{ touchAction: 'manipulation' }}
                                        className={`shrink-0 rounded-full transition-all duration-300 ${
                                            i === activeIdx
                                                ? 'h-1.5 w-5 bg-white'
                                                : 'h-1.5 w-1.5 border border-white bg-transparent'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
