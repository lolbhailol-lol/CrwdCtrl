import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFinaleMe, fetchMyTeam } from '../services/campusHunt.api';
import { finalePlayerMessage } from '../utils/finalePlayerMessage';

function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 1000;
  const active = Boolean(data?.activeMission || data?.entry?.activeMissionId);
  const waiting = Boolean(data?.waitingForRelease);
  const live = data?.round?.status === 'live' && !data?.round?.closed;
  // Near-live while teammates can change the board
  if (active) return 1000;
  if (waiting) return 2000;
  if (live) return 3000;
  return 15000;
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
  const [pollError, setPollError] = useState(null);
  const [burstUntil, setBurstUntil] = useState(0);
  const teamIdRef = useRef(null);
  const teamMetaLoadedRef = useRef(false);
  const fetchGenRef = useRef(0);
  const pausePollUntilRef = useRef(0);
  const dataRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refresh = useCallback(async ({
    includeTeam = false,
    soft = false,
    force = false,
  } = {}) => {
    if (!eventId) return;
    if (!force && soft && Date.now() < pausePollUntilRef.current) return;
    if (force) pausePollUntilRef.current = 0;
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
      setPollError(null);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        setError('Session expired — open your team link again');
        setData(null);
        teamIdRef.current = null;
        teamMetaLoadedRef.current = false;
      } else if (soft) {
        setPollError(finalePlayerMessage(err) || 'Failed to refresh');
      } else {
        setError(finalePlayerMessage(err) || 'Failed to load finale');
        // Keep last good board — 500 / ROUND_LOCKED should never unmount mid-play
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
    pausePollUntilRef.current = Date.now() + 800;
    setData(next);
    setBurstUntil(Date.now() + 5000);
    setError(null);
    setPollError(null);
    return true;
  }, []);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setTeamMeta(null);
      setLoading(false);
      setError(null);
      setPollError(null);
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

  // Focus / visibility — pull while finale is open
  useEffect(() => {
    if (!eventId) return undefined;
    const kick = () => {
      const current = dataRef.current;
      const open = Boolean(
        current?.waitingForRelease
        || current?.activeMission
        || current?.entry?.activeMissionId
        || (current?.round?.status === 'live' && !current?.round?.closed),
      );
      if (!open) return;
      pausePollUntilRef.current = 0;
      void refresh({ includeTeam: false, soft: true, force: true });
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') kick();
    };
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [eventId, refresh]);

  return {
    data,
    teamMeta,
    teamId: teamIdRef.current || data?.entry?.teamId || null,
    loading,
    error,
    pollError,
    refresh: (opts) => {
      const safe = opts && typeof opts === 'object' && !opts.nativeEvent ? opts : {};
      return refresh({
        includeTeam: Boolean(safe.includeTeam),
        soft: true,
        force: Boolean(safe.force),
      });
    },
    applyActionData,
  };
}
