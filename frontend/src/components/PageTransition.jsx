import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import PageTransitionSkeleton from './PageTransitionSkeleton';
import { pageTransition } from '../motion/variants';

const MIN_MS = 120;
const TRANSITION_END_MS = MIN_MS + 220;
/** Never leave the full-screen skeleton overlay stuck */
const TRANSITION_SAFETY_MS = 2500;

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

    const finishTransition = useCallback(() => {
        setContentVisible(true);
        setIsTransitioning(false);
    }, []);

    const clearTimers = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    }, []);

    const scheduleTransitionEnd = useCallback((onComplete) => {
        timers.current.push(
            setTimeout(() => setContentVisible(true), MIN_MS),
            setTimeout(() => {
                setIsTransitioning(false);
                onComplete?.();
            }, TRANSITION_END_MS),
            setTimeout(finishTransition, TRANSITION_SAFETY_MS),
        );
    }, [finishTransition]);

    /** Skeleton first, then callback — used for profile overlay (no route change) */
    const startOverlayTransition = useCallback((pathname, onComplete) => {
        clearTimers();
        setSkeletonPath(pathname);
        setContentVisible(false);
        setIsTransitioning(true);
        scheduleTransitionEnd(onComplete);
    }, [clearTimers, scheduleTransitionEnd]);

    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useLayoutEffect(() => {
        if (isFirstNavigation.current) {
            isFirstNavigation.current = false;
            prevLocationKey.current = location.key;
            resetScrollToTop();
            // Boot splash already shown — render home immediately, no skeleton overlay
            setContentVisible(true);
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
            setContentVisible(true);
            return clearTimers;
        }

        prevLocationKey.current = location.key;
        clearTimers();

        setSkeletonPath(location.pathname);
        setContentVisible(false);
        setIsTransitioning(true);
        scheduleTransitionEnd();

        return clearTimers;
    }, [location.key, location.pathname, clearTimers, scheduleTransitionEnd]);

    useEffect(() => {
        document.body.classList.toggle('page-transition-active', isTransitioning);
        return () => document.body.classList.remove('page-transition-active');
    }, [isTransitioning]);

    return (
        <PageTransitionContext.Provider value={{ contentVisible, isTransitioning, startOverlayTransition }}>
            <TopProgressBar active={isTransitioning} />
            <AnimatePresence mode="wait">
                {isTransitioning && (
                    <motion.div
                        key={`skeleton-${skeletonPath}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <PageTransitionSkeleton pathname={skeletonPath} />
                    </motion.div>
                )}
            </AnimatePresence>
            {children}
        </PageTransitionContext.Provider>
    );
}

/** Wrap route content (Suspense + Routes) for fade-in on every page */
export function PageTransitionContent({ children }) {
    const { contentVisible } = useContext(PageTransitionContext);
    const reducedMotion = useReducedMotion();

    if (reducedMotion) {
        return (
            <div className={`page-transition-content ${contentVisible ? 'page-transition-enter' : 'page-transition-exit'}`}>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            className="page-transition-content"
            variants={pageTransition}
            initial={false}
            animate={contentVisible ? 'animate' : 'exit'}
        >
            {children}
        </motion.div>
    );
}

export default PageTransitionProvider;
