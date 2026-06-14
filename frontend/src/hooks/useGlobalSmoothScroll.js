import { useEffect } from 'react';

const IDLE_MS = 140;

/**
 * Site-wide scroll polish: marks document while scrolling so CSS can
 * pause expensive transitions, and enables smooth in-page anchor jumps.
 */
export function useGlobalSmoothScroll() {
    useEffect(() => {
        const root = document.documentElement;
        let idleTimer = null;
        let ticking = false;

        const setScrolling = (active) => {
            root.classList.toggle('is-scrolling', active);
            root.dataset.scrolling = active ? 'true' : 'false';
        };

        const onScroll = () => {
            if (!root.classList.contains('is-scrolling')) {
                setScrolling(true);
            }

            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => {
                    ticking = false;
                });
            }

            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => setScrolling(false), IDLE_MS);
        };

        const onAnchorClick = (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (!link) return;

            const hash = link.getAttribute('href');
            if (!hash || hash === '#') return;

            const target = document.querySelector(hash);
            if (!target) return;

            event.preventDefault();
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start',
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('click', onAnchorClick);

        return () => {
            clearTimeout(idleTimer);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('click', onAnchorClick);
            setScrolling(false);
            document.body.style.overflow = '';
        };
    }, []);
}
