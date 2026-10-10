import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInvestigationState } from '../services/mystery.api';

export function useMysteryTeam(teamId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(teamId) && enabled);
  const [error, setError] = useState(null);
  const genRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!teamId || !enabled) {
      setLoading(false);
      return;
    }
    const gen = ++genRef.current;
    try {
      const res = await fetchInvestigationState(teamId);
      if (gen !== genRef.current) return;
      setData(res.data || res);
      setError(null);
    } catch (err) {
      if (gen !== genRef.current) return;
      setError(err.message || 'Failed to load');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [teamId, enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!teamId || !enabled) return undefined;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [teamId, enabled, refresh]);

  return { data, loading, error, refresh, setData };
}