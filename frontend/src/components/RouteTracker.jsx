import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/analyticsService';
import { isLegacyIdSlugPath } from '../utils/slugRoutes';

/**
 * Invisible component that tracks page views on route change.
 * Place inside <Router> in App.jsx.
 */
export default function RouteTracker() {
  const location = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;

    // Legacy Mongo ID URLs are replaced with slug URLs shortly after load.
    // Skip the interim hit so GA and internal analytics only see slug paths.
    if (isLegacyIdSlugPath(location.pathname)) {
      const timer = setTimeout(() => {
        if (prevPath.current === location.pathname) return;
        if (window.location.pathname !== location.pathname) return;
        prevPath.current = location.pathname;
        trackPageView(location.pathname);
      }, 2500);
      return () => clearTimeout(timer);
    }

    prevPath.current = location.pathname;
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}
