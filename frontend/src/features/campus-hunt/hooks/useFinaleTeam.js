import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFinaleMe, fetchMyTeam } from '../services/campusHunt.api';

function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 900;
  const active = Boolean(data?.activeMission || data?.entry?.activeMissionId);
  const waiting = Boolean(data?.waitingForRelease);
  const live = data?.round?.status === 'live' && !data?.round?.closed;
  if (active || waiting || live) return 2000;
  return 12000;
}

export function finaleFromActionData(payload) {
  if (!payload?.entry || !Array.isArray(payload.missions)) return null;
  return payload;
}

export function useFinaleTeam(eventId) {
  const [data, setData] = useState(null);
  const [teamMeta, setTeamMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [burstUntil, setBurstUntil] = useState(0);
  const teamIdRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setError(null);
    try {
      const [teamRes, finaleRes] = await Promise.all([
        fetchMyTeam(eventId),
        fetchFinaleMe(eventId),
      ]);
      setTeamMeta(teamRes.data?.team || null);
      setData(finaleRes.data);
      teamIdRef.current = teamRes.data?.team?.id || null;
    } catch (err) {
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        setError('Session expired — open your team link again');
      } else if (err?.code === 'NOT_FINALE_PARTICIPANT') {
        setError('Your team is not in the Finale.');
      } else {
        setError(err.message || 'Failed to load finale');
      }
      setData(null);
      teamIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const applyActionData = useCallback((payload) => {
    const next = finaleFromActionData(payload);
    if (!next) return false;
    setData(next);
    setBurstUntil(Date.now() + 8000);
    return true;
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const pollMs = pollIntervalMs(data, burstUntil);
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [
    data?.activeMission,
    data?.entry?.activeMissionId,
    data?.round?.status,
    data?.round?.closed,
    burstUntil,
    refresh,
  ]);

  return {
    data,
    teamMeta,
    teamId: teamIdRef.current,
    loading,
    error,
    refresh,
    applyActionData,
  };
}
