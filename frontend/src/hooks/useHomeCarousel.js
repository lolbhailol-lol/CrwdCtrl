import { useState, useEffect } from 'react';

export const HOME_CARD_GAP = 16;
export const TRENDING_CARD_GAP = 16;

export function getHomeCardFallbackWidth(wideCard) {
    if (typeof window === 'undefined') return wideCard ? 360 : 280;
    const vw = window.innerWidth;
    if (wideCard) return Math.min(384, Math.max(280, vw * 0.84));
    return Math.min(300, Math.max(260, vw * 0.78));
}

/** Center a slide in a horizontal scroll container (accounts for padding + sub-pixel layout). */
export function scrollCarouselToSlide(scrollEl, slideEl) {
    if (!scrollEl || !slideEl) return;

    const containerRect = scrollEl.getBoundingClientRect();
    const slideRect = slideEl.getBoundingClientRect();
    const targetScroll = scrollEl.scrollLeft
        + (slideRect.left - containerRect.left)
        - (containerRect.width - slideRect.width) / 2;

    scrollEl.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'instant',
    });
}

export function useCenteredCarouselSidePad(ref, cardWidth) {
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
