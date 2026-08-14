import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFinaleMe,
  fetchMyTeam,
  openTeamProgressStream,
} from '../services/campusHunt.api';
import { finalePlayerMessage } from '../utils/finalePlayerMessage';

function pollIntervalMs(data, burstUntil) {
  if (burstUntil && Date.now() < burstUntil) return 1000;
  const active = Boolean(data?.activeMission || data?.entry?.activeMissionId);
  const waiting = Boolean(data?.waitingForRelease);
  const live = data?.round?.status === 'live' && !data?.round?.closed;
  if (active) return 1000;
  if (waiting) return 2000;
  // SSE is primary; keep a light safety poll while live
  if (live) return 3000;
  return 15000;
}

function finaleFingerprint(data) {
  if (!data?.entry) return '';
  const m = data.activeMission;
  const missions = Array.isArray(data.missions) ? data.missions : [];
  return [
    data.entry.id || data.entry._id,
    data.entry.status,
    data.entry.finaleScore,
    data.entry.activeMissionId,
    data.waitingForRelease ? 1 : 0,
    data.round?.status,
    m?.missionId,
    m?.status,
    m?.stepIndex,
    ...missions.map((x) => `${x.id || x.missionId}:${x.status}:${x.points ?? ''}`),
  ].join('|');
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
  const hardGenRef = useRef(0);
  const softGenRef = useRef(0);
  const pausePollUntilRef = useRef(0);
  const dataRef = useRef(null);
  const fingerprintRef = useRef('');
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
    fingerprintRef.current = finaleFingerprint(data);
    if (data?.entry) bootstrappedRef.current = true;
  }, [data]);

  const applyMerged = useCallback((next) => {
    const fp = finaleFingerprint(next);
    if (fp && fp === fingerprintRef.current) return;
    fingerprintRef.current = fp;
    setData(next);
  }, []);

  const refresh = useCallback(async ({
    includeTeam = false,
    soft = false,
    force = false,
  } = {}) => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    // Soft polls must not race the first board load.
    if (soft && !force && !bootstrappedRef.current) return;
    if (!force && soft && Date.now() < pausePollUntilRef.current) return;
    if (force) pausePollUntilRef.current = 0;

    const isHard = !soft || includeTeam;
    const gen = isHard ? ++hardGenRef.current : ++softGenRef.current;
    if (!soft) setError(null);
    try {
      const needTeam = includeTeam || !teamMetaLoadedRef.current;
      let nextData;
      if (needTeam) {
        const [teamRes, finaleRes] = await Promise.all([
          fetchMyTeam(eventId),
          fetchFinaleMe(eventId),
        ]);
        if (isHard ? gen !== hardGenRef.current : gen !== softGenRef.current) return;
        setTeamMeta(teamRes.data?.team || null);
        nextData = finaleRes.data;
        teamIdRef.current = teamRes.data?.team?.id || null;
        teamMetaLoadedRef.current = true;
      } else {
        const finaleRes = await fetchFinaleMe(eventId);
        if (isHard ? gen !== hardGenRef.current : gen !== softGenRef.current) return;
        nextData = finaleRes.data;
      }
      applyMerged(nextData);
      bootstrappedRef.current = Boolean(nextData?.entry);
      setError(null);
      setPollError(null);
    } catch (err) {
      if (isHard ? gen !== hardGenRef.current : gen !== softGenRef.current) return;
      if (err?.code === 'AUTH_401' || err?.status === 401) {
        if (soft && dataRef.current) {
          setPollError('Session issue — tap Refresh if the board looks stuck');
        } else {
          setError('Session expired — open your team link again');
          setData(null);
          teamIdRef.current = null;
          teamMetaLoadedRef.current = false;
          fingerprintRef.current = '';
          bootstrappedRef.current = false;
        }
      } else if (soft) {
        setPollError(finalePlayerMessage(err) || 'Failed to refresh');
      } else {
        setError(finalePlayerMessage(err) || 'Failed to load finale');
      }
    } finally {
      // Only the latest hard request may clear the spinner — never a stale one.
      if (isHard && gen === hardGenRef.current) {
        setLoading(false);
      }
    }
  }, [eventId, applyMerged]);

  const applyActionData = useCallback((payload) => {
    const next = finaleFromActionData(payload);
    if (!next) return false;
    softGenRef.current += 1;
    pausePollUntilRef.current = Date.now() + 800;
    applyMerged(next);
    setBurstUntil(Date.now() + 5000);
    setError(null);
    setPollError(null);
    return true;
  }, [applyMerged]);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setTeamMeta(null);
      setLoading(false);
      setError(null);
      setPollError(null);
      teamMetaLoadedRef.current = false;
      fingerprintRef.current = '';
      bootstrappedRef.current = false;
      return undefined;
    }
    // Silent revalidate when board already exists
    if (!dataRef.current) {
      bootstrappedRef.current = false;
      setLoading(true);
    }
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

  // Live SSE — admin release / teammate mission steps push → force finale board pull
  useEffect(() => {
    if (!eventId) return undefined;
    const teamId = teamIdRef.current
      || data?.entry?.teamId
      || teamMeta?.id
      || null;
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
                void refresh({ includeTeam: false, soft: true, force: true });
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
  }, [eventId, data?.entry?.teamId, teamMeta?.id, refresh]);

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
