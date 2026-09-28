import { useEffect, useRef } from 'react';

/**
 * High-performance Mobile Header Collapse.
 * Toggles header collapse smoothly via CSS transitions when user scrolls past threshold.
 * Eliminates main-thread layout thrashing & scroll glitches on mobile touch devices.
 */
export function useMobileHeaderCollapse(headerRef, onCollapsedChange) {
    const collapsedRef = useRef(false);
    const onCollapsedChangeRef = useRef(onCollapsedChange);
    onCollapsedChangeRef.current = onCollapsedChange;

    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;

        let ticking = false;

        const updateState = () => {
            const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
            const isScrolled = scrollY > 20;

            const isScrolling = scrollY > 0;
            if (el.dataset.scrolling !== (isScrolling ? 'true' : 'false')) {
                el.dataset.scrolling = isScrolling ? 'true' : 'false';
            }

            if (isScrolled !== collapsedRef.current) {
                collapsedRef.current = isScrolled;
                el.classList.toggle('is-collapsed', isScrolled);
                el.style.setProperty('--header-collapse', isScrolled ? '1' : '0');
                const branding = el.querySelector('.mobile-header-branding-row');
                branding?.setAttribute('aria-hidden', isScrolled ? 'true' : 'false');
                onCollapsedChangeRef.current?.(isScrolled);
            }

            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(updateState);
            }
        };

        // Initial check
        updateState();

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, [headerRef]);
}
