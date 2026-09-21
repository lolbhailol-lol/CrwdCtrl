import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadOfflineBundle } from './offlineDb';
import { CAMPUS_HUNT_PATHS } from '../config';
import { applyOfflineHuntManifest, isOfflineHuntPath } from './offlineHuntManifest';
import { dismissBootOverlays } from '../../../utils/dismissBootOverlays';

/**
 * Airplane mode + a saved team pack → open Hunt, not the main website.
 * Also keeps the Hunt web manifest on /campus-hunt/offline/* routes.
 */
export default function OfflineHuntBootGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    applyOfflineHuntManifest();
    if (isOfflineHuntPath(location.pathname)) {
      dismissBootOverlays();
      try {
        document.body.classList.remove('page-content-loading');
        document.documentElement.removeAttribute('data-home-hub-loading');
      } catch { /* ignore */ }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isOfflineHuntPath(location.pathname)) return undefined;
    if (typeof navigator !== 'undefined' && navigator.onLine) return undefined;
    let cancelled = false;
    loadOfflineBundle()
      .then((pack) => {
        if (cancelled || !pack?.team?.teamCode) return;
        navigate(CAMPUS_HUNT_PATHS.offline, { replace: true });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, navigate]);

  return null;
}
