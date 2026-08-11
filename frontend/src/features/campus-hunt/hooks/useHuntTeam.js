import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyTeam, fetchTeamProgress } from '../services/campusHunt.api';

function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 2500;

  const stage = String(data?.team?.currentStage || '');
  const scheduledAt = data?.team?.scheduledStartAt
    ? new Date(data.team.scheduledStartAt).getTime()
    : 0;
  const waiting = ['WAITING', 'READY'].includes(data?.team?.startStatus);
  const nearRelease = waiting && scheduledAt > 0 && scheduledAt - Date.now() <= 2 * 60 * 1000;

  const cp = data?.checkpointStatus;
  const pendingFour =
    cp
    && cp.checkpointId
    && Number(cp.verifiedCount || 0) < Number(cp.requiredCount || 4);

  const activelyPlaying =
    stage.includes('ACTIVE')
    || stage.includes('COMPLETED')
    || stage.includes('FAILED')
    || stage.includes('TIMEOUT');

  // Soft intervals — snappy enough for 4-of-4 scan, light on the server
  if (nearRelease || pendingFour) return 3500;
  if (activelyPlaying && stage !== 'SCORE_LOCKED') return 6000;
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
 * @param {{ enabled?: boolean }} [options] — set enabled=false to pause polling (e.g. during Finale)
 */
export function useHuntTeam(eventId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId) && enabled);
  const [error, setError] = useState(null);
  const [burstUntil, setBurstUntil] = useState(0);
  const teamIdRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!eventId || !enabled) return;
    setError(null);
    try {
      const res = await fetchMyTeam(eventId);
      setData(res.data);
      teamIdRef.current = res.data?.team?.id || null;
    } catch (err) {
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        setError('Session expired — open your team link again');
      } else {
        setError(err.message || 'Failed to load team');
      }
      setData(null);
      teamIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled]);

  const refreshProgress = useCallback(async () => {
    if (!enabled) return;
    const teamId = teamIdRef.current;
    if (!teamId) return refresh();
    try {
      const res = await fetchTeamProgress(teamId);
      setData((prev) => ({
        ...res.data,
        rounds: res.data?.rounds || prev?.rounds,
        event: res.data?.event || prev?.event,
      }));
      teamIdRef.current = res.data?.team?.id || teamId;
    } catch (err) {
      setError(err.message || 'Failed to refresh');
    }
  }, [refresh, enabled]);

  /** Instant UI update from submit/scan response — no extra wait. */
  const applyActionData = useCallback((payload) => {
    const next = progressFromActionData(payload);
    if (!next) return false;
    setData((prev) => ({
      ...next,
      rounds: prev?.rounds,
      event: prev?.event,
    }));
    teamIdRef.current = next.team?.id || teamIdRef.current;
    setBurstUntil(Date.now() + 4000);
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
    burstUntil,
    refreshProgress,
  ]);

  return {
    data,
    loading,
    error,
    refresh,
    refreshProgress,
    applyActionData,
    setData,
  };
}
