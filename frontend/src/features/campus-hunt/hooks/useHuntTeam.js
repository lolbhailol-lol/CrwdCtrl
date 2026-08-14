import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchMyTeam,
  fetchTeamProgress,
  openTeamProgressStream,
} from '../services/campusHunt.api';

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

function isPendingScan(data) {
  const cp = data?.checkpointStatus;
  return Boolean(
    cp
    && cp.checkpointId
    && Number(cp.verifiedCount || 0) < Number(cp.requiredCount || data?.team?.teamSize || 4),
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
  const awaitingClaim = Boolean(data?.checkpointStatus?.awaitingTeamCodeConfirm);

  // Fast only while teammates may still be scanning / claiming
  if (isPendingScan(data) || awaitingClaim) return 1000;
  if (nearRelease) return 2000;
  // Safety net while playing (SSE is primary)
  if (isActivelyPlaying(data)) return 3000;
  if (stage === 'SCORE_LOCKED') return 15000;
  return 15000;
}

function progressFingerprint(data) {
  if (!data?.team) return '';
  const cp = data.checkpointStatus;
  const challenges = Array.isArray(data.challenges) ? data.challenges : [];
  return [
    data.team.id,
    data.team.currentStage,
    data.team.startStatus,
    data.team.currentScore,
    data.team.scheduledStartAt,
    cp?.checkpointId || '',
    cp?.verifiedCount ?? '',
    cp?.requiredCount ?? '',
    cp?.awaitingTeamCodeConfirm ? 1 : 0,
    cp?.youScanned ? 1 : 0,
    cp?.status || '',
    ...challenges.map((c) => `${c.number}:${c.state}:${c.attemptsLeft ?? c.attempts ?? ''}`),
  ].join('|');
}

function stageNeedsCheckpoint(stage) {
  const s = String(stage || '');
  if (!s || s === 'SCORE_LOCKED' || s === 'FINISH_COMPLETED') return false;
  if (s.includes('CLUE_5_')) return false;
  return s.includes('COMPLETED') || s.includes('FAILED') || s.includes('TIMEOUT');
}

/** Keep last checkpoint panel if soft poll briefly returns null on same stage. */
function mergeProgress(prev, next) {
  if (!next?.team) return prev;
  let { checkpointStatus } = next;
  if (
    checkpointStatus == null
    && prev?.checkpointStatus?.checkpointId
    && String(prev?.team?.currentStage || '') === String(next.team.currentStage || '')
    && stageNeedsCheckpoint(next.team.currentStage)
  ) {
    checkpointStatus = prev.checkpointStatus;
  }
  return {
    ...next,
    checkpointStatus: checkpointStatus ?? null,
    rounds: next.rounds || prev?.rounds,
    event: next.event || prev?.event,
  };
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
  /** Full /me/team loads — soft progress must not invalidate these. */
  const hardGenRef = useRef(0);
  /** Lightweight /progress polls only. */
  const softGenRef = useRef(0);
  const pausePollUntilRef = useRef(0);
  const dataRef = useRef(null);
  const fingerprintRef = useRef('');
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
    fingerprintRef.current = progressFingerprint(data);
    if (data?.team?.id && Array.isArray(data?.rounds)) {
      bootstrappedRef.current = true;
    }
  }, [data]);

  const applyMerged = useCallback((incoming, { soft = false } = {}) => {
    // Never let a progress poll become the first board — it has no rounds/event.
    if (soft && !bootstrappedRef.current && !dataRef.current?.rounds) {
      return;
    }
    const merged = soft
      ? mergeProgress(dataRef.current, incoming)
      : {
        ...incoming,
        rounds: incoming?.rounds || dataRef.current?.rounds,
        event: incoming?.event || dataRef.current?.event,
      };
    const nextFp = progressFingerprint(merged);
    if (nextFp && nextFp === fingerprintRef.current) return;
    fingerprintRef.current = nextFp;
    setData(merged);
  }, []);

  const refresh = useCallback(async ({ soft = false } = {}) => {
    if (!eventId || !enabled) {
      setLoading(false);
      return;
    }
    const gen = ++hardGenRef.current;
    if (!soft) setError(null);
    try {
      const res = await fetchMyTeam(eventId);
      if (gen !== hardGenRef.current) return;
      applyMerged(res.data, { soft: false });
      teamIdRef.current = res.data?.team?.id || null;
      bootstrappedRef.current = Boolean(res.data?.team?.id && Array.isArray(res.data?.rounds));
      setError(null);
      setPollError(null);
    } catch (err) {
      if (gen !== hardGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        // Soft mid-play: keep board; hard first-load can clear
        if (soft && dataRef.current) {
          setPollError('Session issue — tap Refresh if the board looks stuck');
        } else {
          setError('Session expired — open your team link again');
          setData(null);
          teamIdRef.current = null;
          fingerprintRef.current = '';
          bootstrappedRef.current = false;
        }
      } else if (soft) {
        setPollError(err.message || 'Failed to refresh');
      } else {
        setError(err.message || 'Failed to load team');
      }
    } finally {
      // Always clear the enter/load spinner for this hard request (or a newer one).
      if (gen === hardGenRef.current || bootstrappedRef.current) {
        setLoading(false);
      }
    }
  }, [eventId, enabled, applyMerged]);

  /**
   * Soft progress poll. Interval calls skip during pausePollUntil;
   * manual Refresh passes `{ force: true }` and always runs.
   * Uses softGenRef so it never cancels the initial /me/team bootstrap.
   */
  const refreshProgress = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    if (!force && Date.now() < pausePollUntilRef.current) return;
    if (force) pausePollUntilRef.current = 0;
    const teamId = teamIdRef.current;
    // Don't race another /me/team while the enter bootstrap is still loading.
    if (!bootstrappedRef.current) {
      if (force) return refresh({ soft: false });
      return undefined;
    }
    if (!teamId) return refresh({ soft: true });
    const gen = ++softGenRef.current;
    try {
      const res = await fetchTeamProgress(teamId);
      if (gen !== softGenRef.current) return;
      applyMerged(res.data, { soft: !force });
      teamIdRef.current = res.data?.team?.id || teamId;
      setError(null);
      setPollError(null);
    } catch (err) {
      if (gen !== softGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        if (dataRef.current) {
          setPollError('Session issue — tap Refresh if the board looks stuck');
        } else {
          setError('Session expired — open your team link again');
        }
      } else {
        setPollError(err.message || 'Failed to refresh');
      }
    }
  }, [refresh, enabled, applyMerged]);

  /** Instant UI update from submit/scan response — no extra wait. */
  const applyActionData = useCallback((payload) => {
    const next = progressFromActionData(payload);
    if (!next) return false;
    softGenRef.current += 1;
    const cp = next.checkpointStatus;
    const pendingScan = Boolean(
      cp?.checkpointId
      && Number(cp.verifiedCount || 0) < Number(cp.requiredCount || next.team?.teamSize || 4),
    );
    pausePollUntilRef.current = Date.now() + (pendingScan ? 350 : 800);
    applyMerged({
      ...next,
      rounds: dataRef.current?.rounds,
      event: dataRef.current?.event,
    }, { soft: false });
    teamIdRef.current = next.team?.id || teamIdRef.current;
    setBurstUntil(Date.now() + (pendingScan ? 8000 : 5000));
    setError(null);
    setPollError(null);
    return true;
  }, [applyMerged]);

  useEffect(() => {
    if (!eventId || !enabled) {
      setLoading(false);
      return undefined;
    }
    // Silent revalidate when board already exists — no full-page loading flash
    if (!dataRef.current) {
      bootstrappedRef.current = false;
      setLoading(true);
    }
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

  // Live SSE — admin/teammate mutations push a ping → force progress pull
  useEffect(() => {
    if (!enabled || !eventId) return undefined;
    const teamId = data?.team?.id || teamIdRef.current;
    if (!teamId) return undefined;

    const ac = new AbortController();
    let cancelled = false;
    let retryTimer = null;

    const connect = async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await openTeamProgressStream(teamId, {
            signal: ac.signal,
            onEvent: (evt) => {
              if (evt?.type === 'progress') {
                pausePollUntilRef.current = 0;
                void refreshProgress({ force: true });
              }
            },
          });
        } catch (err) {
          if (cancelled || ac.signal.aborted || err?.name === 'AbortError') return;
        }
        if (cancelled || ac.signal.aborted) return;
        await new Promise((resolve) => {
          retryTimer = setTimeout(resolve, 2500);
        });
      }
    };

    void connect();
    return () => {
      cancelled = true;
      ac.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, eventId, data?.team?.id, refreshProgress]);

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
    refresh: (opts) => {
      const hard = Boolean(opts && typeof opts === 'object' && (opts.force || opts.soft === false));
      return refresh({ soft: !hard });
    },
    refreshProgress,
    applyActionData,
    setData,
  };
}
