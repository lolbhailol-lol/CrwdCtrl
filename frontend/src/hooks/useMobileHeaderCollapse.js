import { useEffect, useRef } from 'react';

const COLLAPSE_DISTANCE = 82;
const MIN_COLLAPSE_DISTANCE = 28;
const IDLE_MS = 220;
const LERP_ACTIVE = 0.38;
const LERP_ACTIVE_MAX = 0.78;
const LERP_IDLE = 0.14;
const LERP_IDLE_MAX = 0.42;
const SNAP_EPSILON = 0.004;
/** px/ms — ~1.8 ≈ brisk flick, ~3+ ≈ very fast momentum scroll */
const FAST_SCROLL_VELOCITY = 1.8;

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function getSpeedFactor(velocityPxPerMs) {
    return Math.min(1, Math.abs(velocityPxPerMs) / FAST_SCROLL_VELOCITY);
}

function getEffectiveCollapseDistance(speedFactor) {
    return COLLAPSE_DISTANCE - (COLLAPSE_DISTANCE - MIN_COLLAPSE_DISTANCE) * speedFactor;
}

function getTargetProgress(scrollY, speedFactor) {
    const distance = getEffectiveCollapseDistance(speedFactor);
    const raw = Math.min(1, Math.max(0, scrollY / distance));
    return smoothstep(raw);
}

function getLerpFactor(isActivelyScrolling, speedFactor) {
    const base = isActivelyScrolling ? LERP_ACTIVE : LERP_IDLE;
    const max = isActivelyScrolling ? LERP_ACTIVE_MAX : LERP_IDLE_MAX;
    return base + (max - base) * speedFactor;
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
        let lastScrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
        let lastScrollTime = performance.now();
        let scrollVelocity = 0;
        let speedFactor = 0;
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
            const now = performance.now();
            const isActivelyScrolling = now - lastScrollEvent < 80;

            if (!isActivelyScrolling) {
                scrollVelocity *= 0.88;
                const prevSpeed = speedFactor;
                speedFactor = getSpeedFactor(scrollVelocity);

                if (Math.abs(speedFactor - prevSpeed) > 0.02) {
                    const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
                    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                        targetProgress = getTargetProgress(scrollY, speedFactor);
                    }
                }
            }

            const factor = getLerpFactor(isActivelyScrolling, speedFactor);

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
            const now = performance.now();
            const dt = Math.max(now - lastScrollTime, 1);
            const dy = scrollY - lastScrollY;
            const instantVelocity = dy / dt;

            scrollVelocity = scrollVelocity * 0.45 + instantVelocity * 0.55;
            speedFactor = getSpeedFactor(scrollVelocity);

            lastScrollY = scrollY;
            lastScrollTime = now;

            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            targetProgress = prefersReducedMotion
                ? (scrollY > COLLAPSE_DISTANCE * 0.5 ? 1 : 0)
                : getTargetProgress(scrollY, speedFactor);
        };

        const startLoop = () => {
            lastScrollEvent = performance.now();
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
