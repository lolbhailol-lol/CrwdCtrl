import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageTransitionSkeleton from './PageTransitionSkeleton';
import { SKELETON_LOADING_MS, SKELETON_LOADING_SAFETY_MS } from '../constants/skeletonLoading';

function resetScrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.classList.remove('is-scrolling');
    document.documentElement.dataset.scrolling = 'false';

    document.querySelectorAll('.mobile-header-shell').forEach((el) => {
        el.style.setProperty('--header-collapse', '0');
        el.dataset.scrolling = 'false';
        el.classList.remove('is-collapsed');
        el.querySelector('.mobile-header-branding-row')?.setAttribute('aria-hidden', 'false');
    });
}

/** Profile route uses its own in-page sidebar — skip duplicate route-based skeleton */
function shouldSkipPageTransition(pathname) {
    return pathname === '/profile';
}

const PageTransitionContext = createContext({
    contentVisible: true,
    isTransitioning: false,
    showSkeleton: false,
    hideChrome: false,
    startOverlayTransition: () => {},
    prepareRouteNavigation: () => {},
});

function TopProgressBar({ active }) {
    if (!active) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-100011 h-[2px] overflow-hidden">
            <div className="route-progress-bar h-full bg-[#0ECCEE]" />
        </div>
    );
}

export function usePageTransition() {
    return useContext(PageTransitionContext);
}

function readPageContentLoading() {
    if (typeof document === 'undefined') return false;
    return document.body.classList.contains('page-content-loading');
}

/** Mount once at Router level — shows loading UI on every route change app-wide */
export function PageTransitionProvider({ children }) {
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [pageDataLoading, setPageDataLoading] = useState(readPageContentLoading);
    const [skeletonPath, setSkeletonPath] = useState(location.pathname);
    const isFirstNavigation = useRef(true);
    const prevLocationKey = useRef(location.key);
    const timers = useRef([]);

    const showSkeleton = isTransitioning;
    const hideChrome = isTransitioning || pageDataLoading;
    const contentVisible = !showSkeleton;

    const finishTransition = useCallback(() => {
        setIsTransitioning(false);
    }, []);

    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);

    const scheduleTransitionEnd = useCallback((onComplete) => {
        timers.current.push(
            setTimeout(() => {
                setIsTransitioning(false);
                onComplete?.();
            }, SKELETON_LOADING_MS),
            setTimeout(finishTransition, SKELETON_LOADING_SAFETY_MS),
        );
    }, [finishTransition]);

    /** Skeleton first, then callback — used for profile overlay (no route change) */
    const startOverlayTransition = useCallback((pathname, onComplete) => {
        clearTimers();
        setSkeletonPath(pathname);
        setIsTransitioning(true);
        scheduleTransitionEnd(onComplete);
    }, [clearTimers, scheduleTransitionEnd]);

    /** Show skeleton immediately — e.g. profile drawer → home/bookings before route updates */
    const prepareRouteNavigation = useCallback((pathname) => {
        clearTimers();
        setSkeletonPath(pathname);
        setIsTransitioning(true);
        scheduleTransitionEnd();
    }, [clearTimers, scheduleTransitionEnd]);

    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useLayoutEffect(() => {
        const syncPageLoading = () => {
            setPageDataLoading(readPageContentLoading());
        };

        syncPageLoading();
        const observer = new MutationObserver(syncPageLoading);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        document.body.classList.toggle('page-transition-active', showSkeleton);
        return () => document.body.classList.remove('page-transition-active');
    }, [showSkeleton]);

    useLayoutEffect(() => {
        if (isFirstNavigation.current) {
            isFirstNavigation.current = false;
            prevLocationKey.current = location.key;
            resetScrollToTop();
            setIsTransitioning(false);
            return clearTimers;
        }

        if (prevLocationKey.current === location.key) {
            return clearTimers;
        }

        resetScrollToTop();

        if (shouldSkipPageTransition(location.pathname)) {
            prevLocationKey.current = location.key;
            setIsTransitioning(false);
            return clearTimers;
        }

        prevLocationKey.current = location.key;
        clearTimers();

        setSkeletonPath(location.pathname);
        setIsTransitioning(true);
        scheduleTransitionEnd();

        return clearTimers;
    }, [location.key, location.pathname, clearTimers, scheduleTransitionEnd]);

    return (
        <PageTransitionContext.Provider value={{
            contentVisible,
            isTransitioning,
            showSkeleton,
            hideChrome,
            startOverlayTransition,
            prepareRouteNavigation,
        }}>
            <TopProgressBar active={showSkeleton} />
            {showSkeleton && (
                <PageTransitionSkeleton pathname={skeletonPath} />
            )}
            {children}
        </PageTransitionContext.Provider>
    );
}

/** Wrap route content — hidden while transition skeleton is showing */
export function PageTransitionContent({ children }) {
    const { contentVisible } = usePageTransition();

    return (
        <div
            className="page-transition-content"
            aria-hidden={!contentVisible}
            style={contentVisible ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
        >
            {children}
        </div>
    );
}

export default PageTransitionProvider;
