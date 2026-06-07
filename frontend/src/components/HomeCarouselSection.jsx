import { useRef, useState, useEffect, useMemo } from 'react';
import HomeEventCard from './HomeEventCard';

const CARD_GAP = 12;

function CarouselDots({ total, active, isDark }) {
    if (total <= 1) return null;
    const shown = Math.min(total, 5);
    const dotColor = isDark ? '#0ECCEE' : '#4285F4';

    return (
        <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: shown }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={
                        i === active % shown
                            ? { width: 20, height: 8, backgroundColor: dotColor }
                            : {
                                width: 8,
                                height: 8,
                                backgroundColor: 'transparent',
                                border: `2px solid ${dotColor}`,
                            }
                    }
                />
            ))}
        </div>
    );
}

function useCenteredCarouselSidePad(ref, cardWidth) {
    const [sidePad, setSidePad] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el || !cardWidth) return;

        const update = () => {
            setSidePad(Math.max(0, (el.clientWidth - cardWidth) / 2));
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('resize', update);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [ref, cardWidth]);

    return sidePad;
}

function useMeasuredCardWidth(trackRef, slideCount) {
    const [cardWidth, setCardWidth] = useState(280);

    useEffect(() => {
        const firstSlide = trackRef.current?.firstElementChild;
        if (!firstSlide) return;

        const update = () => {
            const w = firstSlide.getBoundingClientRect().width;
            if (w > 0) setCardWidth(w);
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(firstSlide);
        return () => ro.disconnect();
    }, [trackRef, slideCount]);

    return cardWidth;
}

function getItemId(item) {
    return item.id || item._id;
}

function buildHomeSlides(items) {
    if (items.length <= 1) {
        return {
            slides: items.map((item) => ({ item, key: String(getItemId(item)) })),
            loop: false,
            startIndex: 0,
        };
    }

    const last = items[items.length - 1];
    const first = items[0];

    return {
        loop: true,
        startIndex: 1,
        slides: [
            { item: last, key: `loop-before-${getItemId(last)}` },
            ...items.map((item) => ({ item, key: String(getItemId(item)) })),
            { item: first, key: `loop-after-${getItemId(first)}` },
        ],
    };
}

function scrollToSlide(el, index, scrollStep, smooth = false) {
    el.scrollTo({
        left: index * scrollStep,
        behavior: smooth ? 'smooth' : 'instant',
    });
}

function useHomeLoopCarousel(scrollRef, items, scrollStep, sidePad) {
    const { slides, loop, startIndex } = useMemo(() => buildHomeSlides(items), [items]);
    const [activeIndex, setActiveIndex] = useState(0);
    const jumpingRef = useRef(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || items.length === 0 || !scrollStep) return;

        jumpingRef.current = true;
        scrollToSlide(el, loop ? startIndex : 0, scrollStep, false);
        setActiveIndex(0);
        requestAnimationFrame(() => {
            jumpingRef.current = false;
        });
    }, [items, loop, startIndex, sidePad, scrollRef, scrollStep]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || items.length <= 1 || !scrollStep) return;

        const onScroll = () => {
            if (jumpingRef.current) return;

            const slideIndex = Math.round(el.scrollLeft / scrollStep);
            const lastSlideIndex = items.length + 1;

            if (loop && slideIndex === 0) {
                jumpingRef.current = true;
                scrollToSlide(el, items.length, scrollStep, false);
                setActiveIndex(items.length - 1);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (loop && slideIndex === lastSlideIndex) {
                jumpingRef.current = true;
                scrollToSlide(el, 1, scrollStep, false);
                setActiveIndex(0);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (loop) {
                setActiveIndex(Math.max(0, Math.min(items.length - 1, slideIndex - 1)));
            } else {
                setActiveIndex(Math.max(0, slideIndex));
            }
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [items, loop, scrollRef, scrollStep]);

    return { slides, activeIndex };
}

function SlideCard({ slide, isDark, isFavorite, onToggleFavorite, onItemClick, getShareUrl }) {
    const item = slide.item;
    const id = getItemId(item);

    return (
        <div className="shrink-0 snap-center">
            <HomeEventCard
                event={{
                    id,
                    title: item.title || item.festName || item.trekName || item.name,
                    subtitle: item.subtitle || item.collegeName || item.city || item.basedIn,
                    image: item.image || item.coverImage || item.images?.[0],
                }}
                isDark={isDark}
                isFavorite={isFavorite?.(id)}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
                onViewDetails={() => onItemClick?.(item)}
                shareUrl={getShareUrl?.(item)}
                prominentImage
            />
        </div>
    );
}

export default function HomeCarouselSection({
    title,
    items = [],
    isDark = false,
    isFavorite,
    onToggleFavorite,
    onItemClick,
    getShareUrl,
    loading = false,
    loadingFallback = null,
    emptyFallback = null,
}) {
    const scrollRef = useRef(null);
    const trackRef = useRef(null);

    const slideCount = items.length <= 1 ? items.length : items.length + 2;
    const cardWidth = useMeasuredCardWidth(trackRef, slideCount);
    const sidePad = useCenteredCarouselSidePad(scrollRef, cardWidth);
    const scrollStep = cardWidth + CARD_GAP;

    const { slides, activeIndex } = useHomeLoopCarousel(
        scrollRef,
        items,
        scrollStep,
        sidePad,
    );

    const sidePadding = sidePad > 0
        ? `${sidePad}px`
        : `calc(50% - ${cardWidth / 2}px)`;

    if (loading) {
        return loadingFallback;
    }

    if (!items.length) {
        return emptyFallback;
    }

    return (
        <section className="mb-8">
            <h2 className={`home-section-heading mb-4 px-4 text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h2>
            <div
                ref={scrollRef}
                className="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    paddingInline: sidePadding,
                    scrollPaddingInline: sidePadding,
                }}
            >
                <div
                    ref={trackRef}
                    className="flex w-max pb-1"
                    style={{ gap: CARD_GAP }}
                >
                    {slides.map((slide) => (
                        <SlideCard
                            key={slide.key}
                            slide={slide}
                            isDark={isDark}
                            isFavorite={isFavorite}
                            onToggleFavorite={onToggleFavorite}
                            onItemClick={onItemClick}
                            getShareUrl={getShareUrl}
                        />
                    ))}
                </div>
            </div>
            <CarouselDots total={items.length} active={activeIndex} isDark={isDark} />
        </section>
    );
}
