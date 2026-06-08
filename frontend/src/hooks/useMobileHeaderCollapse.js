import { useEffect, useRef } from 'react';

const COLLAPSE_DISTANCE = 82;
const IDLE_MS = 280;
const LERP_ACTIVE = 0.38;
const LERP_IDLE = 0.14;
const SNAP_EPSILON = 0.004;

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function getTargetProgress(scrollY) {
    const raw = Math.min(1, Math.max(0, scrollY / COLLAPSE_DISTANCE));
    return smoothstep(raw);
}

/**
 * Scroll-linked header collapse with rAF lerp — buttery on iOS momentum scroll.
 * Writes CSS vars directly to the DOM (zero React re-renders during scroll).
 */
export function useMobileHeaderCollapse(headerRef, onCollapsedChange) {
    const collapsedRef = useRef(false);
    const onCollapsedChangeRef = useRef(onCollapsedChange);
    onCollapsedChangeRef.current = onCollapsedChange;

    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;

        let rafId = null;
        let loopActive = false;
        let idleTimer = null;
        let lastScrollEvent = 0;
        let currentProgress = 0;
        let targetProgress = 0;

        const apply = (progress) => {
            el.style.setProperty('--header-collapse', String(progress));

            const scrolling = progress > 0.02;
            if (el.dataset.scrolling !== (scrolling ? 'true' : 'false')) {
                el.dataset.scrolling = scrolling ? 'true' : 'false';
            }

            const collapsed = progress >= 0.98;
            if (collapsed !== collapsedRef.current) {
                collapsedRef.current = collapsed;
                el.classList.toggle('is-collapsed', collapsed);
                const branding = el.querySelector('.mobile-header-branding-row');
                branding?.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
                onCollapsedChangeRef.current?.(collapsed);
            }
        };

        const tick = () => {
            const now = Date.now();
            const isActivelyScrolling = now - lastScrollEvent < 80;
            const factor = isActivelyScrolling ? LERP_ACTIVE : LERP_IDLE;

            if (Math.abs(targetProgress - currentProgress) > SNAP_EPSILON) {
                currentProgress += (targetProgress - currentProgress) * factor;
            } else {
                currentProgress = targetProgress;
            }

            apply(currentProgress);

            const settled = Math.abs(targetProgress - currentProgress) <= SNAP_EPSILON;
            if (loopActive && (!settled || isActivelyScrolling)) {
                rafId = window.requestAnimationFrame(tick);
            } else if (loopActive) {
                loopActive = false;
                rafId = null;
                apply(targetProgress);
            }
        };

        const syncTarget = () => {
            const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            targetProgress = prefersReducedMotion
                ? (scrollY > COLLAPSE_DISTANCE * 0.5 ? 1 : 0)
                : getTargetProgress(scrollY);
        };

        const startLoop = () => {
            lastScrollEvent = Date.now();
            syncTarget();
            clearTimeout(idleTimer);

            if (!loopActive) {
                loopActive = true;
                rafId = window.requestAnimationFrame(tick);
            }

            idleTimer = setTimeout(() => {
                syncTarget();
                if (!loopActive) {
                    loopActive = true;
                    rafId = window.requestAnimationFrame(tick);
                }
            }, IDLE_MS);
        };

        syncTarget();
        apply(currentProgress);

        window.addEventListener('scroll', startLoop, { passive: true });
        window.addEventListener('touchmove', startLoop, { passive: true });

        return () => {
            window.removeEventListener('scroll', startLoop);
            window.removeEventListener('touchmove', startLoop);
            clearTimeout(idleTimer);
            loopActive = false;
            if (rafId != null) window.cancelAnimationFrame(rafId);
        };
    }, [headerRef]);
}
