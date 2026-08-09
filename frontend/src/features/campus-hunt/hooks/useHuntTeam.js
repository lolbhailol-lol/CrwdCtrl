import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyTeam, fetchTeamProgress } from '../services/campusHunt.api';

export function useHuntTeam(eventId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const teamIdRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setError(null);
    try {
      const res = await fetchMyTeam(eventId);
      setData(res.data);
      teamIdRef.current = res.data?.team?.id || null;
    } catch (err) {
      setError(err.message || 'Failed to load team');
      setData(null);
      teamIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const refreshProgress = useCallback(async () => {
    const teamId = teamIdRef.current;
    if (!teamId) return refresh();
    try {
      const res = await fetchTeamProgress(teamId);
      setData(res.data);
      teamIdRef.current = res.data?.team?.id || teamId;
    } catch (err) {
      setError(err.message || 'Failed to refresh');
    }
  }, [refresh]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const scheduledAt = data?.team?.scheduledStartAt
      ? new Date(data.team.scheduledStartAt).getTime()
      : 0;
    const waiting = ['WAITING', 'READY'].includes(data?.team?.startStatus);
    const nearRelease = waiting && scheduledAt > 0 && scheduledAt - Date.now() <= 2 * 60 * 1000;
    const pollMs = nearRelease ? 2000 : 15000;
    const id = setInterval(() => {
      refreshProgress();
    }, pollMs);
    return () => clearInterval(id);
  }, [data?.team?.scheduledStartAt, data?.team?.startStatus, refreshProgress]);

  return { data, loading, error, refresh, refreshProgress, setData };
}
