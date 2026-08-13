import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyTeam, fetchTeamProgress } from '../services/campusHunt.api';

function isActivelyPlaying(data) {
  const stage = String(data?.team?.currentStage || '');
  if (!stage || stage === 'SCORE_LOCKED') return false;
  return (
    stage.includes('ACTIVE')
    || stage.includes('COMPLETED')
    || stage.includes('FAILED')
    || stage.includes('TIMEOUT')
  );
}

function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 1000;

  const stage = String(data?.team?.currentStage || '');
  const scheduledAt = data?.team?.scheduledStartAt
    ? new Date(data.team.scheduledStartAt).getTime()
    : 0;
  const waiting = ['WAITING', 'READY'].includes(data?.team?.startStatus);
  const nearRelease = waiting && scheduledAt > 0 && scheduledAt - Date.now() <= 2 * 60 * 1000;

  const cp = data?.checkpointStatus;
  const pendingScan =
    cp
    && cp.checkpointId
    && Number(cp.verifiedCount || 0) < Number(cp.requiredCount || data?.team?.teamSize || 4);
  const awaitingClaim = Boolean(cp?.awaitingTeamCodeConfirm);

  // Near-live while anyone on the team can change the board
  if (pendingScan || awaitingClaim || isActivelyPlaying(data)) return 1000;
  if (nearRelease) return 2000;
  if (stage === 'SCORE_LOCKED') return 15000;
  return 15000;
}

/** Normalize mutation / progress payloads into play-screen state. */
export function progressFromActionData(payload) {
  if (!payload?.team || !Array.isArray(payload.challenges)) return null;
  return {
    team: payload.team,
    challenges: payload.challenges,
    checkpointStatus: payload.checkpointStatus ?? null,
    serverTime: payload.serverTime || new Date().toISOString(),
  };
}

/**
 * @param {string|null} eventId
 * @param {{ enabled?: boolean }} [options] — set enabled=false to pause polling
 */
export function useHuntTeam(eventId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId) && enabled);
  const [error, setError] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [burstUntil, setBurstUntil] = useState(0);
  const teamIdRef = useRef(null);
  const fetchGenRef = useRef(0);
  const pausePollUntilRef = useRef(0);
  const dataRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refresh = useCallback(async ({ soft = false } = {}) => {
    if (!eventId || !enabled) return;
    const gen = ++fetchGenRef.current;
    if (!soft) setError(null);
    try {
      const res = await fetchMyTeam(eventId);
      if (gen !== fetchGenRef.current) return;
      setData(res.data);
      teamIdRef.current = res.data?.team?.id || null;
      setError(null);
      setPollError(null);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        setError('Session expired — open your team link again');
        setData(null);
        teamIdRef.current = null;
      } else if (soft) {
        setPollError(err.message || 'Failed to refresh');
      } else {
        setError(err.message || 'Failed to load team');
        // Soft poll / mid-play failure: keep last board (never flash "No team")
      }
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [eventId, enabled]);

  /**
   * Soft progress poll. Interval calls skip during pausePollUntil;
   * manual Refresh passes `{ force: true }` and always runs.
   */
  const refreshProgress = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    if (!force && Date.now() < pausePollUntilRef.current) return;
    if (force) pausePollUntilRef.current = 0;
    const teamId = teamIdRef.current;
    if (!teamId) return refresh({ soft: true });
    const gen = ++fetchGenRef.current;
    try {
      const res = await fetchTeamProgress(teamId);
      if (gen !== fetchGenRef.current) return;
      setData((prev) => ({
        ...res.data,
        rounds: res.data?.rounds || prev?.rounds,
        event: res.data?.event || prev?.event,
      }));
      teamIdRef.current = res.data?.team?.id || teamId;
      setError(null);
      setPollError(null);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      setPollError(err.message || 'Failed to refresh');
    }
  }, [refresh, enabled]);

  /** Instant UI update from submit/scan response — no extra wait. */
  const applyActionData = useCallback((payload) => {
    const next = progressFromActionData(payload);
    if (!next) return false;
    fetchGenRef.current += 1;
    const cp = next.checkpointStatus;
    const pendingScan = Boolean(
      cp?.checkpointId
      && Number(cp.verifiedCount || 0) < Number(cp.requiredCount || next.team?.teamSize || 4),
    );
    // Pause only the interval — manual force refresh still works
    pausePollUntilRef.current = Date.now() + (pendingScan ? 350 : 800);
    setData((prev) => ({
      ...next,
      rounds: prev?.rounds,
      event: prev?.event,
    }));
    teamIdRef.current = next.team?.id || teamIdRef.current;
    setBurstUntil(Date.now() + (pendingScan ? 8000 : 5000));
    setError(null);
    setPollError(null);
    return true;
  }, []);

  useEffect(() => {
    if (!eventId || !enabled) {
      if (!enabled) setLoading(false);
      return undefined;
    }
    setLoading(true);
    refresh();
    return undefined;
  }, [refresh, eventId, enabled]);

  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    const pollMs = pollIntervalMs(data, burstUntil);
    const id = setInterval(() => {
      if (Date.now() < pausePollUntilRef.current) return;
      refreshProgress();
    }, pollMs);
    return () => clearInterval(id);
  }, [
    enabled,
    eventId,
    data?.team?.scheduledStartAt,
    data?.team?.startStatus,
    data?.team?.currentStage,
    data?.checkpointStatus?.verifiedCount,
    data?.checkpointStatus?.requiredCount,
    data?.checkpointStatus?.checkpointId,
    data?.checkpointStatus?.awaitingTeamCodeConfirm,
    burstUntil,
    refreshProgress,
  ]);

  // Focus / visibility — always pull while Round 1 is open
  useEffect(() => {
    if (!eventId || !enabled) return undefined;
    const kick = () => {
      const current = dataRef.current;
      const stage = String(current?.team?.currentStage || '');
      const waiting = ['WAITING', 'READY'].includes(current?.team?.startStatus);
      const open = waiting || isActivelyPlaying(current) || stage === 'SCORE_LOCKED';
      if (!open && !current?.checkpointStatus?.checkpointId) return;
      pausePollUntilRef.current = 0;
      void refreshProgress({ force: true });
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
  }, [eventId, enabled, refreshProgress]);

  return {
    data,
    loading,
    error,
    pollError,
    refresh: () => refresh({ soft: true }),
    refreshProgress,
    applyActionData,
    setData,
  };
}
