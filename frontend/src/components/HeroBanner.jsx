import { useState, useEffect, useCallback } from 'react';
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
    const items = events.slice(0, 5);

    const next = useCallback(() => {
        setActiveIdx((i) => (i + 1) % items.length);
    }, [items.length]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(next, 4000);
        return () => clearInterval(t);
    }, [items.length, next]);

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
        <div className={`px-6 mb-6 lg:px-12 ${className}`}>
            <div className="relative rounded-2xl lg:rounded-3xl overflow-hidden h-48 sm:h-56 lg:h-64 shadow-md">
                <ContentImage
                    src={active.image}
                    alt={active.title || 'Featured event'}
                    preset="hero"
                    loading="eager"
                    fetchPriority="high"
                    className="absolute inset-0 z-0 h-full w-full object-cover pointer-events-none transition-opacity duration-500"
                    onError={(e) => handleImageErrorWithFallback(e, 400, 288, '#0ECCEE', active.title || 'Event')}
                />

                {/* Soft bottom gradient for title legibility */}
                <div className="pointer-events-none absolute inset-0 z-1 bg-linear-to-t from-black/55 via-black/10 to-transparent" />

                {/* Interactive layer — above image so taps register on iOS */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                    <button
                        type="button"
                        onClick={handleCta}
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        className="pointer-events-auto absolute top-3 right-3 inline-flex min-h-8 items-center gap-1 rounded-full bg-white py-1 pl-2.5 pr-2 text-[11px] font-semibold text-black shadow-md transition-transform hover:bg-white/95 active:scale-[0.98]"
                    >
                        {ctaLabel}
                        <ArrowUpRight size={12} strokeWidth={2.5} />
                    </button>

                    <button
                        type="button"
                        onClick={handleEventClick}
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        className={`pointer-events-auto absolute left-3 max-w-[55%] text-left sm:max-w-[50%] ${items.length > 1 ? 'bottom-7' : 'bottom-2'}`}
                    >
                        <h2 className="text-base font-bold leading-snug text-white drop-shadow-md line-clamp-2 sm:text-lg">
                            {active.title}
                        </h2>
                        {active.subtitle && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-white/85 drop-shadow">
                                {active.subtitle}
                            </p>
                        )}
                        {active.dateTime && active.dateTime !== 'Date TBA' && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-white/70">
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
                                        onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                                        aria-label={`Go to slide ${i + 1}`}
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
