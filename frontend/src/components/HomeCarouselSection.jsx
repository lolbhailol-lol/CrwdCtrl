import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import HomeEventCard from './HomeEventCard';
import { HomeEventCardSkeleton, CENTERED_SKELETON_COUNT } from './HomeEventCardSkeleton';
import {
    useCenteredCarouselSidePad,
    useMeasuredCardWidth,
    getHomeCardFallbackWidth,
    scrollCarouselToSlide,
    scrollCarouselToSlideStart,
    useIsLgUp,
    HOME_CARD_GAP,
} from '../hooks/useHomeCarousel';
import CarouselDotPagination from './CarouselDotPagination';
import { getCoverImageUrl } from '../utils/coverImages';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { preloadImages } from '../utils/preloadImages';
import { getImageUrl } from '../utils/imageImports';

const SKELETON_COUNT = CENTERED_SKELETON_COUNT;

function resolveSlideCoverPreset({ portraitCard, wideCard, heroCard }) {
    if (heroCard) return 'hero';
    if (wideCard) return 'cardWide';
    if (portraitCard) return 'cardPortrait';
    return 'cardPortrait';
}

function resolveSlideImage(item, preset) {
    return (
        getCoverImageUrl(item, preset)
        || item.image
        || item.coverImage
        || item._image
        || item.images?.[0]
        || item.poster
        || item.banner
        || null
    );
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

function scrollToSlide(el, trackEl, index, alignStart = false) {
    const slide = trackEl?.children?.[index];
    if (!slide) return;
    if (alignStart) {
        scrollCarouselToSlideStart(el, slide);
    } else {
        scrollCarouselToSlide(el, slide);
    }
}

function getNearestSlideIndex(el, trackEl, alignStart = false) {
    const children = trackEl?.children;
    if (!el || !children?.length) return 0;

    if (alignStart) {
        const scrollLeft = el.scrollLeft + (Number.parseFloat(getComputedStyle(el).paddingLeft) || 0);
        for (let i = 0; i < children.length; i += 1) {
            const slide = children[i];
            if (slide.offsetLeft + slide.offsetWidth > scrollLeft + 4) {
                return i;
            }
        }
        return Math.max(0, children.length - 1);
    }

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

function useHomeLoopCarousel(scrollRef, trackRef, items, alignStart = false) {
    const { slides, loop, startIndex } = useMemo(() => {
        if (alignStart) {
            return {
                slides: items.map((item) => ({ item, key: String(getItemId(item)) })),
                loop: false,
                startIndex: 0,
            };
        }
        return buildHomeSlides(items);
    }, [items, alignStart]);
    const [activeIndex, setActiveIndex] = useState(0);
    // Tracks the items signature that has actually been centered, so the track can
    // stay hidden until it is positioned on the correct first slide (prevents any
    // wrong/clone card from being painted in the center on load or reorder).
    const [positionedKey, setPositionedKey] = useState('');
    const jumpingRef = useRef(false);
    const itemsKey = useMemo(
        () => items.map((item) => getItemId(item)).join('|'),
        [items],
    );

    // Use a layout effect so the carousel is positioned on the first real slide
    // BEFORE the browser paints. With a plain effect the first painted frame sits
    // at scrollLeft:0 (which centers the leading loop clone — the wrong/last card)
    // and only scrolls afterwards, producing a brief "wrong card in center" flash.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || items.length === 0) return;

        jumpingRef.current = true;
        if (alignStart) {
            el.scrollLeft = 0;
        } else {
            scrollToSlide(el, trackEl, loop ? startIndex : 0, alignStart);
        }
        setActiveIndex(0);
        setPositionedKey(itemsKey);
        // Keep the guard up through the initial layout settle (card-width / side-pad
        // measurement triggers a layout shift whose scroll events would otherwise
        // hijack the active slide onto a neighbouring loop clone). Re-pin to the
        // first real slide a couple of frames in.
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                if (!alignStart && scrollRef.current && trackRef.current) {
                    scrollToSlide(scrollRef.current, trackRef.current, loop ? startIndex : 0, alignStart);
                }
            });
        });
        const release = setTimeout(() => {
            jumpingRef.current = false;
        }, 320);
        return () => {
            cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
            clearTimeout(release);
        };
    }, [itemsKey, loop, startIndex, scrollRef, trackRef, alignStart]);

    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || items.length <= 1) return;

        const syncActiveIndex = () => {
            if (jumpingRef.current) return;

            const slideIndex = getNearestSlideIndex(el, trackEl, alignStart);
            if (loop) {
                setActiveIndex(Math.max(0, Math.min(items.length - 1, slideIndex - 1)));
            } else {
                setActiveIndex(Math.max(0, slideIndex));
            }
        };

        const handleLoopWrap = () => {
            if (alignStart || !loop || jumpingRef.current) return;

            const slideIndex = getNearestSlideIndex(el, trackEl, alignStart);
            const lastSlideIndex = items.length + 1;

            if (slideIndex === 0) {
                jumpingRef.current = true;
                scrollToSlide(el, trackEl, items.length, alignStart);
                setActiveIndex(items.length - 1);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (slideIndex === lastSlideIndex) {
                jumpingRef.current = true;
                scrollToSlide(el, trackEl, 1, alignStart);
                setActiveIndex(0);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
            }
        };

        const snapToNearest = (behavior = 'smooth') => {
            if (alignStart || jumpingRef.current) return;
            const slideIndex = getNearestSlideIndex(el, trackEl, alignStart);
            const slide = trackEl.children[slideIndex];
            if (slide) scrollCarouselToSlide(el, slide, behavior);
        };

        let scrollEndTimer;
        const onScroll = () => {
            syncActiveIndex();
            if (alignStart) return;
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
                snapToNearest('smooth');
                handleLoopWrap();
            }, 120);
        };

        const onScrollEnd = () => {
            if (alignStart) {
                syncActiveIndex();
                return;
            }
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
    }, [items, loop, scrollRef, trackRef, alignStart]);

    const positioned = items.length === 0 || positionedKey === itemsKey;

    return { slides, activeIndex, positioned };
}

function SlideCard({
    slide,
    slideIndex = 0,
    activeIndex = 0,
    isDark,
    isFavorite,
    onToggleFavorite,
    onItemClick,
    getShareUrl,
    tallCard,
    wideCard,
    miniCard,
    portraitCard,
    heroCard,
    alignStart = false,
}) {
    const item = slide.item;
    const id = getItemId(item);
    const preset = resolveSlideCoverPreset({ portraitCard, wideCard, heroCard });
    // Eager-load active slide and neighbors so center cards don't wait on lazy
    const nearActive = Math.abs(slideIndex - activeIndex) <= 1;
    const imgLoading = nearActive || slideIndex < 2 ? 'eager' : 'lazy';
    const imgPriority = nearActive || slideIndex === 0 ? 'high' : undefined;

    return (
        <div className={`carousel-slide shrink-0${alignStart ? ' snap-start' : ''}`}>
            <HomeEventCard
                event={{
                    id,
                    title: item.title || item.festName || item.trekName || item.name,
                    subtitle: item.subtitle || item.collegeName || item.city || item.basedIn,
                    image: resolveSlideImage(item, preset),
                }}
                isDark={isDark}
                isFavorite={isFavorite?.(id)}
                onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
                onViewDetails={() => onItemClick?.(item)}
                shareUrl={getShareUrl?.(item)}
                prominentImage={tallCard && !wideCard && !miniCard && !portraitCard && !heroCard}
                tallImage={tallCard}
                wideCard={wideCard}
                miniCard={miniCard}
                portraitCard={portraitCard}
                heroCard={heroCard}
                loading={imgLoading}
                fetchPriority={imgPriority}
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
    const isLgUp = useIsLgUp();
    const alignStart = isLgUp;

    const slideCount = loading
        ? SKELETON_COUNT
        : (alignStart || items.length <= 1 ? items.length : items.length + 2);
    const fallbackWidth = getHomeCardFallbackWidth(wideCard, { miniCard, portraitCard, heroCard });
    const cardWidth = useMeasuredCardWidth(trackRef, slideCount, fallbackWidth);
    const sidePad = useCenteredCarouselSidePad(scrollRef, cardWidth, !alignStart);

    const { slides, activeIndex, positioned } = useHomeLoopCarousel(
        scrollRef,
        trackRef,
        loading ? [] : items,
        alignStart,
    );

    // Warm cache for the first few visible cards as soon as data arrives
    useEffect(() => {
        if (loading || !items.length) return;
        const preset = resolveSlideCoverPreset({ portraitCard, wideCard, heroCard });
        const urls = items.slice(0, 6).map((item) => {
            const raw = resolveSlideImage(item, preset);
            if (!raw) return null;
            // getCoverImageUrl already optimizes; still normalize non-cover paths
            if (typeof raw === 'string' && raw.includes('res.cloudinary.com')) return raw;
            return optimizeImageUrl(getImageUrl(raw) || raw, preset);
        });
        preloadImages(urls, { limit: 6 });
    }, [loading, items, portraitCard, wideCard, heroCard]);

    // On mobile (centered loop) keep the track invisible until it has been scrolled
    // onto the correct first slide, so no clone/wrong card is ever painted center.
    const trackHidden = !alignStart && !positioned;

    const sidePadding = alignStart
        ? undefined
        : (sidePad > 0
            ? `${sidePad}px`
            : `calc(50% - ${cardWidth / 2}px)`);

    const scrollStyle = {
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        ...(sidePadding ? {
            paddingInline: sidePadding,
            scrollPaddingInline: sidePadding,
        } : {}),
    };

    const carouselClassName = `home-carousel-scroll overflow-x-auto scrollbar-hide${alignStart ? ' home-carousel-scroll--desktop-gutter' : ''}`;

    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    // Re-center after card width / side padding is measured (fixes wide-card misalignment on load).
    // Must run BEFORE paint: when the measured width changes the layout shifts, and a plain
    // effect would let one frame paint at the stale scroll offset (centering the wrong/neighbor
    // card) before correcting — the brief "wrong card in center" flash.
    useLayoutEffect(() => {
        if (alignStart) return;
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || loading || items.length === 0) return;

        const idx = activeIndexRef.current;
        const slideIndex = items.length > 1 ? idx + 1 : idx;
        const slide = trackEl.children[slideIndex];
        if (!slide) return;

        scrollCarouselToSlide(el, slide);
    }, [cardWidth, sidePad, loading, items.length, alignStart]);

    // Center skeleton carousel — one card in middle, peers peeking on sides
    useLayoutEffect(() => {
        if (alignStart || !loading) return;
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl) return;

        const centerIndex = Math.floor(SKELETON_COUNT / 2);
        const slide = trackEl.children[centerIndex];
        if (slide) scrollCarouselToSlide(el, slide);
    }, [loading, cardWidth, sidePad, alignStart]);

    if (loading) {
        if (loadingFallback) return loadingFallback;

        return (
            <section className="home-section-block">
                {title ? (
                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {title}
                    </h2>
                ) : null}
                <div
                    ref={scrollRef}
                    className={carouselClassName}
                    style={scrollStyle}
                >
                    <div
                        ref={trackRef}
                        className="flex w-max pb-1"
                        style={{ gap: cardGap }}
                    >
                        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                            <div key={index} className={`carousel-slide shrink-0${alignStart ? ' snap-start' : ' snap-center'}`}>
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
        <section className="home-section-block">
            <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h2>
            <div
                ref={scrollRef}
                className={`${carouselClassName} relative`}
                style={scrollStyle}
            >
                {/* Overlay skeleton until loop track is centered — no blank/invisible flash */}
                {trackHidden ? (
                    <div
                        className="pointer-events-none absolute inset-0 z-10 flex w-max pb-1"
                        style={{ gap: cardGap, paddingInline: scrollStyle.paddingInline }}
                        aria-hidden
                    >
                        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                            <div key={`ov-${index}`} className="carousel-slide shrink-0 snap-center">
                                <HomeEventCardSkeleton tallCard={tallCard} wideCard={wideCard} miniCard={miniCard} portraitCard={portraitCard} heroCard={heroCard} />
                            </div>
                        ))}
                    </div>
                ) : null}
                <div
                    ref={trackRef}
                    className="flex w-max pb-1"
                    style={{
                        gap: cardGap,
                        opacity: trackHidden ? 0 : 1,
                    }}
                >
                    {slides.map((slide, slideIndex) => {
                        const logicalIndex = alignStart || items.length <= 1
                            ? slideIndex
                            : Math.max(0, Math.min(items.length - 1, slideIndex - 1));
                        return (
                            <SlideCard
                                key={slide.key}
                                slide={slide}
                                slideIndex={logicalIndex}
                                activeIndex={activeIndex}
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
                                alignStart={alignStart}
                            />
                        );
                    })}
                </div>
            </div>
            {!trackHidden ? (
                <CarouselDotPagination total={items.length} active={activeIndex} className="mt-4" />
            ) : null}
        </section>
    );
}
