import { useEffect, useState } from 'react';
import {
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
  saveOfflineTeamState,
} from './offlineDb';
import { hydrateState } from './offlineEngine';

export function useOfflineHuntSession() {
  const [bundle, setBundle] = useState(null);
  const [session, setSession] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pack, sess] = await Promise.all([
          loadOfflineBundle(),
          loadOfflineSession(),
        ]);
        if (cancelled) return;
        let teamState = sess?.teamCode
          ? await loadOfflineTeamState(sess.teamCode)
          : null;
        if (pack) teamState = hydrateState(pack, teamState);
        if (pack && sess?.teamCode && teamState) {
          await saveOfflineTeamState(sess.teamCode, teamState);
        }
        if (cancelled) return;
        setBundle(pack);
        setSession(sess);
        setState(teamState);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { bundle, session, state, loading };
}
