import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreChip from '../components/ScoreChip';
import CountdownTimer from '../components/CountdownTimer';
import HuntQrScanner, { releaseHuntCameraSession } from '../components/HuntQrScanner';
import HuntProgressTrack from '../components/HuntProgressTrack';
import {
  STAGE_THEMES,
  themeForChallengeNumber,
  themeForPlayerContext,
} from '../types/stageTheme';
import { CAMPUS_HUNT_PATHS } from '../config';
import CampusHuntBackLink from '../components/CampusHuntBackLink';
import { pullOfflineBoardState } from '../offline/offlineBoardSync';
import {
  submitChallengeAnswer,
  requestChallengeHint,
  revealTimedChallenge,
  scanStationCheckpoint,
  confirmStationCheckpoint,
  forceUnlockClue2,
  submitFinishCode,
  startHuntWithCode,
  fetchPublicLeaderboard,
} from '../services/campusHunt.api';
import PlayerInstructionBox from './PlayerInstructionBox';
import { buildPlayerNowGuide } from './playerNowGuide';
import { sanitizePlayerCopy } from './sanitizePlayerCopy';
import { teamPrimaryLabel, teamSecondaryName } from '../utils/teamLabel';
import ClueHowTo from '../components/ClueHowTo';
import HuntColorFlowGuide from '../components/HuntColorFlowGuide';
import PoweredByCrwdCtrl from '../components/PoweredByCrwdCtrl';
import OfflineHuntWelcome from '../offline/components/OfflineHuntWelcome';
import { OFFLINE_CLUE_HOW_TO, OFFLINE_CLUE_PROMPTS } from '../offline/offlineHowTo';

function activeChallengeNumber(stage) {
  const m = String(stage || '').match(/^CLUE_(\d)_ACTIVE$/);
  return m ? Number(m[1]) : null;
}

/** Play UI is always one leader scan — ignore stale pack/API “N of teamSize” counts. */
function asLeaderOnlyCheckpoint(status) {
  if (!status) return status;
  const scanned = Boolean(status.youScanned) || Number(status.verifiedCount || 0) > 0;
  return {
    ...status,
    requiredCount: 1,
    membersNeeded: 0,
    onePhoneMode: true,
    awaitingTeamCodeConfirm: false,
    scanRoster: [],
    youScanned: scanned,
    verifiedCount: scanned ? Math.min(1, Number(status.verifiedCount || 1)) : 0,
    publicInstruction: sanitizePlayerCopy(
      status.publicInstruction || 'Leader scans this poster once — next clue unlocks.',
    ),
  };
}

function needsStationScan(stage) {
  return (
    stage === 'CLUE_1_COMPLETED'
    || stage === 'CLUE_2_COMPLETED'
    || stage === 'CLUE_2_FAILED'
    || stage === 'CLUE_2_TIMEOUT'
    || stage === 'CLUE_3_COMPLETED'
    || stage === 'CLUE_3_FAILED'
    || stage === 'CLUE_4_COMPLETED'
    || stage === 'CLUE_4_FAILED'
    || stage === 'CLUE_4_TIMEOUT'
    || stage === 'CLUE_5_COMPLETED'
    || stage === 'CLUE_5_FAILED'
  );
}

function needsStartReport(stage) {
  // After Clue 6 — type organizer finish code at Mindspark Lobby.
  return stage === 'CLUE_6_COMPLETED' || stage === 'CLUE_6_FAILED';
}

function revealAnswerLabel(challengeNumber) {
  if (challengeNumber === 2) return 'Join-word';
  if (challengeNumber === 4) return 'GRID code';
  if (challengeNumber === 5) return 'Team word';
  if (challengeNumber === 6) return 'Finish code';
  return 'Answer';
}

const CHECKPOINT_REVEAL_STAGE = {
  CLUE_2_COMPLETED: 2,
  CLUE_2_FAILED: 2,
  CLUE_2_TIMEOUT: 2,
  CLUE_4_COMPLETED: 4,
  CLUE_4_FAILED: 4,
  CLUE_4_TIMEOUT: 4,
  CLUE_5_COMPLETED: 5,
  CLUE_5_FAILED: 5,
};

const panel = 'rounded-2xl border border-white/[0.08] bg-[#121416]/85 p-4 backdrop-blur-sm';

export default function PlayerPlayScreen({
  data,
  onRefresh,
  onActionResult,
  eventSlug,
  onLeaveRound,
  pollError,
  actions = null,
  offlineMode = false,
  checkpointExtra = null,
  roundLabel = null,
  backTo = null,
  backLabel = '← Hunt hub',
  onStartOver = null,
  startOverBusy = false,
  eventId: eventIdProp = null,
  offlineBundle = null,
}) {
  const submitChallengeAnswerFn = actions?.submitChallengeAnswer || submitChallengeAnswer;
  const requestChallengeHintFn = actions?.requestChallengeHint || requestChallengeHint;
  const revealTimedChallengeFn = actions?.revealTimedChallenge || revealTimedChallenge;
  const scanStationCheckpointFn = actions?.scanStationCheckpoint || scanStationCheckpoint;
  const confirmStationCheckpointFn = actions?.confirmStationCheckpoint || confirmStationCheckpoint;
  const team = data?.team;
  const challenges = data?.challenges || [];
  const serverTime = data?.serverTime || team?.serverTime;
  const checkpointStatus = asLeaderOnlyCheckpoint(data?.checkpointStatus);
  const submitFinishCodeFn = actions?.submitFinishCode || submitFinishCode;
  const isLeader = Boolean(team?.isLeader);
  const eventId = eventIdProp || data?.event?.id || null;
  const round1Label = roundLabel || 'Campus Hunt';
  const activeNum = activeChallengeNumber(team?.currentStage);
  const released = Boolean(
    team?.actualStartAt
    || ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team?.startStatus),
  );
  const waitingForRelease = !offlineMode && String(team?.currentStage || '') === 'WAITING';

  const [liveRank, setLiveRank] = useState(null);
  const [liveFieldSize, setLiveFieldSize] = useState(null);

  useEffect(() => {
    if (!offlineMode || (!eventId && !offlineBundle)) return undefined;
    let cancelled = false;
    const pull = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        if (offlineBundle?.signingKey) {
          const data = await pullOfflineBoardState(offlineBundle);
          if (cancelled || !data) return;
          setLiveRank(Number(data.rank) || null);
          setLiveFieldSize(Number(data.fieldSize) || null);
          return;
        }
        if (!eventId) return;
        const res = await fetchPublicLeaderboard(eventId);
        const rows = res.data?.leaderboard || res.data?.rows || res.data || [];
        const list = Array.isArray(rows) ? rows : [];
        if (cancelled) return;
        setLiveFieldSize(list.length || null);
        const mine = list.find((row) => (
          String(row.teamCode || '') === String(team?.teamCode || '')
          || String(row.teamId || row.id || '') === String(team?.id || '')
        ));
        setLiveRank(Number(mine?.rank || mine?.place) || null);
      } catch {
        /* ranking is best-effort while offline */
      }
    };
    pull();
    const onSynced = (event) => {
      const detail = event?.detail || {};
      if (detail.rank != null) setLiveRank(Number(detail.rank) || null);
      if (detail.fieldSize != null) setLiveFieldSize(Number(detail.fieldSize) || null);
      // Pull fresh top table a moment after a successful board push.
      void pull();
    };
    const tick = window.setInterval(pull, 12000);
    window.addEventListener('online', pull);
    window.addEventListener('ch-offline-board-synced', onSynced);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.removeEventListener('online', pull);
      window.removeEventListener('ch-offline-board-synced', onSynced);
    };
  }, [offlineMode, eventId, offlineBundle, team?.teamCode, team?.id, team?.currentStage, team?.currentScore]);

  const displayRank = offlineMode
    ? liveRank
    : team?.leaderboardRank;
  const displayFieldSize = offlineMode
    ? (liveFieldSize || Number(data?.event?.teamCapacity) || 20)
    : (team?.leaderboardSize || Number(data?.event?.teamCapacity) || null);

  const winMsg = useCallback((withPts, withoutPts) => (
    offlineMode ? withoutPts : withPts
  ), [offlineMode]);

  const activeChallenge = useMemo(
    () => {
      const raw = challenges.find((c) => c.challengeNumber === activeNum);
      if (!raw) return undefined;
      const appHowTo = OFFLINE_CLUE_HOW_TO[Number(raw.challengeNumber)];
      const appPrompt = OFFLINE_CLUE_PROMPTS[Number(raw.challengeNumber)];
      let next = raw;
      if (appHowTo) next = { ...next, howTo: appHowTo };
      if (appPrompt && offlineMode) next = { ...next, prompt: appPrompt, collaborative: false, memberFragments: undefined, memberCode: undefined };
      return next;
    },
    [challenges, activeNum, offlineMode],
  );

  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [startCode, setStartCode] = useState('');
  const [startErr, setStartErr] = useState('');
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const busyRef = useRef(false);
  const lastScanRawRef = useRef('');
  const [instructionEnded, setInstructionEnded] = useState(false);
  const [copiedGrid, setCopiedGrid] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('neutral');
  const [hintPreview, setHintPreview] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successText, setSuccessText] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [finishCode, setFinishCode] = useState('');
  const [awardedFlash, setAwardedFlash] = useState(null);
  const prevStageRef = useRef(team?.currentStage);
  const lastTimerRevealKeyRef = useRef('');
  const timerExpiredHandledRef = useRef('');

  // Reset local instruction override when the clue / timer window changes
  useEffect(() => {
    setInstructionEnded(false);
  }, [activeChallenge?.challengeNumber, activeChallenge?.timerStartsAt]);

  const inInstructionPhase = Boolean(
    activeChallenge?.instructionPhase && !instructionEnded,
  );

  // Prefill when soft-reveal answer arrives (clues 2/4/5)
  useEffect(() => {
    if (!activeChallenge?.revealedAnswer) return;
    if (activeChallenge.state !== 'ACTIVE') return;
    if (![2, 5].includes(Number(activeChallenge.challengeNumber))) return;
    setAnswer((prev) => (prev?.trim() ? prev : String(activeChallenge.revealedAnswer)));
  }, [activeChallenge?.revealedAnswer, activeChallenge?.state, activeChallenge?.challengeNumber]);

  const handleTimerExpired = useCallback(async () => {
    const key = `${team?.id || ''}-${activeNum || ''}-${activeChallenge?.expiresAt || ''}`;
    if (timerExpiredHandledRef.current === key) return;
    timerExpiredHandledRef.current = key;
    if (!team?.id || !activeNum || ![2, 5].includes(activeNum)) {
      void onRefresh?.({ force: true, burst: true });
      return;
    }
    try {
      const res = await revealTimedChallengeFn(team.id, activeNum);
      const resData = res?.data || res;
      const applied = onActionResult?.(resData);
      if (!applied) {
        void onRefresh?.({ force: true, burst: true });
      } else if (!offlineMode) {
        window.setTimeout(() => {
          void onRefresh?.({ burst: true });
        }, 1100);
      }
      const answer = resData?.revealedAnswer
        || resData?.challenges?.find((c) => Number(c.challengeNumber) === activeNum)?.revealedAnswer;
      const label = revealAnswerLabel(activeNum);
      if (answer) {
        setAnswer(String(answer));
        setFeedback(`${label} revealed (0 pts) — type it and submit to continue`);
        setFeedbackTone('ok');
      } else {
        setFeedback(resData?.message || "Time's up — answer revealed (0 pts). Type it to continue.");
        setFeedbackTone('neutral');
      }
      setAwardedFlash(null);
    } catch (err) {
      void onRefresh?.({ force: true, burst: true });
      setFeedback(err?.message || "Time's up — refreshing…");
      setFeedbackTone('neutral');
    }
  }, [
    team?.id,
    activeNum,
    activeChallenge?.expiresAt,
    revealTimedChallengeFn,
    onRefresh,
    onActionResult,
    offlineMode,
  ]);

  useEffect(() => {
    if (!showSuccess) return undefined;
    const t = setTimeout(() => {
      setShowSuccess(false);
      setAwardedFlash(null);
    }, 1400);
    return () => clearTimeout(t);
  }, [showSuccess]);

  // Release session camera when leaving Round 1 play
  useEffect(() => () => {
    releaseHuntCameraSession();
  }, []);

  // When stage advances, jump to top. Entering a scan stop → open camera.
  useEffect(() => {
    const stage = team?.currentStage;
    if (!stage || stage === prevStageRef.current) return;
    prevStageRef.current = stage;
    timerExpiredHandledRef.current = '';
    setShowPaste(false);
    setAnswer('');
    setHintPreview('');
    const enteringScan = needsStationScan(stage) && !activeChallengeNumber(stage);
    setShowScanner(enteringScan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [team?.currentStage]);

  const atCheckpoint = !waitingForRelease && needsStationScan(team?.currentStage) && !activeNum;

  const timerRevealAtCheckpoint = useMemo(() => {
    const n = CHECKPOINT_REVEAL_STAGE[team?.currentStage];
    if (!n || !atCheckpoint) return null;
    const ch = challenges.find((c) => c.challengeNumber === n);
    const revealed = ch?.failureReason === 'REVEALED_ZERO_POINTS'
      || ch?.failureReason === 'TIMEOUT';
    if (revealed && ch?.revealedAnswer) {
      return { n, answer: ch.revealedAnswer };
    }
    return null;
  }, [team?.currentStage, atCheckpoint, challenges]);

  // Keep camera open on scan stages (backup if stage-enter missed)
  useEffect(() => {
    if (
      !atCheckpoint
      || !checkpointStatus
      || checkpointStatus.assignmentMissing
      || checkpointStatus.needJoinWord
      || Number(checkpointStatus.verifiedCount || 0) >= Number(checkpointStatus.requiredCount || 1)
    ) {
      return;
    }
    setShowScanner(true);
  }, [
    atCheckpoint,
    checkpointStatus?.checkpointId,
    checkpointStatus?.checkpointKey,
    checkpointStatus?.verifiedCount,
    checkpointStatus?.requiredCount,
    checkpointStatus?.assignmentMissing,
    checkpointStatus?.needJoinWord,
  ]);

  // Prefill team code as soon as full roster has scanned
  useEffect(() => {
    if (!checkpointStatus?.awaitingTeamCodeConfirm) return;
    if (claimCode) return;
    if (team?.teamCode) setClaimCode(String(team.teamCode).toUpperCase());
  }, [checkpointStatus?.awaitingTeamCodeConfirm, team?.teamCode, claimCode]);

  // Auto-sync when server marks timer expired (backup if countdown onComplete missed)
  useEffect(() => {
    if (!activeChallenge?.timeExpired) return undefined;
    if (![2, 5].includes(activeChallenge.challengeNumber)) return undefined;
    void handleTimerExpired();
    return undefined;
  }, [
    activeChallenge?.timeExpired,
    activeChallenge?.challengeNumber,
    handleTimerExpired,
  ]);

  // Flash revealed answer when timer auto-advances to scan / start report
  useEffect(() => {
    if (!team) return undefined;
    const atCp = !waitingForRelease && needsStationScan(team.currentStage) && !activeNum;
    const stageReveal = CHECKPOINT_REVEAL_STAGE[team.currentStage];
    let reveal = null;
    if (stageReveal && atCp) {
      const ch = challenges.find((c) => c.challengeNumber === stageReveal);
      const revealed = ch?.failureReason === 'REVEALED_ZERO_POINTS'
        || ch?.failureReason === 'TIMEOUT';
      if (revealed && ch?.revealedAnswer) {
        reveal = { n: stageReveal, answer: ch.revealedAnswer };
      }
    }
    const atStart = !waitingForRelease && needsStartReport(team.currentStage) && !activeNum;
    if (!reveal && atStart) {
      const ch5 = challenges.find((c) => c.challengeNumber === 5);
      const revealed5 = ch5?.failureReason === 'REVEALED_ZERO_POINTS'
        || ch5?.failureReason === 'TIMEOUT';
      if (revealed5 && ch5?.revealedAnswer) {
        reveal = { n: 5, answer: ch5.revealedAnswer };
      }
    }
    if (!reveal?.answer) return undefined;
    const key = `${reveal.n}:${reveal.answer}`;
    if (lastTimerRevealKeyRef.current === key) return undefined;
    lastTimerRevealKeyRef.current = key;
    setSuccessText(
      `Time's up — ${revealAnswerLabel(reveal.n)}: ${reveal.answer} · 0 pts`,
    );
    setShowSuccess(true);
    setAwardedFlash(null);
    return undefined;
  }, [team, challenges, activeNum, waitingForRelease]);

  const applyResult = (resData) => {
    const applied = onActionResult?.(resData);
    if (!applied) {
      void onRefresh?.({ force: true, burst: true });
      return;
    }
    // Offline: persist already wrote fresh playData. A delayed refresh used a stale
    // closure and rewound the board back to the previous clue after solve/scan.
    if (offlineMode) return;
    window.setTimeout(() => {
      void onRefresh?.({ burst: true });
    }, 1100);
  };

  const HEAL_CODES = new Set([
    'WRONG_STAGE',
    'STAGE_WRITE_CONFLICT',
    'ALREADY_RESOLVED',
    'ROUND_CLOSED',
    'SCORE_LOCKED',
    'ROSTER_INCOMPLETE',
  ]);

  const runAction = async (fn) => {
    if (busyRef.current) return { ok: false, busy: true };
    busyRef.current = true;
    setBusy(true);
    setFeedback('');
    setFeedbackTone('neutral');
    try {
      const res = await fn();
      applyResult(res.data);
      return { ok: true, payload: res.data };
    } catch (err) {
      const code = err?.code || err?.data?.code;
      setFeedback(err.message || 'Action failed');
      setFeedbackTone('err');
      if (HEAL_CODES.has(code) || err?.status === 409) {
        void onRefresh?.({ force: true });
      }
      return { ok: false, error: err };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const locked = team?.currentStage === 'SCORE_LOCKED';
  const atStartReport = Boolean(
    team && !waitingForRelease && needsStartReport(team.currentStage) && !activeNum,
  );
  const atLobbyFinish = Boolean(
    team
    && !waitingForRelease
    && !locked
    && (activeNum === 6 || atStartReport),
  );

  const timerRevealAtStart = useMemo(() => {
    if (!atStartReport) return null;
    const ch = challenges.find((c) => c.challengeNumber === 6);
    if (ch?.failureReason === 'REVEALED_ZERO_POINTS' && ch?.revealedAnswer) {
      return ch.revealedAnswer;
    }
    return null;
  }, [atStartReport, challenges]);

  const welcomeTeamKey = String(team?.teamCode || team?.id || '');
  useEffect(() => {
    if (!welcomeTeamKey) return;
    try {
      if (sessionStorage.getItem(`ch_hunt_welcome_seen_${welcomeTeamKey}`) === '1') {
        setWelcomeDismissed(true);
      }
    } catch { /* ignore */ }
  }, [welcomeTeamKey]);

  if (!team) {
    return (
      <div className="mx-auto max-w-lg animate-pulse px-4 pb-10 pt-8 text-white">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="mt-3 h-7 w-40 rounded bg-white/15" />
        <div className="mt-8 h-28 rounded-2xl border border-white/10 bg-white/[0.04]" />
      </div>
    );
  }

  const checkpointTheme = themeForPlayerContext({
    stage: team.currentStage,
    checkpointKey: checkpointStatus?.checkpointKey,
  });
  const clueTheme = themeForChallengeNumber(activeNum || activeChallenge?.challengeNumber || 1);
  const nowThemeHex = atCheckpoint
    ? checkpointTheme.hex
    : atLobbyFinish
      ? STAGE_THEMES.destination.hex
      : waitingForRelease
        ? '#F97316'
        : activeNum
          ? clueTheme.hex
          : '#0ECCEE';

  const nowGuide = buildPlayerNowGuide({
    waitingForRelease,
    released,
    locked,
    atCheckpoint,
    atStartReport: atLobbyFinish,
    activeNum: atLobbyFinish && activeNum === 6 ? 6 : activeNum,
    isLeader,
    team,
    checkpointStatus,
    activeChallenge: activeChallenge
      ? { ...activeChallenge, instructionPhase: inInstructionPhase }
      : activeChallenge,
  });

  const celebrate = (text) => {
    setSuccessText(text);
    setShowSuccess(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeNum || !isLeader) return;
    if (inInstructionPhase) {
      setFeedback('Read the instructions first — the hunt timer has not started yet.');
      return;
    }
    const attempts = Number(activeChallenge?.attempts || 0);
    const requestId = `${team.id}-c${activeNum}-a${attempts}`;
    const result = await runAction(() =>
      submitChallengeAnswerFn(team.id, activeNum, answer, requestId));
    if (!result.ok) return;
    const resData = result.payload;
    if (resData?.correct) {
      setAnswer('');
      const pts = resData.awardedPoints ?? 0;
      const flashPts = offlineMode ? null : (pts > 0 ? pts : null);
      if (activeNum === 1) {
        celebrate(winMsg(
          pts > 0 ? `Correct! +${pts} pts` : 'Correct! Head to Orange scan',
          'Correct! Head to Orange scan',
        ));
        setAwardedFlash(flashPts);
      } else if (activeNum === 2) {
        celebrate(winMsg(
          pts > 0
            ? `Correct! +${pts} pts — green scan next`
            : 'Correct — green scan next',
          'Correct — green scan next',
        ));
        setAwardedFlash(flashPts);
      } else if (activeNum === 3) {
        celebrate(winMsg(
          pts > 0
            ? `Decoded! +${pts} pts — blue scan next`
            : 'Decoded — blue scan next',
          'Decoded — blue scan next',
        ));
        setAwardedFlash(flashPts);
      } else if (activeNum === 4) {
        celebrate(winMsg(
          pts > 0
            ? `GRID cleared! +${pts} pts — purple scan next`
            : 'GRID cleared — purple scan next',
          'GRID cleared — purple scan next',
        ));
        setAwardedFlash(flashPts);
      } else if (activeNum === 5) {
        celebrate(winMsg(
          pts > 0
            ? `Correct! +${pts} pts — go scan red, then Mindspark Lobby`
            : 'Correct — go scan red, then Mindspark Lobby',
          'Correct — go scan red, then Mindspark Lobby',
        ));
        setAwardedFlash(flashPts);
      } else if (activeNum === 6) {
        celebrate(
          result.payload?.scoreLocked
            ? 'Finish code accepted — score locked at Mindspark Lobby'
            : 'Finish code accepted — score locked at Mindspark Lobby',
        );
        setAwardedFlash(flashPts);
      } else if (resData?.late) {
        celebrate(winMsg('Correct — time up (0 points)', 'Correct — time was up'));
        setAwardedFlash(null);
      } else {
        celebrate(winMsg(pts > 0 ? `Correct! +${pts} pts` : 'Correct!', 'Correct!'));
        setAwardedFlash(flashPts);
      }
      // Camera only after the phone is actually on the scan stage.
      // Opening it while the stage is still CLUE_*_ACTIVE made a late red scan
      // bounce back to "type the clue".
      if (needsStationScan(resData?.team?.currentStage)) {
        setShowScanner(true);
      }
      setFeedback(sanitizePlayerCopy(resData.message || resData.destinationInstruction || ''));
    } else if (resData?.revealed) {
      setAnswer(String(resData.revealedAnswer || resData.revealedLocation || '').trim());
      celebrate(winMsg('Answer revealed — type it for 0 pts', 'Answer revealed — type it to continue'));
      setAwardedFlash(null);
      setFeedback(
        resData.message
        || (resData.revealedAnswer || resData.revealedLocation
          ? `Answer: ${resData.revealedAnswer || resData.revealedLocation}. Type it exactly to continue (0 pts).`
          : 'Out of attempts (0 pts). Answer shown — type it to continue.'),
      );
    } else if (resData?.timedOut) {
      setFeedback('Time is up. Continue when ready.');
    } else {
      setFeedback(
        resData?.message
        || `Incorrect. Attempts left: ${resData?.attemptsLeft ?? 0}`,
      );
    }
  };

  const onHint = async () => {
    if (!activeNum || !isLeader) return;
    const hintCost = Number(activeChallenge?.hintCost) || 20;
    if (!window.confirm(
      offlineMode
        ? 'Use a hint? It may affect your ranking.'
        : `Use Hint? This will cost ${hintCost} points.`,
    )) return;
    const result = await runAction(() =>
      requestChallengeHintFn(team.id, activeNum, `hint-${team.id}-${activeNum}`));
    if (result.ok) setHintPreview(result.payload?.hint || '');
  };

  const onStationScan = async (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    if (value === lastScanRawRef.current && busyRef.current) return;
    lastScanRawRef.current = value;
    const result = await runAction(() => scanStationCheckpointFn(team.id, value));
    if (!result.ok) {
      if (result.error) {
        let msg = result.error.message || 'Scan failed — use the station poster QR';
        if (/type your clue answer/i.test(msg) && needsStationScan(team?.currentStage)) {
          msg = 'Scan didn’t register — point at the poster QR again';
        }
        setFeedback(msg);
        setFeedbackTone('err');
      }
      // Allow retry of the same QR after a miss
      setTimeout(() => {
        if (lastScanRawRef.current === value) lastScanRawRef.current = '';
      }, 1200);
      return;
    }
    const resData = result.payload;
    const count = Number(resData?.verifiedCount || resData?.checkpointStatus?.verifiedCount || 0);
    const required = Number(resData?.requiredCount || resData?.checkpointStatus?.requiredCount || 1);
    const awaiting = Boolean(
      resData?.awaitingTeamCodeConfirm
      || resData?.checkpointStatus?.awaitingTeamCodeConfirm
      || (count >= required && !resData?.unlockedNext),
    );
    const unlocked = Boolean(
      resData?.unlockedNext
      || resData?.unlockedClue2
      || resData?.unlockedClue3
      || resData?.unlockedClue4
      || resData?.unlockedClue5
      || resData?.unlockedClue6,
    );
    setShowScanner(false);
    setShowPaste(false);
    setFeedbackTone('ok');
    setAwardedFlash(null);
    if (unlocked) {
      setFeedback('Checkpoint passed');
      celebrate('Checkpoint passed');
      setClaimCode('');
    } else if (awaiting && !checkpointStatus?.onePhoneMode && required > 1) {
      setFeedback(resData?.message || 'Poster scanned — confirm team code');
      celebrate('Poster scanned — confirm team code');
      if (team?.teamCode) setClaimCode(String(team.teamCode).toUpperCase());
    } else if (!unlocked) {
      // Leader-only: scan should auto-unlock — refresh if stage hasn't moved yet
      setFeedback('Checkpoint passed');
      celebrate('Checkpoint passed');
      if (!offlineMode) {
        void onRefresh?.({ force: true, burst: true });
      }
    }
  };

  const onStationClaim = async (e) => {
    e?.preventDefault?.();
    const code = String(claimCode || team?.teamCode || '').trim();
    if (!code) {
      setFeedback('Enter your team code');
      return;
    }
    const checkpointId = checkpointStatus?.checkpointId
      || checkpointStatus?.id
      || null;
    const result = await runAction(() => confirmStationCheckpointFn(team.id, {
      teamCode: code,
      checkpointId,
    }));
    if (!result.ok) return;
    const resData = result.payload;
    const unlocked = Boolean(
      resData?.unlockedNext
      || resData?.unlockedClue2
      || String(resData?.teamStage || resData?.team?.currentStage || '').includes('CLUE_2')
      || String(resData?.teamStage || resData?.team?.currentStage || '').includes('CLUE_3')
      || String(resData?.teamStage || resData?.team?.currentStage || '').includes('CLUE_4')
      || String(resData?.teamStage || resData?.team?.currentStage || '').includes('CLUE_5')
      || String(resData?.teamStage || resData?.team?.currentStage || '').includes('CLUE_6'),
    );
    setFeedback(resData?.message || (unlocked ? 'Checkpoint passed' : 'Confirmed'));
    setAwardedFlash(null);
    if (unlocked || resData?.alreadyComplete) {
      celebrate('Checkpoint passed');
      setClaimCode('');
      // Force a hard refresh so stuck claim UI clears after heal
      window.setTimeout(() => {
        void onRefresh?.({ force: true });
      }, 200);
    }
  };

  if (waitingForRelease && !welcomeDismissed && team) {
    return (
      <OfflineHuntWelcome
        teamCode={team.teamCode || teamPrimaryLabel(team)}
        teamName={team.teamName || teamSecondaryName(team)}
        startName={team.startingPoint?.name}
        onContinue={() => {
          try {
            sessionStorage.setItem(`ch_hunt_welcome_seen_${welcomeTeamKey}`, '1');
          } catch { /* ignore */ }
          setWelcomeDismissed(true);
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Ambient stage wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, ${nowThemeHex}22 0%, transparent 55%),
            radial-gradient(ellipse 70% 40% at 100% 80%, ${nowThemeHex}10 0%, transparent 50%),
            linear-gradient(180deg, #0b0c0d 0%, #0e1012 50%, #0b0c0d 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed inset-x-4 top-14 z-50 mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#101214]/95 px-5 py-5 text-center shadow-2xl backdrop-blur-md"
          >
            <div
              className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-black"
              style={{ background: nowThemeHex }}
            >
              ✓
            </div>
            <p className="text-base font-semibold">{successText}</p>
            {awardedFlash != null && awardedFlash > 0 && (
              <p className="mt-1 text-sm text-[#0ECCEE]">+{awardedFlash} points</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto max-w-lg px-4 pb-10 pt-4">
        {/* Top bar — stage + team + score */}
        <header className="mb-5">
          <CampusHuntBackLink
            to={backTo || (eventSlug ? CAMPUS_HUNT_PATHS.play(eventSlug) : '/')}
            label={backLabel}
            forceTo
            onBeforeNavigate={onLeaveRound}
            className="mb-3"
          />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
                {round1Label}
              </p>
              <h1 className="mt-1 truncate text-[1.35rem] font-semibold tracking-tight text-white">
                {teamPrimaryLabel(team)}
              </h1>
              {!offlineMode && (teamSecondaryName(team) || team.myName) ? (
                <p className="mt-1 truncate text-sm text-white/45">
                  {[
                    teamSecondaryName(team) || null,
                    team.myName
                      ? (isLeader ? `Leader · ${team.myName}` : team.myName)
                      : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
            <ScoreChip
              score={team.currentScore}
              label="Score"
              rank={displayRank}
              fieldSize={displayFieldSize || 20}
              rankFirst={offlineMode}
            />
          </div>
        </header>

        <div className="space-y-4">
          {!waitingForRelease && !locked && (
            <HuntProgressTrack stage={team.currentStage} />
          )}

          {!waitingForRelease && !locked && (
            <PlayerInstructionBox
              guide={nowGuide}
              themeHex={nowThemeHex}
            />
          )}

          {waitingForRelease && (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-[#0ECCEE]/35 bg-[#071016] shadow-[0_0_48px_-24px_rgba(14,204,238,0.9)]">
                <div className="h-1 w-full bg-[#0ECCEE]" />
                <div className="px-4 py-5">
                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0ECCEE]">
                  Organizer start code
                </p>
                <p className="mt-2 text-center text-sm text-white/65">
                  {team.startingPoint?.name
                    ? `Meet at ${team.startingPoint.name}. `
                    : ''}
                  Type the code, then Start.
                </p>
                {isLeader ? (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setStartErr('');
                      const code = String(startCode || '').trim();
                      if (!code) {
                        setStartErr('Type the organizer start code first.');
                        return;
                      }
                      if (!team?.id) {
                        setStartErr('Team not loaded — tap Refresh and try again.');
                        return;
                      }
                      void (async () => {
                        setBusy(true);
                        try {
                          const res = await startHuntWithCode(team.id, code);
                          const resData = res?.data || res;
                          setStartCode('');
                          // Apply start payload immediately — don't wait on a soft poll.
                          const applied = onActionResult?.(resData);
                          if (!applied) {
                            await onRefresh?.({ force: true, burst: true });
                          } else {
                            void onRefresh?.({ force: true, burst: true });
                          }
                        } catch (err) {
                          setStartErr(err?.message || 'Not the right start code');
                          // Stage may have flipped server-side even if progress load failed.
                          void onRefresh?.({ force: true, burst: true });
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    <input
                      value={startCode}
                      onChange={(e) => setStartCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                      placeholder="Organizer will tell you"
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="w-full rounded-2xl border border-white/15 bg-black/50 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.28em] text-white outline-none focus:border-[#0ECCEE]"
                    />
                    {startErr ? (
                      <p className="text-center text-xs text-rose-300">{startErr}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black shadow-[0_16px_40px_-16px_rgba(14,204,238,0.85)] disabled:opacity-40"
                    >
                      {busy ? 'Starting…' : 'Start the hunt'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-center text-sm text-white/55">
                    Use the leader phone to start.
                  </p>
                )}
                </div>
              </section>
              <HuntColorFlowGuide title="Before you start" />
              <PoweredByCrwdCtrl />
            </div>
          )}

          {locked && (
            <section
              className="overflow-hidden rounded-3xl border text-center"
              style={{
                borderColor: `${STAGE_THEMES.destination.hex}99`,
                background: `linear-gradient(180deg, ${STAGE_THEMES.destination.softBg} 0%, rgba(20,14,4,0.94) 58%)`,
                boxShadow: `0 0 48px -18px ${STAGE_THEMES.destination.hex}`,
              }}
            >
              <div className="h-1 w-full" style={{ background: STAGE_THEMES.destination.hex }} />
              <div className="px-5 py-7">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: STAGE_THEMES.destination.hex }}
                >
                  Mindspark Lobby
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Thank you</h2>
                <p className="mt-2 text-sm text-white/70">
                  {teamPrimaryLabel(team)} finished the hunt.
                </p>
                <div className="mx-auto mt-6 max-w-[16rem] rounded-2xl border border-white/10 bg-black/35 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Your score</p>
                  <p
                    className="mt-1 font-mono text-5xl font-black tabular-nums"
                    style={{ color: STAGE_THEMES.destination.hex }}
                  >
                    {team.finalScore ?? team.currentScore ?? 0}
                  </p>
                  {Number(displayRank) > 0 ? (
                    <p className="mt-1 text-sm font-semibold text-white/80">
                      #{displayRank}
                      {Number(displayFieldSize) > 0 ? ` of ${displayFieldSize}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-white/45">Place updates on the leaderboard</p>
                  )}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/65">
                  Thanks for playing. That score is locked.
                </p>
                {offlineMode && Number(displayRank) > 0 && Number(displayRank) <= 10 ? (
                  <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                    You’re in the Top 10 — chance to volunteer at Mindspark 2026.
                  </p>
                ) : null}
                {offlineMode && isLeader && typeof onStartOver === 'function' ? (
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      Disclaimer
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/45">
                      Start over wipes this phone’s progress and may reset live ranking / Zip Grid.
                      Use only for a retest or if organizers ask. After reset you must enter the start code again.
                    </p>
                    <button
                      type="button"
                      disabled={startOverBusy}
                      onClick={onStartOver}
                      className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {startOverBusy ? 'Starting over…' : 'Start over'}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {pollError ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-100">
              Sync issue: {typeof pollError === 'string' ? pollError : 'Could not refresh'}
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => onRefresh?.({ force: true })}
              >
                Retry
              </button>
            </p>
          ) : null}

          {feedback && !(locked && feedbackTone !== 'err') && !(
            /scan didn.t register/i.test(feedback)
            && !needsStationScan(team?.currentStage)
          ) ? (
            <p
              className={`rounded-xl px-3 py-2.5 text-center text-sm ${
                feedbackTone === 'err'
                  ? 'border border-amber-400/30 bg-amber-500/10 text-amber-100'
                  : feedbackTone === 'ok'
                    ? 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                    : 'border border-white/[0.08] bg-white/[0.03] text-white/80'
              }`}
            >
              {feedback}
            </p>
          ) : null}

          {/* Scan action */}
          {atCheckpoint && checkpointStatus?.assignmentMissing && (
            <section className={`${panel} border border-amber-400/35 bg-amber-500/10`}>
              <p className="text-sm font-semibold text-amber-100">Station not assigned yet</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
                {sanitizePlayerCopy(checkpointStatus.publicInstruction)
                  || 'Your scan station is not set up yet. Ask an organizer to update clues and regenerate the schedule.'}
              </p>
              <button
                type="button"
                onClick={() => onRefresh?.({ force: true })}
                className="mt-3 w-full rounded-xl border border-amber-300/30 bg-black/20 py-2.5 text-sm font-semibold text-amber-100"
              >
                Refresh status
              </button>
            </section>
          )}

          {atCheckpoint && checkpointStatus && !checkpointStatus.assignmentMissing && (
            <motion.section
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className={`${panel} space-y-4`}
              style={{ borderColor: `${checkpointTheme.hex}40` }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: checkpointTheme.hex }}
                >
                  {checkpointTheme.colorName} · scan
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {checkpointStatus.locationName || 'Station'}
                </h3>
                {Number(checkpointStatus.verifiedCount || 0) >= Number(checkpointStatus.requiredCount || 1) ? (
                  <p className="mt-1 text-sm text-emerald-300/90">Scanned</p>
                ) : null}
              </div>

              {timerRevealAtCheckpoint && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-3 text-sm">
                  <p className="text-amber-100/80">
                    Time&apos;s up — {revealAnswerLabel(timerRevealAtCheckpoint.n)} revealed (0 pts)
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">
                    {timerRevealAtCheckpoint.answer}
                  </p>
                </div>
              )}

              {checkpointExtra}

              {checkpointStatus.publicInstruction ? (
                <p className="text-sm text-white/60">
                  {sanitizePlayerCopy(checkpointStatus.publicInstruction)}
                </p>
              ) : null}

              {!isLeader ? (
                <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-center text-sm text-white/70">
                  Only the leader phone scans. Stay with your team.
                </p>
              ) : checkpointStatus.needJoinWord ? (
                <p className="text-center text-sm text-white/55">
                  Type the joined word above first — then scan unlocks.
                </p>
              ) : (
              <>
              {!checkpointStatus.youScanned
                && Number(checkpointStatus.verifiedCount || 0) < Number(checkpointStatus.requiredCount || 1) && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-full rounded-2xl py-5 text-base font-bold text-black shadow-lg"
                    style={{ background: checkpointTheme.hex }}
                  >
                    {showScanner ? 'Camera on — point at QR' : 'Scan QR'}
                  </button>
                  {showScanner && (
                    <HuntQrScanner
                      active
                      onScan={onStationScan}
                      accentHex={checkpointTheme.hex}
                      onClose={() => setShowScanner(false)}
                    />
                  )}
                  {!showPaste ? (
                    <button
                      type="button"
                      onClick={() => setShowPaste(true)}
                      className="w-full py-2 text-center text-xs text-white/40 underline hover:text-white/60"
                    >
                      Camera not working?
                    </button>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const raw = String(fd.get('stationRaw') || '').trim();
                        if (raw) onStationScan(raw);
                      }}
                      className="space-y-2"
                    >
                      <input
                        name="stationRaw"
                        placeholder="Paste CH- code"
                        autoComplete="off"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm tracking-wider uppercase outline-none focus:border-white/25"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl bg-white/[0.06] py-2.5 text-sm font-medium disabled:opacity-50"
                      >
                        Submit code
                      </button>
                    </form>
                  )}
                </>
              )}

              {checkpointStatus.youScanned
                && Number(checkpointStatus.verifiedCount || 0) < Number(checkpointStatus.requiredCount || 1)
                && !checkpointStatus.awaitingTeamCodeConfirm
                && !checkpointStatus.onePhoneMode && (
                <p className="text-center text-sm text-emerald-300/90">
                  Scanned · waiting for team
                  {!offlineMode ? (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => onRefresh?.({ force: true })}
                      >
                        Refresh
                      </button>
                    </>
                  ) : null}
                </p>
              )}

              {(
                !checkpointStatus.onePhoneMode
                && Number(checkpointStatus.requiredCount || 1) > 1
                && (
                  checkpointStatus.awaitingTeamCodeConfirm
                  || (Number(checkpointStatus.verifiedCount || 0) >= Number(checkpointStatus.requiredCount || 1)
                    && checkpointStatus.status !== 'complete')
                )
              ) && (
                <form onSubmit={onStationClaim} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-center text-sm text-emerald-200/90">
                    Poster scanned — confirm team code to unlock
                  </p>
                  <input
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                    placeholder={team.teamCode || 'CC001'}
                    autoComplete="off"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-lg tracking-wider uppercase outline-none focus:border-white/25"
                  />
                  <button
                    type="submit"
                    disabled={busy || !String(claimCode || '').trim()}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-black disabled:opacity-50"
                    style={{ background: checkpointTheme.hex }}
                  >
                    {busy ? 'Confirming…' : 'Confirm team code'}
                  </button>
                </form>
              )}

              {checkpointStatus.onePhoneMode
                && Number(checkpointStatus.verifiedCount || 0) >= Number(checkpointStatus.requiredCount || 1)
                && checkpointStatus.status !== 'complete'
                && checkpointStatus.status !== 'manual_reconciled'
                && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (offlineMode && team?.teamCode) {
                      void (async () => {
                        const result = await runAction(() => confirmStationCheckpointFn(team.id, {
                          teamCode: String(team.teamCode).toUpperCase(),
                        }));
                        if (result.ok) {
                          setFeedback('Checkpoint passed');
                          celebrate('Checkpoint passed');
                        }
                      })();
                      return;
                    }
                    void onRefresh?.({ force: true, burst: true });
                  }}
                  className="w-full rounded-2xl py-3.5 text-sm font-bold text-black disabled:opacity-50"
                  style={{ background: checkpointTheme.hex }}
                >
                  {busy ? 'Unlocking…' : 'Tap to unlock next clue'}
                </button>
              )}

              {import.meta.env.DEV && import.meta.env.VITE_CAMPUS_HUNT_DEV_CHEATS === '1' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const result = await runAction(() => forceUnlockClue2(team.id));
                    if (!result.ok) return;
                    const key = result.payload?.checkpointKey || checkpointStatus.checkpointKey;
                    celebrate(
                      key === '5'
                        ? 'Dev: cleared → Mindspark Lobby'
                        : key === '4'
                          ? 'Dev: cleared → Clue 5'
                          : key === '3'
                            ? 'Dev: cleared → Clue 4'
                            : key === '2'
                              ? 'Dev: cleared → Decode'
                              : key === '1'
                                ? 'Dev: cleared → Clue 2'
                                : 'Dev: checkpoint cleared',
                    );
                  }}
                  className="w-full rounded-xl border border-amber-400/30 py-2 text-xs text-amber-100/80"
                >
                  Dev: force scan
                </button>
              )}
              </>
              )}
            </motion.section>
          )}

          {atLobbyFinish && (
            <section
              className={`${panel} space-y-3 text-center`}
              style={{
                borderColor: `${STAGE_THEMES.destination.hex}99`,
                background: `linear-gradient(180deg, ${STAGE_THEMES.destination.softBg} 0%, rgba(20,14,4,0.92) 100%)`,
                boxShadow: `0 0 36px -16px ${STAGE_THEMES.destination.hex}`,
              }}
            >
              {timerRevealAtStart && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-3 text-left text-sm">
                  <p className="text-amber-100/80">
                    Time&apos;s up — {revealAnswerLabel(5)} revealed (0 pts)
                  </p>
                  <p className="mt-1 text-center font-mono text-2xl font-semibold tracking-wide">
                    {timerRevealAtStart}
                  </p>
                </div>
              )}
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: STAGE_THEMES.destination.hex }}
              >
                Mindspark Lobby
              </p>
              <p className="font-mono text-4xl font-semibold tracking-wide">{team.teamCode || '—'}</p>
              <p className="text-sm text-white/60">
                Ask the organizer for the finish code. First team in gets 200, then −10 each, down to 10.
              </p>
              {isLeader ? (
                <form
                  className="space-y-2 text-left"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const code = String(finishCode || '').trim();
                    if (!code) return;
                    const result = await runAction(() => submitFinishCodeFn(team.id, code));
                    if (!result.ok) return;
                    setFinishCode('');
                    celebrate(result.payload?.message || 'Score locked');
                    setAwardedFlash(result.payload?.finalScore ?? team.currentScore);
                    void onRefresh?.({ force: true, burst: true });
                  }}
                >
                  <input
                    value={finishCode}
                    onChange={(e) => setFinishCode(e.target.value.toUpperCase())}
                    placeholder="Finish code"
                    autoComplete="off"
                    className="w-full rounded-xl border bg-black/40 px-4 py-3 text-center font-mono text-lg tracking-wider uppercase text-white outline-none"
                    style={{ borderColor: `${STAGE_THEMES.destination.hex}88` }}
                  />
                  <button
                    type="submit"
                    disabled={busy || !String(finishCode || '').trim()}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold disabled:opacity-50"
                    style={{
                      background: STAGE_THEMES.destination.hex,
                      color: STAGE_THEMES.destination.ink,
                    }}
                  >
                    {busy ? 'Locking…' : 'Lock score'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-white/45">Leader submits the finish code.</p>
              )}
            </section>
          )}

          {/* Clue 1 — non-leader standby (online only) */}
          {!offlineMode && !waitingForRelease && activeChallenge?.challengeNumber === 1 && !isLeader && (
            <motion.section
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className={`${panel} space-y-3 text-center`}
              style={{ borderColor: `${clueTheme.hex}40` }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: clueTheme.hex }}
              >
                Clue 1
              </p>
              <h3 className="text-lg font-semibold text-white">Stay with your leader</h3>
              <p className="text-sm text-white/65">
                Only the leader phone answers. Orange scan unlocks next.
              </p>
            </motion.section>
          )}

          {/* Clue action — skip generic form on Clue 6 (lobby finish panel above) */}
          {!waitingForRelease
            && activeChallenge
            && activeChallenge.challengeNumber !== 6
            && (isLeader || activeChallenge.challengeNumber !== 1) && (
            <motion.section
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className={`${panel} space-y-4`}
              style={{ borderColor: `${clueTheme.hex}40` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: clueTheme.hex }}
                  >
                    {clueTheme.colorName}
                    {' · '}
                    {activeChallenge.challengeNumber === 3
                      ? 'Lockbox'
                      : activeChallenge.challengeNumber === 4
                        ? 'Field Terminal'
                        : activeChallenge.challengeNumber === 5
                          ? 'Final'
                          : `Clue ${activeChallenge.challengeNumber}`}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {activeChallenge.challengeNumber === 4
                      ? 'Worth your Zip score'
                      : activeChallenge.challengeNumber === 3
                        ? 'Worth 65 points'
                        : activeChallenge.challengeNumber === 5
                          ? 'Worth 45 points'
                          : 'Worth 50 points'}
                  </p>
                </div>
                {activeChallenge.challengeNumber === 2
                  && inInstructionPhase
                  && activeChallenge.timerStartsAt && (
                  <CountdownTimer
                    expiresAt={activeChallenge.timerStartsAt}
                    serverTime={serverTime}
                    label="Starts in"
                    onComplete={() => {
                      setInstructionEnded(true);
                      onRefresh?.({ force: true, burst: true });
                    }}
                  />
                )}
                {activeChallenge.expiresAt
                  && activeChallenge.challengeNumber !== 4
                  && !(
                    activeChallenge.challengeNumber === 2
                    && inInstructionPhase
                  ) && (
                  <CountdownTimer
                    expiresAt={activeChallenge.expiresAt}
                    serverTime={serverTime}
                    label={activeChallenge.timeExpired ? 'Time up' : 'Left'}
                    expiredLabel="0:00"
                    onComplete={
                      [2, 5].includes(activeChallenge.challengeNumber)
                        ? handleTimerExpired
                        : undefined
                    }
                  />
                )}
              </div>

              <ClueHowTo
                challenge={{
                  ...activeChallenge,
                  instructionPhase: inInstructionPhase,
                }}
                accentHex={clueTheme.hex}
              />

              {activeChallenge.state === 'ACTIVE'
                && [1, 2, 3, 5].includes(Number(activeChallenge.challengeNumber))
                && (activeChallenge.maxAttempts != null || activeChallenge.attemptsLeft != null) && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs">
                  <span className="text-white/55">
                    {activeChallenge.revealedAnswer || activeChallenge.failureReason === 'REVEALED_ZERO_POINTS'
                      ? 'Out of attempts — type the answer below for 0 pts'
                      : `${activeChallenge.maxAttempts || 3} attempts`}
                  </span>
                  {!(activeChallenge.revealedAnswer || activeChallenge.failureReason === 'REVEALED_ZERO_POINTS') && (
                    <span
                      className="font-semibold tabular-nums"
                      style={{
                        color: Number(activeChallenge.attemptsLeft) <= 1
                          ? '#FBBF24'
                          : clueTheme.hex,
                      }}
                    >
                      {activeChallenge.attemptsLeft ?? '—'} left
                    </span>
                  )}
                </div>
              )}

              {/* Clue 1 riddle only — Clues 2/3/5/6 use the 1·2·3 how-to (no duplicate prompt). */}
              {Number(activeChallenge.challengeNumber) === 1 && (
                activeChallenge.prompt == null ? (
                  <p className="text-sm text-white/50">Clue 1 is only on the Team Leader phone.</p>
                ) : (
                  <div className="rounded-xl bg-black/30 px-4 py-4">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/35">
                      Clue
                    </p>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/92">
                      {activeChallenge.prompt}
                    </p>
                  </div>
                )
              )}

              {activeChallenge.challengeNumber === 4
                && activeChallenge.state === 'ACTIVE' && (
                <div
                  className="space-y-3 rounded-xl border px-4 py-4"
                  style={{ borderColor: `${clueTheme.hex}55`, background: `${clueTheme.hex}12` }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: clueTheme.hex }}
                  >
                    Field Terminal · borrow a laptop
                  </p>
                  {activeChallenge.gridAccessCode ? (
                    <div className="rounded-xl bg-black/35 px-3 py-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/40">
                        Device key · type this on the laptop
                      </p>
                      <p
                        className="mt-2 font-mono text-2xl font-black tracking-[0.35em]"
                        style={{ color: clueTheme.hex }}
                      >
                        {activeChallenge.gridAccessCode}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const key = String(activeChallenge.gridAccessCode || '');
                          navigator.clipboard?.writeText(key).then(() => {
                            setCopiedGrid('key');
                            setTimeout(() => setCopiedGrid(''), 1600);
                          }).catch(() => {});
                        }}
                        className="mt-2 text-xs text-white/50 underline hover:text-white/80"
                      >
                        {copiedGrid === 'key' ? 'Copied' : 'Copy key'}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                      Device key not on this phone yet.
                      {offlineMode
                        ? ' Turn Wi‑Fi on for a few seconds, or ask the desk to Create leader packs again.'
                        : ' Tap refresh, or ask the desk for your Field Terminal key.'}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <a
                      href={activeChallenge.gridGameUrl || CAMPUS_HUNT_PATHS.grid}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl py-3 text-center text-sm font-bold uppercase tracking-wide text-black"
                      style={{ background: clueTheme.hex }}
                    >
                      Open Zip Grid (for laptop)
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const path = activeChallenge.gridGameUrl || CAMPUS_HUNT_PATHS.grid;
                        const url = `${window.location.origin}${path}`;
                        navigator.clipboard?.writeText(url).then(() => {
                          setCopiedGrid('link');
                          setTimeout(() => setCopiedGrid(''), 1600);
                        }).catch(() => {});
                      }}
                      className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
                    >
                      {copiedGrid === 'link' ? 'Link copied' : 'Copy link for laptop'}
                    </button>
                  </div>
                  <p className="text-xs text-white/45">
                    After the laptop shows GRID-XXXX, enter it below.
                  </p>
                  {activeChallenge.gridCompleted && (
                    <p className="text-xs font-medium text-emerald-200/90">
                      Grid cleared — type GRID-XXXX below.
                    </p>
                  )}
                </div>
              )}

              {activeChallenge.revealedAnswer && activeChallenge.state === 'ACTIVE' && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="text-amber-100/80">
                    {revealAnswerLabel(activeChallenge.challengeNumber)} revealed (0 pts) — type it below
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-semibold tracking-wide">
                    {activeChallenge.revealedAnswer}
                  </p>
                </div>
              )}

              {activeChallenge.revealedAnswer && activeChallenge.state !== 'ACTIVE' && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="text-amber-100/80">
                    {revealAnswerLabel(activeChallenge.challengeNumber)} revealed (0 pts)
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-semibold tracking-wide">
                    {activeChallenge.revealedAnswer}
                  </p>
                </div>
              )}

              {activeChallenge.timeExpired
                && !activeChallenge.revealedAnswer
                && [2, 5].includes(activeChallenge.challengeNumber) && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-3 text-sm text-amber-100/90">
                  <p className="font-semibold">Time&apos;s up — 0 points</p>
                  <p className="mt-1 text-xs text-amber-100/70">
                    Revealing the answer — type it to continue…
                  </p>
                </div>
              )}

              {activeChallenge.revealedLocation
                && !activeChallenge.revealedAnswer
                && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="text-amber-100/80">
                    {activeChallenge.state === 'ACTIVE'
                      ? 'Location revealed (0 pts) — type it below'
                      : 'Location revealed (0 pts)'}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold capitalize">
                    {activeChallenge.revealedLocation}
                  </p>
                </div>
              )}

              {activeChallenge.destinationInstruction && (
                <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50/90">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-200/70">Next</p>
                  <p className="mt-0.5 text-white">
                    {sanitizePlayerCopy(activeChallenge.destinationInstruction)}
                  </p>
                </div>
              )}

              {(activeChallenge.hintUsed || hintPreview) && (
                <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100/90">
                  Hint: {hintPreview || activeChallenge.hintText || '—'}
                </div>
              )}

              {isLeader
                && activeChallenge.state === 'ACTIVE' && (
                <form onSubmit={onSubmit} className="space-y-3">
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={
                      activeChallenge.challengeNumber === 1
                        ? 'Type the place name'
                        : activeChallenge.challengeNumber === 2
                          ? 'Digit answer from numbered slips'
                          : activeChallenge.challengeNumber === 3
                            ? 'Lockbox code'
                            : activeChallenge.challengeNumber === 4
                              ? 'GRID-XXXX'
                              : activeChallenge.challengeNumber === 6
                                ? 'Finish code from organizer'
                                : 'One word'
                    }
                    inputMode={
                      activeChallenge.challengeNumber === 3
                        || activeChallenge.challengeNumber === 4
                        ? 'text'
                        : 'text'
                    }
                    disabled={Boolean(inInstructionPhase)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-base outline-none focus:border-white/25 disabled:opacity-50"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={
                      busy
                      || !answer.trim()
                      || Boolean(inInstructionPhase)
                    }
                    className="w-full rounded-xl py-3.5 text-base font-semibold text-black disabled:opacity-45"
                    style={{ background: clueTheme.hex }}
                  >
                    {busy
                      ? 'Submitting…'
                      : inInstructionPhase
                        ? 'Wait for timer…'
                        : (activeChallenge.timeExpired
                          || activeChallenge.revealedAnswer
                          || activeChallenge.failureReason === 'REVEALED_ZERO_POINTS')
                          ? 'Submit for 0 pts'
                          : 'Submit'}
                  </button>
                  {activeChallenge.challengeNumber > 1
                    && !activeChallenge.hintUsed
                    && !activeChallenge.timeExpired
                    && !activeChallenge.revealedAnswer
                    && !inInstructionPhase && (
                    <button
                      type="button"
                      onClick={onHint}
                      disabled={busy}
                      className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/55"
                    >
                      Use hint (−{Number(activeChallenge.hintCost) || 20} pts)
                    </button>
                  )}
                </form>
              )}

              {!isLeader && activeChallenge.challengeNumber >= 2 && (
                <p className="text-center text-sm text-white/40">
                  Only the Team Leader can submit.
                </p>
              )}
            </motion.section>
          )}

          {atCheckpoint && !checkpointStatus && (
            <section className={`${panel} text-sm text-white/70`}>
              <p className="font-medium text-white/90">Next stop</p>
              <p className="mt-1">
                {(() => {
                  const stage = String(team.currentStage || '');
                  const n = stage.startsWith('CLUE_1') ? 1
                    : stage.startsWith('CLUE_2') ? 2
                      : stage.startsWith('CLUE_3') ? 3
                        : stage.startsWith('CLUE_4') ? 4
                          : stage.startsWith('CLUE_5') ? 5
                            : null;
                  const ch = n
                    ? challenges.find((c) => c.challengeNumber === n)
                    : null;
                  return sanitizePlayerCopy(ch?.destinationInstruction)
                    || 'Go to the place on your route. Leader scans the color poster once.';
                })()}
              </p>
              <button
                type="button"
                onClick={() => onRefresh?.({ force: true, burst: true })}
                className="mt-3 w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/70"
              >
                Refresh stop
              </button>
            </section>
          )}

          {!offlineMode && !waitingForRelease && (
            <button
              type="button"
              onClick={() => onRefresh?.({ force: true })}
              className="w-full py-2 text-center text-sm text-white/30 transition hover:text-white/55"
            >
              Refresh
            </button>
          )}

          {!waitingForRelease && (
            <div className="pt-2">
              <PoweredByCrwdCtrl />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
