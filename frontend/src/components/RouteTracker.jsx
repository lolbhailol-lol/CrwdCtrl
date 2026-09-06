import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageEngagement, trackPageView } from '../services/analyticsService';
import { shouldDelayAnalyticsPageView } from '../utils/slugRoutes';

const MAX_PAGE_SECONDS = 86400;

function elapsedSeconds(sinceMs) {
  if (!sinceMs) return 0;
  const seconds = Math.round((Date.now() - sinceMs) / 1000);
  return Math.max(0, Math.min(seconds, MAX_PAGE_SECONDS));
}

/**
 * Invisible component that tracks page views on route change.
 * Place inside <Router> in App.jsx.
 */
export default function RouteTracker() {
  const location = useLocation();
  const prevPath = useRef(null);
  const pageEnteredAt = useRef(Date.now());
  const activePath = useRef(location.pathname);

  const flushCurrentPage = () => {
    const page = activePath.current;
    const duration = elapsedSeconds(pageEnteredAt.current);
    if (page && duration > 0) {
      trackPageEngagement(page, duration, prevPath.current);
      pageEnteredAt.current = Date.now();
    }
  };

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushCurrentPage();
    };
    const onPageHide = () => flushCurrentPage();

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;

    const commitPageView = () => {
      const previous = prevPath.current;
      const duration = previous ? elapsedSeconds(pageEnteredAt.current) : 0;

      if (previous && duration > 0) {
        trackPageEngagement(previous, duration, null);
      }

      prevPath.current = location.pathname;
      activePath.current = location.pathname;
      pageEnteredAt.current = Date.now();
      trackPageView(location.pathname, { previousPage: previous || null });
    };

    if (shouldDelayAnalyticsPageView(location.pathname, location.search)) {
      const timer = setTimeout(() => {
        if (prevPath.current === location.pathname) return;
        if (window.location.pathname !== location.pathname) return;
        commitPageView();
      }, 2500);
      return () => clearTimeout(timer);
    }

    commitPageView();
  }, [location.pathname, location.search]);

  return null;
}
