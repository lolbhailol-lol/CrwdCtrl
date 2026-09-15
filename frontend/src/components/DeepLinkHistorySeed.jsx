import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { seedDeepLinkHistory } from '../utils/inAppBack';

/**
 * Shared / scanned links open with a single history entry. Seed a parent
 * route underneath so Back can reach the rest of CrwdCtrl.
 */
export default function DeepLinkHistorySeed() {
  const location = useLocation();

  useLayoutEffect(() => {
    seedDeepLinkHistory(location.pathname, location.search, location.hash);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
