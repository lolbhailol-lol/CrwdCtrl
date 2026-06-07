import { useState, useEffect, useCallback } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

export default function HeroBanner({ events = [], onEventClick, isDark = false }) {
    const [activeIdx, setActiveIdx] = useState(0);
    const items = events.slice(0, 5);

    const next = useCallback(() => {
        setActiveIdx(i => (i + 1) % items.length);
    }, [items.length]);

    useEffect(() => {
        if (items.length <= 1) return;
        const t = setInterval(next, 3500);
        return () => clearInterval(t);
    }, [items.length, next]);

    if (!items.length) return null;

    const active = items[activeIdx];

    return (
        <div className="px-4 mb-6">
            <div
                className={`relative rounded-2xl overflow-hidden h-52 sm:h-60 cursor-pointer select-none shadow-sm ${isDark ? 'bg-[#161718]' : 'bg-white'}`}
                onClick={() => onEventClick?.(active.id)}
            >
                {/* Background image */}
                <img
                    src={getImageUrl(active.image)}
                    alt={active.title}
                    className="w-full h-full object-cover transition-opacity duration-700"
                    onError={(e) => handleImageErrorWithFallback(e, 400, 208, '#0ECCEE', active.title || 'Event')}
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/10" />

                {/* Text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-widest drop-shadow-2xl uppercase">
                        {active.status === 'upcoming' ? 'COMING SOON' : active.title}
                    </h2>
                    {active.subtitle && (
                        <p className="text-xs text-gray-300 mt-2 max-w-xs">{active.subtitle}</p>
                    )}
                    {active.dateTime && active.dateTime !== 'Date TBA' && (
                        <p className="text-xs text-[#0ECCEE] mt-1 font-medium">{active.dateTime}</p>
                    )}
                </div>

                {/* Pagination dots — inside card at bottom */}
                {items.length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                        {items.map((_, i) => (
                            <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                                className={`rounded-full transition-all duration-300 ${
                                    i === activeIdx
                                        ? 'w-5 h-2 bg-white'
                                        : 'w-2 h-2 bg-white/40'
                                }`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
