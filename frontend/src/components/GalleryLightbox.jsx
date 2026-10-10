import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

export default function GalleryLightbox({
    images = [],
    index = 0,
    name = 'Gallery',
    onClose,
    onIndexChange,
}) {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    const count = list.length;
    const safeIndex = Math.max(0, Math.min(index, count - 1));
    const current = list[safeIndex];

    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const goPrev = useCallback(() => {
        if (count <= 1) return;
        const prev = safeIndex === 0 ? count - 1 : safeIndex - 1;
        onIndexChange?.(prev);
    }, [count, safeIndex, onIndexChange]);

    const goNext = useCallback(() => {
        if (count <= 1) return;
        const next = safeIndex === count - 1 ? 0 : safeIndex + 1;
        onIndexChange?.(next);
    }, [count, safeIndex, onIndexChange]);

    // Keyboard navigation (Arrow keys & Escape)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goPrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goPrev, goNext, onClose]);

    // Lock body scroll while open
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    // Touch swipe handlers
    const handleTouchStart = (e) => {
        touchStartX.current = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e) => {
        touchEndX.current = e.changedTouches[0].screenX;
        const diff = touchStartX.current - touchEndX.current;
        if (Math.abs(diff) > 45) {
            if (diff > 0) {
                goNext(); // swiped left -> show next
            } else {
                goPrev(); // swiped right -> show prev
            }
        }
    };

    if (!current || count === 0 || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-100060 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={`${name} Gallery viewer`}
            onClick={onClose}
        >
            {/* Header bar: Title, Counter, and Close */}
            <div
                className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 z-20 shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <p className="text-white text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md">
                        {name}
                    </p>
                    <span className="shrink-0 text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-semibold border border-white/10 tabular-nums">
                        {safeIndex + 1} / {count}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close gallery"
                    className="size-10 sm:size-11 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg shrink-0"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Center Area: Main Image with Floating Left/Right Arrow Buttons */}
            <div
                className="relative flex-1 flex items-center justify-center px-3 sm:px-14 min-h-0 w-full"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Floating Previous Arrow Button */}
                {count > 1 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            goPrev();
                        }}
                        aria-label="Previous image"
                        className="absolute left-2.5 sm:left-6 z-20 size-11 sm:size-13 rounded-full bg-black/60 sm:bg-white/15 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-2xl hover:scale-105"
                    >
                        <ChevronLeft size={26} strokeWidth={2.5} />
                    </button>
                )}

                {/* Main Active Image - Scaled nicely so it doesn't look overly huge */}
                <div
                    className="relative max-h-[70vh] sm:max-h-[76vh] max-w-[92vw] sm:max-w-[80vw] md:max-w-[70vw] flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-neutral-900/60"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img
                        key={safeIndex}
                        src={getImageUrl(current, { preset: 'detail' })}
                        alt={`${name} photo ${safeIndex + 1}`}
                        className="max-h-[70vh] sm:max-h-[76vh] max-w-[92vw] sm:max-w-[80vw] md:max-w-[70vw] object-contain rounded-2xl transition-transform duration-200"
                        onError={(e) => handleImageErrorWithFallback(e, 800, 600, '#1A1B1D', name)}
                    />
                </div>

                {/* Floating Next Arrow Button */}
                {count > 1 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            goNext();
                        }}
                        aria-label="Next image"
                        className="absolute right-2.5 sm:right-6 z-20 size-11 sm:size-13 rounded-full bg-black/60 sm:bg-white/15 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-2xl hover:scale-105"
                    >
                        <ChevronRight size={26} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* Bottom: Thumbnail Strip for quick jumping */}
            {count > 1 ? (
                <div
                    className="w-full px-4 py-3 sm:py-4 z-20 shrink-0 flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-2 max-w-full overflow-x-auto scrollbar-hide py-1 px-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10">
                        {list.map((img, idx) => {
                            const isActive = idx === safeIndex;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onIndexChange?.(idx)}
                                    aria-label={`Jump to photo ${idx + 1}`}
                                    className={`relative size-12 sm:size-14 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer ${
                                        isActive
                                            ? 'ring-2 ring-[#0ECCEE] scale-105 shadow-md shadow-[#0ECCEE]/30 opacity-100'
                                            : 'opacity-50 hover:opacity-85 border border-white/10'
                                    }`}
                                >
                                    <img
                                        src={getImageUrl(img, { preset: 'square' })}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="h-6 shrink-0" />
            )}
        </div>,
        document.body
    );
}
