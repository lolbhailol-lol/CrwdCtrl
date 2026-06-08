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

    return (
        <div className={`px-4 mb-6 lg:px-10 ${className}`}>
            <div className="relative rounded-2xl lg:rounded-3xl overflow-hidden h-56 sm:h-64 lg:h-72 select-none shadow-md">
                <ContentImage
                    src={active.image}
                    alt={active.title || 'Featured event'}
                    preset="hero"
                    loading="eager"
                    fetchPriority="high"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                    onError={(e) => handleImageErrorWithFallback(e, 400, 288, '#0ECCEE', active.title || 'Event')}
                />

                {/* Soft bottom gradient for title legibility */}
                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

                {/* Check Now — top right, compact */}
                <button
                    type="button"
                    onClick={handleCta}
                    className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 bg-white text-black text-[11px] font-semibold pl-2.5 pr-2 py-1 rounded-full shadow-md hover:bg-white/95 active:scale-[0.98] transition-transform"
                >
                    {ctaLabel}
                    <ArrowUpRight size={12} strokeWidth={2.5} />
                </button>

                {/* Event info — bottom-left corner */}
                <button
                    type="button"
                    onClick={() => onEventClick?.(active.id)}
                    className={`absolute left-3 z-10 text-left max-w-[55%] sm:max-w-[50%] ${items.length > 1 ? 'bottom-7' : 'bottom-2'}`}
                >
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug drop-shadow-md line-clamp-2">
                        {active.title}
                    </h2>
                    {active.subtitle && (
                        <p className="text-[11px] text-white/85 mt-0.5 line-clamp-1 drop-shadow">
                            {active.subtitle}
                        </p>
                    )}
                    {active.dateTime && active.dateTime !== 'Date TBA' && (
                        <p className="text-[10px] text-white/70 mt-0.5 line-clamp-1">
                            {active.dateTime}
                        </p>
                    )}
                </button>

                {/* Carousel dots — bottom center */}
                {items.length > 1 && (
                    <div className="absolute bottom-2.5 left-0 right-0 flex justify-center z-10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/35 backdrop-blur-sm">
                            {items.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                                    aria-label={`Go to slide ${i + 1}`}
                                    className={`rounded-full transition-all duration-300 shrink-0 ${
                                        i === activeIdx
                                            ? 'w-5 h-1.5 bg-white'
                                            : 'w-1.5 h-1.5 border border-white bg-transparent'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
