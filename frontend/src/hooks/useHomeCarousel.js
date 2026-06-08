import { useState, useEffect } from 'react';

export const HOME_CARD_GAP = 16;
export const TRENDING_CARD_GAP = 30;

export function getHomeCardFallbackWidth(wideCard) {
    return wideCard ? 360 : 280;
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
