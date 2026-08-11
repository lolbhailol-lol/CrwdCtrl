import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFinaleMe, fetchMyTeam } from '../services/campusHunt.api';

/** Softer polling — avoid hammering the server while playing. */
function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 3500;
  const active = Boolean(data?.activeMission || data?.entry?.activeMissionId);
  const waiting = Boolean(data?.waitingForRelease);
  const live = data?.round?.status === 'live' && !data?.round?.closed;
  if (active) return 8000;
  if (waiting) return 6000;
  if (live) return 10000;
  return 20000;
}

export function finaleFromActionData(payload) {
  if (!payload?.entry || !Array.isArray(payload.missions)) return null;
  return payload;
}

export function useFinaleTeam(eventId) {
  const [data, setData] = useState(null);
  const [teamMeta, setTeamMeta] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState(null);
  const [burstUntil, setBurstUntil] = useState(0);
  const teamIdRef = useRef(null);
  const teamMetaLoadedRef = useRef(false);
  const fetchGenRef = useRef(0);
  const pausePollUntilRef = useRef(0);

  const refresh = useCallback(async ({ includeTeam = false, soft = false } = {}) => {
    if (!eventId) return;
    const gen = ++fetchGenRef.current;
    if (!soft) setError(null);
    try {
      const needTeam = includeTeam || !teamMetaLoadedRef.current;
      let nextData;
      if (needTeam) {
        const [teamRes, finaleRes] = await Promise.all([
          fetchMyTeam(eventId),
          fetchFinaleMe(eventId),
        ]);
        if (gen !== fetchGenRef.current) return;
        setTeamMeta(teamRes.data?.team || null);
        nextData = finaleRes.data;
        teamIdRef.current = teamRes.data?.team?.id || null;
        teamMetaLoadedRef.current = true;
      } else {
        const finaleRes = await fetchFinaleMe(eventId);
        if (gen !== fetchGenRef.current) return;
        nextData = finaleRes.data;
      }
      setData(nextData);
      setError(null);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        setError('Session expired — open your team link again');
        setData(null);
        teamIdRef.current = null;
        teamMetaLoadedRef.current = false;
      } else if (err?.code === 'NOT_FINALE_PARTICIPANT' || err?.code === 'ROUND_LOCKED') {
        setError(err.message || 'Finals not available');
        // Keep last good board if we already had one
        if (!soft) {
          setData((prev) => prev);
        }
      } else {
        setError(err.message || 'Failed to load finale');
        // Soft poll failure: never wipe the board mid-game
        if (!soft) {
          setData(null);
          teamIdRef.current = null;
          teamMetaLoadedRef.current = false;
        }
      }
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [eventId]);

  const applyActionData = useCallback((payload) => {
    const next = finaleFromActionData(payload);
    if (!next) return false;
    // Invalidate in-flight polls so they can't overwrite this optimistic board
    fetchGenRef.current += 1;
    pausePollUntilRef.current = Date.now() + 2500;
    setData(next);
    setBurstUntil(Date.now() + 3500);
    setError(null);
    return true;
  }, []);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setTeamMeta(null);
      setLoading(false);
      setError(null);
      teamMetaLoadedRef.current = false;
      return undefined;
    }
    setLoading(true);
    teamMetaLoadedRef.current = false;
    refresh({ includeTeam: true });
    return undefined;
  }, [eventId, refresh]);

  useEffect(() => {
    if (!eventId) return undefined;
    const pollMs = pollIntervalMs(data, burstUntil);
    const id = setInterval(() => {
      if (Date.now() < pausePollUntilRef.current) return;
      refresh({ includeTeam: false, soft: true });
    }, pollMs);
    return () => clearInterval(id);
  }, [
    eventId,
    data?.activeMission,
    data?.entry?.activeMissionId,
    data?.waitingForRelease,
    data?.round?.status,
    data?.round?.closed,
    burstUntil,
    refresh,
  ]);

  return {
    data,
    teamMeta,
    teamId: teamIdRef.current || data?.entry?.teamId || null,
    loading,
    error,
    refresh: () => refresh({ includeTeam: false, soft: true }),
    applyActionData,
  };
}
