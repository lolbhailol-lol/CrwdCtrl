import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PlayerPlayScreen from '../../player/PlayerPlayScreen';
import OfflineHandoffDock from '../components/OfflineHandoffDock';
import OfflineScoreBoard from '../components/OfflineScoreBoard';
import { CAMPUS_HUNT_PATHS } from '../../config';
import {
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
  saveOfflineSession,
  saveOfflineTeamState,
  appendOfflinePlayLog,
} from '../offlineDb';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntBriefing from '../components/OfflineHuntBriefing';
import {
  applyTeamSync,
  collectMemberProof,
  confirmStation,
  ensureClueActive,
  hydrateState,
  isHuntWaiting,
  markReachedStart,
  pendingCheckpointKey,
  requestHint,
  scanStation,
  startHunt,
  submitAnswer,
  tickTimers,
} from '../offlineEngine';
import { buildPlayData } from '../buildPlayData';
import {
  buildMemberProofPayload,
  buildResultsPayload,
  buildTeamSyncPayload,
} from '../offlineQr';

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function OfflineHuntPlayPage() {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [session, setSession] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playData, setPlayData] = useState(null);
  const [proofPayload, setProofPayload] = useState('');
  const [teamSyncPayload, setTeamSyncPayload] = useState('');
  const [resultsPayload, setResultsPayload] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const stateRef = useRef(null);
  const sessionRef = useRef(null);
  const bundleRef = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { bundleRef.current = bundle; }, [bundle]);

  const persistState = useCallback(async (nextState, nextSession = sessionRef.current) => {
    if (!nextState || !nextSession) return nextState;
    await saveOfflineTeamState(nextSession.teamCode, nextState);
    stateRef.current = nextState;
    setState(nextState);
    const pack = bundleRef.current;
    if (pack) setPlayData(buildPlayData(pack, nextSession, nextState));
    void appendOfflinePlayLog({
      teamCode: nextSession.teamCode,
      action: 'state',
      payload: { stage: nextState.currentStage, score: nextState.score, seq: nextState.seq },
    });
    return nextState;
  }, []);

  const persistSession = useCallback(async (nextSession) => {
    await saveOfflineSession(nextSession);
    sessionRef.current = nextSession;
    setSession(nextSession);
    const pack = bundleRef.current;
    const st = stateRef.current;
    if (pack && st) setPlayData(buildPlayData(pack, nextSession, st));
    return nextSession;
  }, []);

  const refresh = useCallback(async () => {
    if (!bundle || !session || !state) return null;
    let next = isHuntWaiting(state)
      ? state
      : tickTimers(bundle, ensureClueActive(bundle, state), new Date());
    if (next.seq !== state.seq || next.currentStage !== state.currentStage) {
      await persistState(next, session);
    } else {
      setPlayData(buildPlayData(bundle, session, next));
    }
    return buildPlayData(bundle, session, next);
  }, [bundle, session, state, persistState]);

  useEffect(() => {
    const disarm = armOfflineNetworkGuard();
    return () => disarm();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pack, sess] = await Promise.all([
          loadOfflineBundle(),
          loadOfflineSession(),
        ]);
        if (cancelled) return;
        if (!pack || !sess) {
          setLoading(false);
          return;
        }
        let teamState = await loadOfflineTeamState(sess.teamCode);
        teamState = hydrateState(pack, teamState);
        if (!isHuntWaiting(teamState)) {
          teamState = tickTimers(pack, ensureClueActive(pack, teamState), new Date());
        }
        await saveOfflineTeamState(sess.teamCode, teamState);
        if (cancelled) return;
        setBundle(pack);
        setSession(sess);
        setState(teamState);
        setPlayData(buildPlayData(pack, sess, teamState));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!bundle || !session || !state) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const sync = await buildTeamSyncPayload({ bundle, state });
        const results = await buildResultsPayload({ bundle, state });
        if (cancelled) return;
        setTeamSyncPayload(JSON.stringify(sync));
        setResultsPayload(JSON.stringify(results));
        const key = pendingCheckpointKey(state.currentStage);
        const youScanned = Boolean(
          state.checkpoints?.[key]?.scans?.[session.memberKey]
          || session.localPosterScans?.[String(key)],
        );
        if (key && youScanned) {
          const expected = bundle.route?.[
            { 1: 'orange', 2: 'green', 3: 'blue', 4: 'purple' }[key]
          ];
          const proof = await buildMemberProofPayload({
            bundle,
            session,
            checkpointKey: key,
            checkpointId: expected?.id,
          });
          if (!cancelled) setProofPayload(JSON.stringify(proof));
        } else if (!cancelled) {
          setProofPayload('');
        }
      } catch {
        /* QR draw is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [bundle, session, state]);

  const applyResult = useCallback((resData) => {
    if (!resData?.team) return false;
    setPlayData((prev) => ({ ...prev, ...resData }));
    return true;
  }, []);

  const wrapEngine = useCallback(async (run) => {
    const pack = bundleRef.current;
    const sess = sessionRef.current;
    const result = await run(pack, sess, stateRef.current);
    await persistState(result.state, sess);
    const data = {
      ...buildPlayData(pack, sess, result.state),
      ...result.meta,
    };
    return { data };
  }, [persistState]);

  const actions = useMemo(() => ({
    submitChallengeAnswer: async (_teamId, challengeNumber, answer) => (
      wrapEngine((pack, sess, st) => submitAnswer(pack, sess, st, challengeNumber, answer))
    ),
    requestChallengeHint: async (_teamId, challengeNumber) => (
      wrapEngine((pack, sess, st) => requestHint(pack, sess, st, challengeNumber))
    ),
    scanStationCheckpoint: async (_teamId, raw) => {
      const pack = bundleRef.current;
      const sess = sessionRef.current;
      const result = scanStation(pack, sess, stateRef.current, raw);
      const key = result.localScanKey;
      let nextSession = sess;
      if (key) {
        nextSession = {
          ...sess,
          localPosterScans: {
            ...(sess.localPosterScans || {}),
            [String(key)]: true,
          },
        };
        sessionRef.current = nextSession;
        await persistSession(nextSession);
      }
      await persistState(result.state, nextSession);
      return {
        data: {
          ...buildPlayData(pack, nextSession, result.state),
          ...result.meta,
        },
      };
    },
    confirmStationCheckpoint: async (_teamId, body) => (
      wrapEngine((pack, sess, st) => confirmStation(pack, sess, st, body?.teamCode))
    ),
  }), [wrapEngine, persistState, persistSession]);

  const onCollectProof = async (raw) => {
    const result = await collectMemberProof(
      bundleRef.current,
      sessionRef.current,
      stateRef.current,
      raw,
    );
    await persistState(result.state, sessionRef.current);
  };

  const onScanTeamSync = async (raw) => {
    const result = await applyTeamSync(bundleRef.current, stateRef.current, raw);
    await persistState(result.state, sessionRef.current);
  };

  const onStartHunt = async () => {
    setStartError('');
    setStarting(true);
    try {
      const result = startHunt(bundleRef.current, sessionRef.current, stateRef.current);
      await persistState(result.state, sessionRef.current);
    } catch (err) {
      setStartError(err.message || 'Could not start the hunt');
    } finally {
      setStarting(false);
    }
  };

  const onMarkReached = async () => {
    const result = markReachedStart(bundleRef.current, sessionRef.current, stateRef.current);
    await persistState(result.state, sessionRef.current);
  };

  const onDownloadResults = async () => {
    const payload = resultsPayload
      ? JSON.parse(resultsPayload)
      : await buildResultsPayload({ bundle, state });
    downloadJson(
      `${bundle.team.teamCode}.offline.results.json`,
      payload,
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading hunt…
      </div>
    );
  }

  if (!bundle || !session || !state || !playData) {
    return <Navigate to={CAMPUS_HUNT_PATHS.offlineLogin} replace />;
  }

  const cp = playData.checkpointStatus;
  const stage = state.currentStage;
  const waiting = isHuntWaiting(state);
  const atStartReport = stage === 'CLUE_5_COMPLETED' || stage === 'CLUE_5_FAILED';
  const locked = stage === 'SCORE_LOCKED' || stage === 'FINISH_COMPLETED';

  if (waiting) {
    return (
      <>
        <OfflineHuntBriefing
          bundle={bundle}
          session={session}
          state={state}
          onStartHunt={onStartHunt}
          starting={starting}
          error={startError}
          onSwitchPerson={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
        />
        <OfflineHandoffDock
          isLeader={session.role === 'leader'}
          waiting
          atCheckpoint={false}
          youScanned={false}
          awaitingConfirm={false}
          atStartReport={false}
          locked={false}
          proofPayload=""
          teamSyncPayload={teamSyncPayload}
          resultsPayload=""
          onCollectProof={onCollectProof}
          onScanTeamSync={onScanTeamSync}
          onMarkReached={onMarkReached}
          onDownloadResults={onDownloadResults}
        />
      </>
    );
  }

  return (
    <div className="pb-28">
      <PlayerPlayScreen
        data={playData}
        onRefresh={refresh}
        onActionResult={applyResult}
        eventSlug={bundle.event.slug}
        onLeaveRound={() => navigate(CAMPUS_HUNT_PATHS.offlineLogin)}
        actions={actions}
        offlineMode
        roundLabel="Offline Round 1 · airplane mode"
        backTo={CAMPUS_HUNT_PATHS.offlineLogin}
        backLabel="← Switch person"
        checkpointExtra={
          session.role !== 'leader' && cp?.youScanned ? (
            <p className="text-center text-xs text-white/55">
              Open <strong className="text-white">My proof QR</strong> below so your leader can collect you.
            </p>
          ) : session.role === 'leader' && cp && !cp.awaitingTeamCodeConfirm ? (
            <p className="text-center text-xs text-white/55">
              Use <strong className="text-white">Collect proofs</strong> to scan each teammate’s screen.
            </p>
          ) : null
        }
      />
      <div className="mx-auto max-w-lg px-4 pb-4">
        <OfflineScoreBoard
          state={state}
          teamCode={bundle.team.teamCode}
          teamName={bundle.team.teamName}
        />
      </div>
      <OfflineHandoffDock
        isLeader={session.role === 'leader'}
        atCheckpoint={Boolean(cp)}
        youScanned={Boolean(cp?.youScanned)}
        awaitingConfirm={Boolean(cp?.awaitingTeamCodeConfirm)}
        atStartReport={atStartReport}
        locked={locked}
        proofPayload={proofPayload}
        teamSyncPayload={teamSyncPayload}
        resultsPayload={resultsPayload}
        onCollectProof={onCollectProof}
        onScanTeamSync={onScanTeamSync}
        onMarkReached={onMarkReached}
        onDownloadResults={onDownloadResults}
      />
    </div>
  );
}
