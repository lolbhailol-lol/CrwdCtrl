import { useEffect, useRef } from 'react';

const DEFAULT_COLLAPSE_DISTANCE = 82;
/** Only show the CrwdCtrl logo when the page is at (or very near) the top */
const EXPAND_AT_Y = 8;
const LERP = 0.42;
const SNAP_EPSILON = 0.004;

function measureCollapseDistance(el) {
    const row = el?.querySelector('.mobile-header-branding-row__inner');
    const measured = row?.offsetHeight ?? 0;
    return measured > 0 ? measured + 6 : DEFAULT_COLLAPSE_DISTANCE;
}

/**
 * Mobile header branding collapse.
 * Logo is visible only at the top of the page (refresh / scrolled to top).
 * Once the user scrolls away, it stays hidden until they return to the top —
 * so it does not flash back mid-page while scrolling up.
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
        let collapseDistance = measureCollapseDistance(el);
        let inputFocused = false;
        /** Once collapsed mid-page, stay collapsed until EXPAND_AT_Y */
        let lockedCollapsed = false;

        const isFormField = (node) => {
            if (!node || node === document.body) return false;
            const tag = node.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
        };

        const syncInputFocus = () => {
            inputFocused = isFormField(document.activeElement);
        };

        const onFocusIn = (event) => {
            if (isFormField(event.target)) inputFocused = true;
        };

        const onFocusOut = () => {
            window.setTimeout(syncInputFocus, 0);
        };

        const apply = (progress) => {
            el.style.setProperty('--header-collapse', String(progress));

            const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
            const scrolling = scrollY > 0.5 || progress > 0.02;
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

        const computeTarget = (scrollY) => {
            if (scrollY <= EXPAND_AT_Y) {
                lockedCollapsed = false;
                return 0;
            }

            if (scrollY >= collapseDistance || lockedCollapsed) {
                lockedCollapsed = true;
                return 1;
            }

            // Near the top, collapsing for the first time — ease out with scroll
            const raw = Math.min(1, Math.max(0, scrollY / collapseDistance));
            return raw * raw * (3 - 2 * raw);
        };

        const tick = () => {
            const now = performance.now();
            const isActivelyScrolling = now - lastScrollEvent < 80;

            if (Math.abs(targetProgress - currentProgress) > SNAP_EPSILON) {
                currentProgress += (targetProgress - currentProgress) * LERP;
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
            if (inputFocused) return;
            const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion) {
                targetProgress = scrollY > EXPAND_AT_Y ? 1 : 0;
                lockedCollapsed = scrollY > EXPAND_AT_Y;
            } else {
                targetProgress = computeTarget(scrollY);
            }
        };

        const onResize = () => {
            collapseDistance = measureCollapseDistance(el);
            syncTarget();
            apply(currentProgress);
        };

        const startLoop = () => {
            lastScrollEvent = performance.now();
            syncTarget();

            const scrollY = window.scrollY ?? document.documentElement.scrollTop ?? 0;
            if (scrollY > 0.5 && el.dataset.scrolling !== 'true') {
                el.dataset.scrolling = 'true';
            }

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
            }, 180);
        };

        syncTarget();
        apply(currentProgress);
        syncInputFocus();

        window.addEventListener('scroll', startLoop, { passive: true });
        window.addEventListener('touchmove', startLoop, { passive: true });
        window.addEventListener('resize', onResize, { passive: true });
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('focusout', onFocusOut, true);

        return () => {
            window.removeEventListener('scroll', startLoop);
            window.removeEventListener('touchmove', startLoop);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('focusout', onFocusOut, true);
            clearTimeout(idleTimer);
            loopActive = false;
            if (rafId != null) window.cancelAnimationFrame(rafId);
        };
    }, [headerRef]);
}
