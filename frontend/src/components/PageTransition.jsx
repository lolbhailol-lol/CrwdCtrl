import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageTransitionSkeleton from './PageTransitionSkeleton';

const MIN_MS = 120;
const TRANSITION_END_MS = MIN_MS + 180;

function resetScrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.classList.remove('is-scrolling');
    document.documentElement.dataset.scrolling = 'false';
    document.body.style.overflow = '';

    document.querySelectorAll('.mobile-header-shell').forEach((el) => {
        el.style.setProperty('--header-collapse', '0');
        el.dataset.scrolling = 'false';
        el.classList.remove('is-collapsed');
        el.querySelector('.mobile-header-branding-row')?.setAttribute('aria-hidden', 'false');
    });
}

/** Profile overlay uses startOverlayTransition — skip duplicate route-based skeleton */
function shouldSkipPageTransition(pathname) {
    return pathname === '/profile';
}

const PageTransitionContext = createContext({
    contentVisible: true,
    isTransitioning: false,
    startOverlayTransition: () => {},
});

function TopProgressBar({ active }) {
    if (!active) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-100001 h-[2px] overflow-hidden">
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
    const [contentVisible, setContentVisible] = useState(true);
    const [skeletonPath, setSkeletonPath] = useState(location.pathname);
    const isFirstNavigation = useRef(true);
    const prevLocationKey = useRef(location.key);
    const timers = useRef([]);

    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);

    /** Skeleton first, then callback — used for profile overlay (no route change) */
    const startOverlayTransition = useCallback((pathname, onComplete) => {
        clearTimers();
        setSkeletonPath(pathname);
        setContentVisible(false);
        setIsTransitioning(true);
        timers.current.push(
            setTimeout(() => setContentVisible(true), MIN_MS),
            setTimeout(() => {
                setIsTransitioning(false);
                onComplete?.();
            }, TRANSITION_END_MS),
        );
    }, [clearTimers]);

    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useLayoutEffect(() => {
        if (isFirstNavigation.current) {
            isFirstNavigation.current = false;
            prevLocationKey.current = location.key;
            return clearTimers;
        }

        if (prevLocationKey.current === location.key) {
            return clearTimers;
        }

        resetScrollToTop();

        if (shouldSkipPageTransition(location.pathname)) {
            prevLocationKey.current = location.key;
            setIsTransitioning(false);
            setContentVisible(true);
            return clearTimers;
        }

        prevLocationKey.current = location.key;
        clearTimers();

        setSkeletonPath(location.pathname);
        setContentVisible(false);
        setIsTransitioning(true);
        timers.current.push(
            setTimeout(() => setContentVisible(true), MIN_MS),
            setTimeout(() => setIsTransitioning(false), TRANSITION_END_MS),
        );

        return clearTimers;
    }, [location.key, location.pathname, clearTimers]);

    useEffect(() => {
        document.body.classList.toggle('page-transition-active', isTransitioning);
        return () => document.body.classList.remove('page-transition-active');
    }, [isTransitioning]);

    return (
        <PageTransitionContext.Provider value={{ contentVisible, isTransitioning, startOverlayTransition }}>
            <TopProgressBar active={isTransitioning} />
            {isTransitioning && <PageTransitionSkeleton pathname={skeletonPath} />}
            {children}
        </PageTransitionContext.Provider>
    );
}

/** Wrap route content (Suspense + Routes) for fade-in on every page */
export function PageTransitionContent({ children }) {
    const { contentVisible } = useContext(PageTransitionContext);

    return (
        <div
            className={`page-transition-content ${
                contentVisible ? 'page-transition-enter' : 'page-transition-exit'
            }`}
        >
            {children}
        </div>
    );
}

export default PageTransitionProvider;
