import { useRef, useState, useEffect, useMemo } from 'react';
import HomeEventCard from './HomeEventCard';
import { HomeEventCardSkeleton } from './HomeEventCardSkeleton';
import {
    useCenteredCarouselSidePad,
    useMeasuredCardWidth,
    getHomeCardFallbackWidth,
    scrollCarouselToSlide,
    HOME_CARD_GAP,
} from '../hooks/useHomeCarousel';
import CarouselDotPagination from './CarouselDotPagination';

const SKELETON_COUNT = 2;

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

function scrollToSlide(el, trackEl, index) {
    const slide = trackEl?.children?.[index];
    if (!slide) return;
    scrollCarouselToSlide(el, slide);
}

function getNearestSlideIndex(el, trackEl) {
    const children = trackEl?.children;
    if (!el || !children?.length) return 0;

    const viewportCenter = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < children.length; i += 1) {
        const slide = children[i];
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = i;
        }
    }

    return nearest;
}

function useHomeLoopCarousel(scrollRef, trackRef, items) {
    const { slides, loop, startIndex } = useMemo(() => buildHomeSlides(items), [items]);
    const [activeIndex, setActiveIndex] = useState(0);
    const jumpingRef = useRef(false);
    const itemsKey = useMemo(
        () => items.map((item) => getItemId(item)).join('|'),
        [items],
    );

    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || items.length === 0) return;

        jumpingRef.current = true;
        scrollToSlide(el, trackEl, loop ? startIndex : 0);
        setActiveIndex(0);
        requestAnimationFrame(() => {
            jumpingRef.current = false;
        });
    }, [itemsKey, loop, startIndex, scrollRef, trackRef]);

    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || items.length <= 1) return;

        const syncActiveIndex = () => {
            if (jumpingRef.current) return;

            const slideIndex = getNearestSlideIndex(el, trackEl);
            if (loop) {
                setActiveIndex(Math.max(0, Math.min(items.length - 1, slideIndex - 1)));
            } else {
                setActiveIndex(Math.max(0, slideIndex));
            }
        };

        const handleLoopWrap = () => {
            if (!loop || jumpingRef.current) return;

            const slideIndex = getNearestSlideIndex(el, trackEl);
            const lastSlideIndex = items.length + 1;

            if (slideIndex === 0) {
                jumpingRef.current = true;
                scrollToSlide(el, trackEl, items.length);
                setActiveIndex(items.length - 1);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (slideIndex === lastSlideIndex) {
                jumpingRef.current = true;
                scrollToSlide(el, trackEl, 1);
                setActiveIndex(0);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
            }
        };

        const snapToNearest = (behavior = 'smooth') => {
            if (jumpingRef.current) return;
            const slideIndex = getNearestSlideIndex(el, trackEl);
            const slide = trackEl.children[slideIndex];
            if (slide) scrollCarouselToSlide(el, slide, behavior);
        };

        let scrollEndTimer;
        const onScroll = () => {
            syncActiveIndex();
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
                snapToNearest('smooth');
                handleLoopWrap();
            }, 120);
        };

        const onScrollEnd = () => {
            clearTimeout(scrollEndTimer);
            syncActiveIndex();
            snapToNearest('smooth');
            requestAnimationFrame(handleLoopWrap);
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        if ('onscrollend' in el) {
            el.addEventListener('scrollend', onScrollEnd);
        }

        return () => {
            clearTimeout(scrollEndTimer);
            el.removeEventListener('scroll', onScroll);
            if ('onscrollend' in el) {
                el.removeEventListener('scrollend', onScrollEnd);
            }
        };
    }, [items, loop, scrollRef, trackRef]);

    return { slides, activeIndex };
}

function SlideCard({ slide, isDark, isFavorite, onToggleFavorite, onItemClick, getShareUrl, tallCard, wideCard, miniCard, portraitCard, heroCard }) {
    const item = slide.item;
    const id = getItemId(item);

    return (
        <div className="carousel-slide shrink-0">
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
                prominentImage={!portraitCard}
                tallImage={tallCard}
                wideCard={wideCard}
                miniCard={miniCard}
                portraitCard={portraitCard}
                heroCard={heroCard}
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
    tallCard = false,
    wideCard = false,
    miniCard = false,
    portraitCard = false,
    heroCard = false,
    cardGap = HOME_CARD_GAP,
}) {
    const scrollRef = useRef(null);
    const trackRef = useRef(null);

    const slideCount = loading
        ? SKELETON_COUNT
        : (items.length <= 1 ? items.length : items.length + 2);
    const fallbackWidth = getHomeCardFallbackWidth(wideCard, { miniCard, portraitCard, heroCard });
    const cardWidth = useMeasuredCardWidth(trackRef, slideCount, fallbackWidth);
    const sidePad = useCenteredCarouselSidePad(scrollRef, cardWidth);

    const { slides, activeIndex } = useHomeLoopCarousel(
        scrollRef,
        trackRef,
        loading ? [] : items,
    );

    const sidePadding = sidePad > 0
        ? `${sidePad}px`
        : `calc(50% - ${cardWidth / 2}px)`;

    const scrollStyle = {
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        paddingInline: sidePadding,
        scrollPaddingInline: sidePadding,
    };

    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // Re-center after card width / side padding is measured (fixes wide-card misalignment on load).
    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || loading || items.length === 0) return;

        const idx = activeIndexRef.current;
        const slideIndex = items.length > 1 ? idx + 1 : idx;
        const slide = trackEl.children[slideIndex];
        if (!slide) return;

        scrollCarouselToSlide(el, slide);
    }, [cardWidth, sidePad, loading, items.length]);

    if (loading) {
        if (loadingFallback) return loadingFallback;

        return (
            <section className="mb-8">
                <h2 className={`home-section-heading mb-3 px-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                </h2>
                <div
                    ref={scrollRef}
                    className="home-carousel-scroll overflow-x-auto scrollbar-hide"
                    style={scrollStyle}
                >
                    <div
                        ref={trackRef}
                        className="flex w-max pb-1"
                        style={{ gap: cardGap }}
                    >
                        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                            <div key={index} className="carousel-slide shrink-0">
                                <HomeEventCardSkeleton tallCard={tallCard} wideCard={wideCard} miniCard={miniCard} portraitCard={portraitCard} heroCard={heroCard} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (!items.length) {
        return emptyFallback;
    }

    return (
        <section className="mb-8">
            <h2 className={`home-section-heading mb-3 px-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h2>
            <div
                ref={scrollRef}
                className="home-carousel-scroll overflow-x-auto scrollbar-hide"
                style={scrollStyle}
            >
                <div
                    ref={trackRef}
                    className="flex w-max pb-1"
                    style={{ gap: cardGap }}
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
                            tallCard={tallCard}
                            wideCard={wideCard}
                            miniCard={miniCard}
                            portraitCard={portraitCard}
                            heroCard={heroCard}
                        />
                    ))}
                </div>
            </div>
            <CarouselDotPagination total={items.length} active={activeIndex} className="mt-4" />
        </section>
    );
}
