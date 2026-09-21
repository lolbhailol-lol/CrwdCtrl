import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PlayerPlayScreen from '../../player/PlayerPlayScreen';
import OfflineHandoffDock from '../components/OfflineHandoffDock';
import { CAMPUS_HUNT_PATHS } from '../../config';
import {
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
  saveOfflineBundle,
  saveOfflineSession,
  saveOfflineTeamState,
  appendOfflinePlayLog,
} from '../offlineDb';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';
import OfflineHuntBriefing from '../components/OfflineHuntBriefing';
import { startOverHunt, applyServerStartOverIfNeeded } from '../startOverHunt';
import {
  confirmStation,
  ensureClueActive,
  healOnePhoneStation,
  hydrateState,
  isHuntWaiting,
  markReachedStart,
  requestHint,
  scanStation,
  startHunt,
  submitAnswer,
  submitStopJoinWord,
  tickTimers,
} from '../offlineEngine';
import { buildPlayData } from '../buildPlayData';
import {
  buildPhoneBackupPayload,
  buildResultsPayload,
  isPhoneBackup,
  parseQrJson,
  verifyPayload,
} from '../offlineQr';
import {
  enqueueOfflineProgress,
  flushOfflineProgressQueue,
  offlineBoardPendingCount,
  isOfflineBoardSyncPaused,
  rotateOfflineDeviceIdForTakeover,
  ensureOfflineGridKey,
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
  const [resultsPayload, setResultsPayload] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const [boardPending, setBoardPending] = useState(0);
  const [joinWord, setJoinWord] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const [backupPayload, setBackupPayload] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [deviceBound, setDeviceBound] = useState(false);
  const [resetting, setResetting] = useState(false);
  const stateRef = useRef(null);
  const sessionRef = useRef(null);
  const bundleRef = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { bundleRef.current = bundle; }, [bundle]);

  const persistState = useCallback(async (nextState, nextSession = sessionRef.current, opts = {}) => {
    if (!nextState || !nextSession) return nextState;
    const prev = stateRef.current;
    const stageChanged = !prev || prev.currentStage !== nextState.currentStage;
    const scoreChanged = !prev || Number(prev.score) !== Number(nextState.score);
    const shouldBoardSync = opts.syncBoard !== false && (stageChanged || scoreChanged);

    await saveOfflineTeamState(nextSession.teamCode, nextState);
    stateRef.current = nextState;
    setState(nextState);
    const pack = bundleRef.current;
    if (pack) setPlayData(buildPlayData(pack, nextSession, nextState));

    if (stageChanged || scoreChanged) {
      void appendOfflinePlayLog({
        teamCode: nextSession.teamCode,
        action: 'state',
        payload: { stage: nextState.currentStage, score: nextState.score, seq: nextState.seq },
      });
    }

    if (pack && nextSession.role === 'leader' && shouldBoardSync) {
      void enqueueOfflineProgress(pack, nextState).then(async (r) => {
        setBoardPending(offlineBoardPendingCount());
        if (r?.deviceBound) setDeviceBound(true);
        else if (r?.syncedOk) {
          setDeviceBound(false);
          setBoardPending(offlineBoardPendingCount());
          // Keep local seq aligned after STALE recovery so future pushes stay ahead.
          if (r?.seqRecovered && stateRef.current) {
            const aligned = { ...stateRef.current, seq: Number(r.seqRecovered) };
            stateRef.current = aligned;
            setState(aligned);
            await saveOfflineTeamState(nextSession.teamCode, aligned);
          }
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
    const pack = bundleRef.current;
    const sess = sessionRef.current;
    const st = stateRef.current;
    if (!pack || !sess || !st) return null;
    let next = isHuntWaiting(st)
      ? st
      : tickTimers(pack, ensureClueActive(pack, st), new Date());
    if (!isHuntWaiting(next)) {
      const healed = healOnePhoneStation(pack, sess, next);
      if (healed.healed) next = healed.state;
    }
    // Never rebuild from a stale React closure — that rewound clues after solve/scan.
    if (next.seq !== st.seq || next.currentStage !== st.currentStage) {
      const stageOrScore = next.currentStage !== st.currentStage
        || Number(next.score) !== Number(st.score);
      // Timer soft-reveal: no board push. One-phone heal that unlocks: push.
      await persistState(next, sess, { syncBoard: stageOrScore });
    } else {
      setPlayData(buildPlayData(pack, sess, next));
    }
    return buildPlayData(pack, sess, next);
  }, [persistState]);

  useEffect(() => {
    const disarm = armOfflineNetworkGuard();
    setBoardPending(offlineBoardPendingCount());

    const pushBoard = () => {
      if (isOfflineBoardSyncPaused()) return;
      const pack = bundleRef.current;
      const sess = sessionRef.current;
      const st = stateRef.current;
      if (!pack || !sess || sess.role !== 'leader' || !st) return;
      void enqueueOfflineProgress(pack, st).then((r) => {
        setBoardPending(offlineBoardPendingCount());
        if (r?.deviceBound) setDeviceBound(true);
        else if (r?.syncedOk) setDeviceBound(false);
      });
    };

    const onOnline = () => {
      // Network back — push latest score/stage so live ranking updates.
      pushBoard();
    };

    window.addEventListener('online', onOnline);
    // Also retry while the hunt screen is open and briefly online.
    const interval = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (offlineBoardPendingCount() > 0 || bundleRef.current) pushBoard();
    }, 20000);

    return () => {
      disarm();
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let [pack, sess] = await Promise.all([
          loadOfflineBundle(),
          loadOfflineSession(),
        ]);
        if (cancelled) return;
        if (!pack || !sess) {
          setLoading(false);
          return;
        }

        // Admin Start over + release time from Live (Wi‑Fi).
        const sync = await applyServerStartOverIfNeeded(pack).catch(() => null);
        if (sync?.bundle) {
          pack = sync.bundle;
        }

        let teamState = await loadOfflineTeamState(sess.teamCode);
        teamState = hydrateState(pack, teamState);
        if (!isHuntWaiting(teamState)) {
          teamState = tickTimers(pack, ensureClueActive(pack, teamState), new Date());
          const healed = healOnePhoneStation(pack, sess, teamState);
          if (healed.healed) teamState = healed.state;
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
    // Only rebuild export QR when stage/score settle — cuts lag mid-clue.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const results = await buildResultsPayload({ bundle, state });
          const backup = session.role === 'leader'
            ? await buildPhoneBackupPayload({ bundle, state, session })
            : null;
          if (cancelled) return;
          setResultsPayload(JSON.stringify(results));
          if (backup) setBackupPayload(JSON.stringify(backup));
          else setBackupPayload('');
        } catch {
          /* QR draw is best-effort */
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bundle, session, state?.currentStage, state?.score, state?.seq]);

  // Clue 4: mint device key if pack is old / missing (needs brief Wi‑Fi).
  useEffect(() => {
    if (!bundle || !session || !state) return undefined;
    if (state.currentStage !== 'CLUE_4_ACTIVE') return undefined;
    if (bundle.clues?.clue4?.gridAccessCode) return undefined;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return undefined;
    let cancelled = false;
    (async () => {
      const data = await ensureOfflineGridKey(bundle);
      if (cancelled || !data?.gridAccessCode) return;
      const nextPack = {
        ...bundle,
        clues: {
          ...bundle.clues,
          clue4: {
            ...(bundle.clues?.clue4 || {}),
            gridAccessCode: data.gridAccessCode,
            gridGameUrl: data.gridGameUrl || '/campus-hunt/grid',
          },
        },
        team: {
          ...bundle.team,
          gridAccessCode: data.gridAccessCode,
        },
      };
      await saveOfflineBundle(nextPack);
      if (cancelled) return;
      setBundle(nextPack);
      setPlayData(buildPlayData(nextPack, session, state));
    })();
    return () => { cancelled = true; };
  }, [bundle, session, state?.currentStage]);

  const applyResult = useCallback((resData) => {
    if (!resData) return false;
    if (!(resData.team || Array.isArray(resData.challenges))) return false;
    setPlayData((prev) => {
      let checkpointStatus = resData.checkpointStatus;
      if (
        checkpointStatus == null
        && prev?.checkpointStatus?.checkpointId
        && String(prev?.team?.currentStage || '') === String(resData.team?.currentStage || '')
      ) {
        checkpointStatus = prev.checkpointStatus;
      }
      return {
        ...prev,
        ...resData,
        checkpointStatus: checkpointStatus ?? null,
      };
    });
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
    revealTimedChallenge: async (_teamId, challengeNumber) => {
      const pack = bundleRef.current;
      const sess = sessionRef.current;
      const n = Number(challengeNumber);
      let next = tickTimers(pack, ensureClueActive(pack, stateRef.current), new Date());
      await persistState(next, sess);
      const data = buildPlayData(pack, sess, next);
      const ch = data.challenges?.find((c) => Number(c.challengeNumber) === n);
      return {
        data: {
          ...data,
          revealed: Boolean(ch?.revealedAnswer),
          revealedAnswer: ch?.revealedAnswer || null,
          awardedPoints: 0,
          message: ch?.revealedAnswer
            ? `Time's up — answer revealed (0 pts): ${ch.revealedAnswer}. Type it to continue.`
            : "Time's up — 0 points. Type the revealed answer to continue.",
          awaitSubmit: true,
        },
      };
    },
    submitFinishCode: async (_teamId, finishCode) => {
      const pack = bundleRef.current;
      const sess = sessionRef.current;
      const result = markReachedStart(pack, sess, stateRef.current, finishCode);
      await persistState(result.state, sess);
      return {
        data: {
          ...buildPlayData(pack, sess, result.state),
          ...result.meta,
        },
      };
    },
  }), [wrapEngine, persistState, persistSession]);

  const onStartHunt = async (goCode = '') => {
    setStartError('');
    setStarting(true);
    try {
      const result = startHunt(
        bundleRef.current,
        sessionRef.current,
        stateRef.current,
        new Date(),
        { goCode },
      );
      await persistState(result.state, sessionRef.current);
    } catch (err) {
      setStartError(err.message || 'Could not start the hunt');
    } finally {
      setStarting(false);
    }
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
    const ok = window.confirm(
      'START OVER?\n\n'
      + '• Clears this phone’s hunt progress\n'
      + '• You will need the start code again\n'
      + '• Live ranking may reset (needs Wi‑Fi)\n'
      + '• Zip Grid progress resets\n\n'
      + 'Only use for a retest / dry run — not after a real finish unless organizers say so.',
    );
    if (!ok) return;
    setResetting(true);
    try {
      const result = await startOverHunt({
        teamCode: session.teamCode,
        reloadAppIfWaiting: false,
        clearSession: false,
      });
      if (result.bundle) {
        setBundle(result.bundle);
        bundleRef.current = result.bundle;
      }
      if (result.state) {
        await saveOfflineTeamState(session.teamCode, result.state);
        setState(result.state);
        stateRef.current = result.state;
        setPlayData(buildPlayData(result.bundle || bundle, session, result.state));
      }
      window.alert(result.message || 'Started over.');
      // Stay on play route — briefing shows because stage is WAITING.
    } catch (err) {
      window.alert(err.message || 'Start over failed');
    } finally {
      setResetting(false);
    }
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
  const locked = stage === 'SCORE_LOCKED' || stage === 'FINISH_COMPLETED';

  if (waiting) {
    return (
      <OfflineHuntBriefing
        bundle={bundle}
        session={session}
        state={state}
        onStartHunt={onStartHunt}
        starting={starting}
        error={startError}
        onBackToRounds={() => navigate(CAMPUS_HUNT_PATHS.offline)}
      />
    );
  }

  return (
    <div className={locked ? 'pb-28' : 'pb-8'}>
      <PlayerPlayScreen
        data={playData}
        onRefresh={refresh}
        onActionResult={applyResult}
        eventSlug={bundle.event.slug}
        onLeaveRound={() => navigate(CAMPUS_HUNT_PATHS.offline)}
        actions={actions}
        offlineMode
        roundLabel="The Hunt · Offline"
        backTo={CAMPUS_HUNT_PATHS.offline}
        backLabel="← Home"
        onStartOver={session.role === 'leader' ? onResetHunt : null}
        startOverBusy={resetting}
        checkpointExtra={
          session.role === 'leader' && cp?.needJoinWord ? (
            <div className="mt-3 space-y-2 rounded-xl border border-[#0ECCEE]/30 bg-[#0a1218] p-3 text-left">
              <p className="text-xs font-semibold text-[#0ECCEE]">Join the word</p>
              <p className="text-[11px] text-white/55">
                Join the planted letter slips into one word, then submit.
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
          ) : null
        }
      />

      {session.role === 'leader' ? (
        <details className="mx-auto max-w-lg px-4 pb-2 text-white">
          <summary className="cursor-pointer py-2 text-xs text-white/40">
            Tools
            {boardPending > 0 ? ` · ${boardPending} pending to live board` : ''}
            {deviceBound ? ' · phone conflict' : ''}
          </summary>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] text-white/45">
              Live ranking needs Wi‑Fi. If points look stuck, stay online and keep playing — sync retries automatically.
              {boardPending > 0 ? ` (${boardPending} waiting to send)` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#0ECCEE]/20 px-3 py-1.5 text-xs font-semibold text-[#0ECCEE]"
                onClick={() => {
                  const pack = bundleRef.current;
                  const st = stateRef.current;
                  if (pack && st) {
                    void enqueueOfflineProgress(pack, st).then((r) => {
                      setBoardPending(offlineBoardPendingCount());
                      if (r?.deviceBound) setDeviceBound(true);
                      else if (r?.syncedOk) setDeviceBound(false);
                    });
                  }
                }}
              >
                Push score to live board
              </button>
              {deviceBound ? (
                <button
                  type="button"
                  className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100"
                  onClick={() => {
                    rotateOfflineDeviceIdForTakeover();
                    setDeviceBound(false);
                    const pack = bundleRef.current;
                    const st = stateRef.current;
                    if (pack && st) {
                      void enqueueOfflineProgress(pack, st).then((r) => {
                        setBoardPending(offlineBoardPendingCount());
                        if (r?.deviceBound) setDeviceBound(true);
                        else if (r?.syncedOk) setDeviceBound(false);
                      });
                    }
                  }}
                >
                  Take over this phone
                </button>
              ) : null}
            </div>

            {backupPayload ? (
              <div>
                <p className="text-[11px] text-white/50">Phone backup — paste below to restore</p>
                <textarea
                  readOnly
                  value={backupPayload}
                  className="mt-1 h-14 w-full rounded-lg bg-black/40 p-2 font-mono text-[9px] text-white/60"
                />
                <textarea
                  className="mt-2 h-12 w-full rounded-lg border border-white/15 bg-black/40 p-2 font-mono text-[10px]"
                  placeholder="Paste backup JSON…"
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (text) onRestoreBackup(text);
                  }}
                />
                {restoreMsg ? <p className="mt-1 text-[11px] text-[#0ECCEE]">{restoreMsg}</p> : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled={resetting}
              className="mt-2 w-full rounded-lg border border-white/10 py-2 text-xs text-white/45 disabled:opacity-40"
              onClick={onResetHunt}
            >
              {resetting ? 'Starting over…' : 'Start over'}
            </button>
          </div>
        </details>
      ) : null}

      <OfflineHandoffDock
        isLeader={session.role === 'leader'}
        locked={locked}
        resultsPayload={resultsPayload}
        onDownloadResults={onDownloadResults}
      />
    </div>
  );
}
