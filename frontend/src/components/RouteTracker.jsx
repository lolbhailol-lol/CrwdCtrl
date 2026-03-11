import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/analyticsService';

/**
 * Invisible component that tracks page views on route change.
 * Place inside <Router> in App.jsx.
 */
export default function RouteTracker() {
  const location = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    // Avoid duplicate tracking for the same path
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      trackPageView(location.pathname);
    }
  }, [location.pathname]);

  return null;
}
