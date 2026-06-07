import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageTransitionSkeleton from './PageTransitionSkeleton';

const MIN_MS = 400;
const PageTransitionContext = createContext({
    contentVisible: true,
    isTransitioning: false,
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

    useLayoutEffect(() => {
        const clearTimers = () => {
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };

        if (isFirstNavigation.current) {
            isFirstNavigation.current = false;
            prevLocationKey.current = location.key;
            return clearTimers;
        }

        if (prevLocationKey.current === location.key) {
            return clearTimers;
        }

        prevLocationKey.current = location.key;
        clearTimers();

        setSkeletonPath(location.pathname);
        setContentVisible(false);
        setIsTransitioning(true);
        timers.current.push(
            setTimeout(() => setContentVisible(true), MIN_MS),
            setTimeout(() => setIsTransitioning(false), MIN_MS + 300),
        );

        return clearTimers;
    }, [location.key]);

    useEffect(() => {
        document.body.classList.toggle('page-transition-active', isTransitioning);
        return () => document.body.classList.remove('page-transition-active');
    }, [isTransitioning]);

    return (
        <PageTransitionContext.Provider value={{ contentVisible, isTransitioning }}>
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
            className={`page-transition-content min-h-inherit ${
                contentVisible ? 'page-transition-enter' : 'page-transition-exit'
            }`}
        >
            {children}
        </div>
    );
}

export default PageTransitionProvider;
