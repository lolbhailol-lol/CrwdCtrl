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
  resetOfflineHuntLocal,
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
  submitStopJoinWord,
  tickTimers,
} from '../offlineEngine';
import { buildPlayData } from '../buildPlayData';
import {
  buildMemberProofPayload,
  buildPhoneBackupPayload,
  buildResultsPayload,
  buildTeamSyncPayload,
  isPhoneBackup,
  parseQrJson,
  verifyPayload,
} from '../offlineQr';
import {
  enqueueOfflineProgress,
  flushOfflineProgressQueue,
  offlineBoardPendingCount,
  rotateOfflineDeviceIdForTakeover,
} from '../offlineBoardSync';

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
  const [boardPending, setBoardPending] = useState(0);
  const [joinWord, setJoinWord] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [backupPayload, setBackupPayload] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [deviceBound, setDeviceBound] = useState(false);
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
    if (pack && nextSession.role === 'leader') {
      void enqueueOfflineProgress(pack, nextState).then((r) => {
        setBoardPending(offlineBoardPendingCount());
        if (r?.deviceBound) setDeviceBound(true);
        else if (r?.syncedOk) {
          setDeviceBound(false);
          setBoardPending(offlineBoardPendingCount());
        }
      });
    }
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
    setBoardPending(offlineBoardPendingCount());
    const onOnline = () => {
      const pack = bundleRef.current;
      if (pack) {
        void flushOfflineProgressQueue(pack).then((r) => {
          setBoardPending(offlineBoardPendingCount());
          if (r?.deviceBound) setDeviceBound(true);
          else if (r?.syncedOk) setDeviceBound(false);
        });
      }
    };
    window.addEventListener('online', onOnline);
    return () => {
      disarm();
      window.removeEventListener('online', onOnline);
    };
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
        const backup = session.role === 'leader'
          ? await buildPhoneBackupPayload({ bundle, state, session })
          : null;
        if (cancelled) return;
        setTeamSyncPayload(JSON.stringify(sync));
        setResultsPayload(JSON.stringify(results));
        if (backup) setBackupPayload(JSON.stringify(backup));
        else setBackupPayload('');
        const key = pendingCheckpointKey(state.currentStage);
        const youScanned = Boolean(
          state.checkpoints?.[key]?.scans?.[session.memberKey]
          || state.checkpoints?.[key]?.scans?.leader
          || session.localPosterScans?.[String(key)],
        );
        if (key && youScanned && session.role !== 'leader') {
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

  const onSubmitJoinWord = async () => {
    setJoinMsg('');
    try {
      const result = submitStopJoinWord(
        bundleRef.current,
        sessionRef.current,
        stateRef.current,
        joinWord,
      );
      await persistState(result.state, sessionRef.current);
      setJoinMsg(result.meta?.message || '');
      if (result.meta?.correct) setJoinWord('');
    } catch (err) {
      setJoinMsg(err.message || 'Could not submit word');
    }
  };

  const onResetHunt = async () => {
    if (!window.confirm('Reset this team’s hunt progress on this phone? (Pack stays installed.)')) {
      return;
    }
    await resetOfflineHuntLocal(session.teamCode);
    navigate(CAMPUS_HUNT_PATHS.offlineLogin);
  };

  const onRestoreBackup = async (raw) => {
    setRestoreMsg('');
    try {
      const payload = parseQrJson(raw) || (typeof raw === 'object' ? raw : null);
      if (!isPhoneBackup(payload)) throw new Error('Not a phone backup QR');
      const ok = await verifyPayload(bundle.signingKey, payload);
      if (!ok) throw new Error('Backup signature invalid');
      if (String(payload.team) !== String(bundle.team.teamCode)) {
        throw new Error('Backup is for a different team');
      }
      await saveOfflineTeamState(bundle.team.teamCode, payload.state);
      if (payload.session) {
        await saveOfflineSession({
          ...payload.session,
          teamCode: bundle.team.teamCode,
        });
      }
      rotateOfflineDeviceIdForTakeover();
      setRestoreMsg('Restored — this phone will take over board sync. Reloading…');
      window.location.reload();
    } catch (err) {
      setRestoreMsg(err.message || 'Restore failed');
    }
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
          onBackToRounds={() => navigate(CAMPUS_HUNT_PATHS.offlineRounds)}
          onSwitchPerson={() => navigate(CAMPUS_HUNT_PATHS.offlineTeam)}
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
          onePhoneMode
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
        onLeaveRound={() => navigate(CAMPUS_HUNT_PATHS.offlineRounds)}
        actions={actions}
        offlineMode
        roundLabel="Offline Round 1 · airplane mode"
        backTo={CAMPUS_HUNT_PATHS.offlineRounds}
        backLabel="← Rounds"
        checkpointExtra={
          session.role === 'leader' && cp?.needJoinWord ? (
            <div className="mt-3 space-y-2 rounded-xl border border-[#0ECCEE]/30 bg-[#0a1218] p-3 text-left">
              <p className="text-xs font-semibold text-[#0ECCEE]">Join the word</p>
              <p className="text-[11px] text-white/60">
                Find
                {' '}
                {cp.plantFragmentCount || 'the'}
                {' '}
                written clues at this stop, join them into one word, then type it.
                Scan unlocks after a correct word.
              </p>
              <div className="flex gap-2">
                <input
                  value={joinWord}
                  onChange={(e) => setJoinWord(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Joined word"
                />
                <button
                  type="button"
                  onClick={onSubmitJoinWord}
                  className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-xs font-bold text-black"
                >
                  Submit
                </button>
              </div>
              {joinMsg ? <p className="text-[11px] text-emerald-300">{joinMsg}</p> : null}
            </div>
          ) : session.role === 'leader' && cp && !cp.awaitingTeamCodeConfirm ? (
            <p className="text-center text-xs text-white/55">
              Scan the place QR once, then enter your team code.
            </p>
          ) : null
        }
      />
      {(boardPending > 0 || session.role === 'leader') && (
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px] text-white/70">
          <span>
            {boardPending > 0
              ? `Board pending · ${boardPending}`
              : 'Board sync ready'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-white/10 px-2 py-1 font-semibold"
              onClick={() => {
                void flushOfflineProgressQueue(bundle).then((r) => {
                  setBoardPending(offlineBoardPendingCount());
                  if (r?.deviceBound) setDeviceBound(true);
                  else setDeviceBound(false);
                });
              }}
            >
              Retry sync
            </button>
            {deviceBound ? (
              <button
                type="button"
                className="rounded bg-amber-400/20 px-2 py-1 font-semibold text-amber-100"
                onClick={() => {
                  rotateOfflineDeviceIdForTakeover();
                  setDeviceBound(false);
                  void flushOfflineProgressQueue(bundle).then((r) => {
                    setBoardPending(offlineBoardPendingCount());
                    if (r?.deviceBound) setDeviceBound(true);
                    else setDeviceBound(false);
                  });
                }}
              >
                Take over phone
              </button>
            ) : null}
            <button
              type="button"
              className="rounded bg-white/10 px-2 py-1 font-semibold"
              onClick={onResetHunt}
            >
              Reset hunt
            </button>
          </div>
        </div>
      )}
      {session.role === 'leader' && backupPayload ? (
        <details className="mx-auto max-w-lg px-4 pb-2 text-white">
          <summary className="cursor-pointer text-xs font-semibold text-white/80">
            Phone dies? Backup / restore
          </summary>
          <textarea
            readOnly
            value={backupPayload}
            className="mt-2 h-16 w-full rounded bg-black/40 p-2 font-mono text-[9px] text-white/70"
          />
          <textarea
            className="mt-2 h-14 w-full rounded border border-white/15 bg-black/40 p-2 font-mono text-[10px]"
            placeholder="Paste backup JSON to restore…"
            onBlur={(e) => {
              const text = e.target.value.trim();
              if (text) onRestoreBackup(text);
            }}
          />
          {restoreMsg ? <p className="mt-1 text-[11px] text-[#0ECCEE]">{restoreMsg}</p> : null}
        </details>
      ) : null}
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
        onePhoneMode
      />
    </div>
  );
}
