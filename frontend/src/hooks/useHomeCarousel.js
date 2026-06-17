import { useState, useEffect, useMemo, useRef } from 'react';

const LG_MEDIA = '(min-width: 1024px)';

export function useIsLgUp() {
    const [isLgUp, setIsLgUp] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(LG_MEDIA).matches,
    );

    useEffect(() => {
        const mq = window.matchMedia(LG_MEDIA);
        const onChange = () => setIsLgUp(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return isLgUp;
}

export const HOME_CARD_GAP = 16;
export const TRENDING_CARD_GAP = 16;

export function getHomeCardFallbackWidth(wideCard, { miniCard = false, portraitCard = false, heroCard = false } = {}) {
    if (typeof window === 'undefined') {
        if (portraitCard) return 160;
        if (heroCard || wideCard) return 360;
        if (miniCard) return 220;
        return 280;
    }
    const vw = window.innerWidth;
    if (portraitCard) return Math.min(160, Math.max(144, vw * 0.42));
    if (heroCard || wideCard) return Math.min(384, Math.max(280, vw * 0.84));
    if (miniCard) return Math.min(220, Math.max(200, vw * 0.62));
    return Math.min(300, Math.max(260, vw * 0.78));
}

/** Slightly narrower than wide cards — leaves room for peeking slides on both sides */
export function getUpcomingCardFallbackWidth() {
    if (typeof window === 'undefined') return 300;
    const vw = window.innerWidth;
    return Math.min(336, Math.max(256, vw * 0.76));
}

/** Center a slide in a horizontal scroll container (accounts for padding + sub-pixel layout). */
export function scrollCarouselToSlide(scrollEl, slideEl, behavior = 'instant') {
    if (!scrollEl || !slideEl) return;

    const containerRect = scrollEl.getBoundingClientRect();
    const slideRect = slideEl.getBoundingClientRect();
    const targetScroll = scrollEl.scrollLeft
        + (slideRect.left - containerRect.left)
        - (containerRect.width - slideRect.width) / 2;

    scrollEl.scrollTo({
        left: Math.max(0, targetScroll),
        behavior,
    });
}

/** Align a slide to the left gutter of a horizontal scroll container. */
export function scrollCarouselToSlideStart(scrollEl, slideEl, behavior = 'instant') {
    if (!scrollEl || !slideEl) return;

    const padLeft = Number.parseFloat(getComputedStyle(scrollEl).paddingLeft) || 0;
    scrollEl.scrollTo({
        left: Math.max(0, slideEl.offsetLeft - padLeft),
        behavior,
    });
}

export function useCenteredCarouselSidePad(ref, cardWidth, enabled = true) {
    const [sidePad, setSidePad] = useState(0);

    useEffect(() => {
        if (!enabled) {
            setSidePad(0);
            return undefined;
        }
        const el = ref.current;
        if (!el || !cardWidth) return undefined;

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
    }, [ref, cardWidth, enabled]);

    return sidePad;
}

export function useMeasuredCardWidth(trackRef, slideCount, fallbackWidth = 280) {
    const [cardWidth, setCardWidth] = useState(fallbackWidth);

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
    }, [trackRef, slideCount, fallbackWidth]);

    return cardWidth;
}

export function buildLoopSlides(items, getItemId = (item) => item.id || item._id) {
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

function scrollToLoopSlide(scrollEl, trackEl, index) {
    const slide = trackEl?.children?.[index];
    if (!slide) return;
    scrollCarouselToSlide(scrollEl, slide);
}

function getNearestSlideIndex(scrollEl, trackEl) {
    const children = trackEl?.children;
    if (!scrollEl || !children?.length) return 0;

    const viewportCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
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

/** Centered loop carousel — first real slide on load with peeking clones on both sides */
export function useLoopCarousel(scrollRef, trackRef, items, getItemId = (item) => item.id || item._id) {
    const { slides, loop, startIndex } = useMemo(
        () => buildLoopSlides(items, getItemId),
        [items, getItemId],
    );
    const [activeIndex, setActiveIndex] = useState(0);
    const jumpingRef = useRef(false);
    const itemsKey = useMemo(
        () => items.map((item) => getItemId(item)).join('|'),
        [items, getItemId],
    );

    useEffect(() => {
        const el = scrollRef.current;
        const trackEl = trackRef.current;
        if (!el || !trackEl || items.length === 0) return;

        jumpingRef.current = true;
        scrollToLoopSlide(el, trackEl, loop ? startIndex : 0);
        setActiveIndex(0);
        requestAnimationFrame(() => {
            jumpingRef.current = false;
        });
    }, [itemsKey, loop, startIndex, scrollRef, trackRef, items.length]);

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
                scrollToLoopSlide(el, trackEl, items.length);
                setActiveIndex(items.length - 1);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (slideIndex === lastSlideIndex) {
                jumpingRef.current = true;
                scrollToLoopSlide(el, trackEl, 1);
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
