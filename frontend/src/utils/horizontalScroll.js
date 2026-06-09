/** Compute active page index for a horizontally scrolled carousel. */
export function getCarouselScrollPage(scrollEl, cardSelector = '.card-carousel-fest', gap = 16) {
    if (!scrollEl) return 0;
    const card = scrollEl.querySelector(cardSelector);
    const step = (card?.offsetWidth ?? 320) + gap;
    return Math.max(0, Math.round(scrollEl.scrollLeft / step));
}
