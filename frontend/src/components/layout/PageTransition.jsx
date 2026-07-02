import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageTransitionSkeleton from '../PageTransitionSkeleton';
import { SKELETON_LOADING_MS, SKELETON_LOADING_SAFETY_MS } from '../../constants/skeletonLoading';

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

/**
 * Routes already mounted this session — their lazy chunk is cached, so navigating
 * back to them is instant. Showing the full-screen transition overlay again only
 * adds artificial lag and makes the header logo flash. Track exact paths so new
 * dynamic pages (e.g. a different /trek/:id) still get a first-load skeleton.
 */
const visitedRoutes = new Set();

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

/** Mount once at Router level — shows loading UI on every route change app-wide */
export function PageTransitionProvider({ children }) {
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [skeletonPath, setSkeletonPath] = useState(location.pathname);
    const isFirstNavigation = useRef(true);
    const prevLocationKey = useRef(location.key);
    const timers = useRef([]);

    const showSkeleton = isTransitioning;
    // Only hide chrome during route skeleton — not during in-page data fetches
    // (page-content-loading still hides footer/nav via CSS without flashing the logo).
    const hideChrome = isTransitioning;
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
        document.body.classList.toggle('page-transition-active', showSkeleton);
        return () => document.body.classList.remove('page-transition-active');
    }, [showSkeleton]);

    useLayoutEffect(() => {
        if (isFirstNavigation.current) {
            isFirstNavigation.current = false;
            prevLocationKey.current = location.key;
            visitedRoutes.add(location.pathname);
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

        // Already loaded this route this session → navigate instantly (no overlay,
        // no logo flash, no artificial delay). Suspense still covers a truly cold
        // chunk, and each page renders its own data-loading skeleton.
        if (visitedRoutes.has(location.pathname)) {
            prevLocationKey.current = location.key;
            setIsTransitioning(false);
            return clearTimers;
        }

        visitedRoutes.add(location.pathname);
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
