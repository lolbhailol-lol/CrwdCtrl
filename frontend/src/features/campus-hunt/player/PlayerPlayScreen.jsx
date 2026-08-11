import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreChip from '../components/ScoreChip';
import CountdownTimer from '../components/CountdownTimer';
import HuntQrScanner from '../components/HuntQrScanner';
import HuntProgressTrack from '../components/HuntProgressTrack';
import PassedCluesPanel from '../components/PassedCluesPanel';
import ClueHowTo from '../components/ClueHowTo';
import {
  themeForChallengeNumber,
  themeForPlayerContext,
} from '../types/stageTheme';
import { CAMPUS_HUNT_PATHS } from '../config';
import CampusHuntBackLink from '../components/CampusHuntBackLink';
import {
  submitChallengeAnswer,
  requestChallengeHint,
  scanStationCheckpoint,
  confirmStationCheckpoint,
  forceUnlockClue2,
} from '../services/campusHunt.api';
import PlayerInstructionBox from './PlayerInstructionBox';
import { buildPlayerNowGuide } from './playerNowGuide';
import { formatUnlockDateTime } from '../utils/format';
import { teamPrimaryLabel, teamSecondaryName } from '../utils/teamLabel';

function activeChallengeNumber(stage) {
  const m = String(stage || '').match(/^CLUE_(\d)_ACTIVE$/);
  return m ? Number(m[1]) : null;
}

function needsStationScan(stage) {
  return (
    stage === 'CLUE_1_COMPLETED'
    || stage === 'CLUE_2_COMPLETED'
    || stage === 'CLUE_2_FAILED'
    || stage === 'CLUE_2_TIMEOUT'
    || stage === 'CLUE_3_COMPLETED'
    || stage === 'CLUE_3_FAILED'
  );
}

function needsStartReport(stage) {
  return stage === 'CLUE_4_COMPLETED' || stage === 'CLUE_4_FAILED';
}

const panel = 'rounded-2xl border border-white/[0.08] bg-[#121416]/85 p-4 backdrop-blur-sm';

export default function PlayerPlayScreen({ data, onRefresh, onActionResult, eventSlug }) {
  const team = data?.team;
  const challenges = data?.challenges || [];
  const serverTime = data?.serverTime || team?.serverTime;
  const checkpointStatus = data?.checkpointStatus;
  const isLeader = Boolean(team?.isLeader);
  const activeNum = activeChallengeNumber(team?.currentStage);
  const hasStartGate = Boolean(team?.startStatus || team?.scheduledStartAt);
  const released = Boolean(
    team?.actualStartAt
    || ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team?.startStatus),
  );
  const waitingForRelease = hasStartGate && !released;

  const activeChallenge = useMemo(
    () => challenges.find((c) => c.challengeNumber === activeNum),
    [challenges, activeNum],
  );

  const clue1 = useMemo(
    () => challenges.find((c) => c.challengeNumber === 1),
    [challenges],
  );

  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hintPreview, setHintPreview] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successText, setSuccessText] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [awardedFlash, setAwardedFlash] = useState(null);
  const prevStageRef = useRef(team?.currentStage);

  useEffect(() => {
    if (!showSuccess) return undefined;
    const t = setTimeout(() => setShowSuccess(false), 1400);
    return () => clearTimeout(t);
  }, [showSuccess]);

  // When stage advances, jump to top so next clue/scan is immediately visible
  useEffect(() => {
    const stage = team?.currentStage;
    if (!stage || stage === prevStageRef.current) return;
    prevStageRef.current = stage;
    setShowScanner(false);
    setShowPaste(false);
    setAnswer('');
    setHintPreview('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [team?.currentStage]);

  const atCheckpoint = !waitingForRelease && needsStationScan(team?.currentStage) && !activeNum;

  // Auto-open camera on scan stages so the main action is one tap away
  useEffect(() => {
    if (!atCheckpoint || !checkpointStatus || checkpointStatus.youScanned) {
      return;
    }
    setShowScanner(true);
  }, [atCheckpoint, checkpointStatus?.checkpointId, checkpointStatus?.youScanned]);

  const applyResult = (resData) => {
    const applied = onActionResult?.(resData);
    if (!applied) {
      void onRefresh?.();
    }
  };

  if (!team) return null;

  const locked = team.currentStage === 'SCORE_LOCKED';
  const atStartReport = !waitingForRelease && needsStartReport(team.currentStage) && !activeNum;
  const checkpointTheme = themeForPlayerContext({
    stage: team.currentStage,
    checkpointKey: checkpointStatus?.checkpointKey,
  });
  const clueTheme = themeForChallengeNumber(activeNum || activeChallenge?.challengeNumber || 1);
  const nowThemeHex = atCheckpoint
    ? checkpointTheme.hex
    : atStartReport
      ? '#EF4444'
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
    atStartReport,
    activeNum,
    isLeader,
    team,
    checkpointStatus,
    activeChallenge,
  });

  const celebrate = (text) => {
    setSuccessText(text);
    setShowSuccess(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeNum || !isLeader) return;
    if (activeChallenge?.instructionPhase) {
      setFeedback('Read the instructions first — the 3-minute timer has not started yet.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      const attempts = Number(activeChallenge?.attempts || 0);
      const requestId = `${team.id}-c${activeNum}-a${attempts}`;
      const res = await submitChallengeAnswer(team.id, activeNum, answer, requestId);
      if (res.data?.correct) {
        setAnswer('');
        const pts = res.data.awardedPoints ?? 0;
        if (activeNum === 1) {
          celebrate(pts > 0 ? `Correct! +${pts} pts` : 'Correct! Head to Orange scan');
          setAwardedFlash(pts > 0 ? pts : null);
        } else if (activeNum === 2) {
          celebrate(
            pts > 0
              ? `Correct! +${pts} pts — green scan next`
              : 'Correct — green scan next',
          );
          setAwardedFlash(pts > 0 ? pts : null);
        } else if (activeNum === 3) {
          celebrate(
            pts > 0
              ? `Decoded! +${pts} pts — blue scan next`
              : 'Decoded — blue scan next',
          );
          setAwardedFlash(pts > 0 ? pts : null);
        } else if (activeNum === 4) {
          celebrate(
            pts > 0
              ? `Correct! +${pts} pts — report to start`
              : 'Correct — report to your start',
          );
          setAwardedFlash(pts > 0 ? pts : null);
        } else if (res.data?.late) {
          celebrate('Correct — time up (0 points)');
          setAwardedFlash(null);
        } else {
          celebrate(pts > 0 ? `Correct! +${pts} pts` : 'Correct!');
          setAwardedFlash(pts > 0 ? pts : null);
        }
        setFeedback(res.data.message || res.data.destinationInstruction || '');
      } else if (res.data?.revealed) {
        setAnswer('');
        celebrate('Location revealed — continue to scan');
        setAwardedFlash(null);
        setFeedback(
          res.data.message
          || `Location: ${res.data.revealedLocation}. Go scan the station QR.`,
        );
      } else if (res.data?.timedOut) {
        setFeedback('Time is up. Continue when ready.');
      } else {
        setFeedback(
          res.data?.message
          || `Incorrect. Attempts left: ${res.data?.attemptsLeft ?? 0}`,
        );
      }
      applyResult(res.data);
    } catch (err) {
      setFeedback(err.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const onHint = async () => {
    if (!activeNum || !isLeader) return;
    if (!window.confirm('Use Hint? This will cost 15 points.')) return;
    setBusy(true);
    try {
      const requestId = `hint-${team.id}-${activeNum}`;
      const res = await requestChallengeHint(team.id, activeNum, requestId);
      setHintPreview(res.data?.hint || '');
      applyResult(res.data);
    } catch (err) {
      setFeedback(err.message || 'Hint failed');
    } finally {
      setBusy(false);
    }
  };

  const onStationScan = async (raw) => {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const res = await scanStationCheckpoint(team.id, raw);
      const awaiting = Boolean(res.data?.awaitingTeamCodeConfirm || res.data?.verifiedCount >= 4);
      const unlocked = Boolean(
        res.data?.unlockedNext
        || res.data?.unlockedClue2
        || res.data?.unlockedClue3,
      );
      setFeedback(res.data?.message || 'Scanned');
      if (unlocked || awaiting) {
        setShowScanner(false);
      }
      if (unlocked) {
        celebrate(res.data?.message || 'All set — next step unlocked!');
      }
      applyResult(res.data);
    } catch (err) {
      setFeedback(err.message || 'Scan failed — use the station poster QR');
    } finally {
      setBusy(false);
    }
  };

  const onStationClaim = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    const code = String(claimCode || team?.teamCode || '').trim();
    if (!code) {
      setFeedback('Enter your team code');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      const res = await confirmStationCheckpoint(team.id, {
        teamCode: code,
        checkpointId: checkpointStatus?.checkpointId,
      });
      setFeedback(res.data?.message || 'Confirmed');
      if (res.data?.unlockedNext) {
        celebrate(res.data?.message || 'Clue unlocked!');
        setClaimCode('');
      }
      applyResult(res.data);
    } catch (err) {
      setFeedback(err.message || 'Team code confirm failed');
    } finally {
      setBusy(false);
    }
  };

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
        {/* Top bar — one clean team strip */}
        <header className="mb-5">
          <CampusHuntBackLink
            to={eventSlug ? CAMPUS_HUNT_PATHS.event(eventSlug) : '/'}
            label="Back"
            className="mb-3"
          />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-[1.35rem] font-semibold tracking-tight text-white">
                {teamPrimaryLabel(team)}
              </h1>
              <p className="mt-1 truncate text-sm text-white/50">
                {[
                  teamSecondaryName(team) || null,
                  team.myName
                    ? (isLeader ? `You · Leader · ${team.myName}` : `You · Player · ${team.myName}`)
                    : (isLeader ? 'You are leader' : (
                      team.leaderName ? `You are player · Leader ${team.leaderName}` : 'You are player'
                    )),
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <ScoreChip score={team.currentScore} />
          </div>
        </header>

        <div className="space-y-4">
          {!waitingForRelease && !locked && (
            <HuntProgressTrack stage={team.currentStage} />
          )}

          {!waitingForRelease && (
            <PlayerInstructionBox
              guide={nowGuide}
              themeHex={nowThemeHex}
              roleLabel={
                isLeader
                  ? 'You submit answers · everyone scans'
                  : 'You scan cards · leader submits answers'
              }
            />
          )}

          {waitingForRelease && (
            <section className={`${panel} space-y-4 text-center`} style={{ borderColor: '#F9731655' }}>
              {team.scheduledStartAt ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                      {isLeader ? 'Clue 1 unlocks on' : 'Your team starts on'}
                    </p>
                    <p className="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
                      {formatUnlockDateTime(team.scheduledStartAt)}
                    </p>
                    {team.startingPoint?.name && (
                      <p className="mt-2 text-sm text-white/55">
                        Meet at{' '}
                        <span className="font-medium text-white/85">
                          {team.startingPoint.name}
                        </span>
                        {isLeader ? ' · keep your team together' : ' · stay with your leader'}
                      </p>
                    )}
                  </div>
                  <CountdownTimer
                    expiresAt={team.scheduledStartAt}
                    serverTime={serverTime}
                    label="Time remaining"
                    expiredLabel="READY"
                    onComplete={onRefresh}
                    longForm
                    className="mx-auto w-full"
                  />
                </>
              ) : (
                <p className="text-sm text-white/60">
                  Waiting for organizers to set your unlock day and time.
                </p>
              )}
              {team.startingPoint?.description && (
                <p className="text-sm text-white/45">{team.startingPoint.description}</p>
              )}
              {team.releasePaused && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  Releases paused — stay at your start.
                </p>
              )}
            </section>
          )}

          {feedback ? (
            <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-center text-sm text-white/80">
              {feedback}
            </p>
          ) : null}

          {/* Scan action */}
          {atCheckpoint && checkpointStatus && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${panel} space-y-4`}
              style={{ borderColor: `${checkpointTheme.hex}40` }}
            >
              <div className="flex items-end justify-between gap-3">
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
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums" style={{ color: checkpointTheme.hex }}>
                    {checkpointStatus.verifiedCount}/{checkpointStatus.requiredCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-white/35">scanned</p>
                </div>
              </div>

              <div className="rounded-xl bg-black/25 px-3 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Shared station QR</p>
                <p className="mt-0.5 font-mono text-lg font-semibold">
                  {teamPrimaryLabel({
                    teamCode: team.teamCode,
                    teamName: team.teamName,
                  })}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  All 4 scan the same poster, then enter team code
                </p>
              </div>

              {!checkpointStatus.youScanned
                && !checkpointStatus.awaitingTeamCodeConfirm
                && checkpointStatus.verifiedCount < 4 && (
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
                      active={!busy}
                      onScan={onStationScan}
                      accentHex={checkpointTheme.hex}
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

              {Array.isArray(checkpointStatus.scanRoster) && checkpointStatus.scanRoster.length > 0 && (
                <ul className="space-y-1.5 rounded-xl bg-black/25 px-3 py-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
                    Who scanned
                  </p>
                  {checkpointStatus.scanRoster.map((m) => (
                    <li
                      key={m.userId || m.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className={m.scanned ? 'text-white/90' : 'text-white/45'}>
                        {m.name}
                        {m.role === 'leader' ? ' · Leader' : ''}
                      </span>
                      <span
                        className={
                          m.scanned
                            ? 'text-xs font-semibold text-emerald-300'
                            : 'text-xs text-white/35'
                        }
                      >
                        {m.scanned ? 'Done' : 'Waiting'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {checkpointStatus.youScanned
                && checkpointStatus.verifiedCount < 4
                && !checkpointStatus.awaitingTeamCodeConfirm && (
                <p className="text-center text-sm text-emerald-300/90">
                  You scanned · waiting for {checkpointStatus.membersNeeded} more
                </p>
              )}

              {(checkpointStatus.awaitingTeamCodeConfirm
                || (checkpointStatus.verifiedCount >= 4
                  && checkpointStatus.status !== 'complete')) && (
                <form onSubmit={onStationClaim} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-center text-sm text-emerald-200/90">
                    All 4 scanned — enter your team code to unlock your clue
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
                    disabled={busy}
                    className="w-full rounded-2xl py-3.5 text-sm font-bold text-black disabled:opacity-50"
                    style={{ background: checkpointTheme.hex }}
                  >
                    Confirm team code
                  </button>
                </form>
              )}

              {import.meta.env.DEV && import.meta.env.VITE_CAMPUS_HUNT_DEV_CHEATS === '1' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await forceUnlockClue2(team.id);
                      const key = res.data?.checkpointKey || checkpointStatus.checkpointKey;
                      celebrate(
                        key === '2'
                          ? 'Dev: all scanned → Decode'
                          : key === '1'
                            ? 'Dev: all scanned → Clue 2'
                            : 'Dev: checkpoint cleared',
                      );
                      applyResult(res.data);
                    } catch (err) {
                      setFeedback(err.message || 'Force unlock failed');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-xl border border-amber-400/30 py-2 text-xs text-amber-100/80"
                >
                  Dev: scan all 4
                </button>
              )}
            </motion.section>
          )}

          {atStartReport && (
            <section className={`${panel} space-y-3 text-center`} style={{ borderColor: '#EF444455' }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300/80">
                Team number
              </p>
              <p className="font-mono text-4xl font-semibold tracking-wide">{team.teamCode || '—'}</p>
              {teamSecondaryName(team) ? (
                <p className="text-sm text-white/50">{teamSecondaryName(team)}</p>
              ) : null}
              <p className="text-sm text-white/70">
                Meet at{' '}
                <span className="font-medium text-white">
                  {team.startingPoint?.name || team.startingPoint?.code || 'your starting point'}
                </span>
              </p>
            </section>
          )}

          {locked && (
            <section className={`${panel} text-center`}>
              <p className="text-xl font-semibold">Score locked</p>
              <p className="mt-2 text-2xl font-semibold text-[#0ECCEE]">
                {team.finalScore ?? team.currentScore}
              </p>
            </section>
          )}

          {/* Clue 1 — non-leader standby */}
          {!waitingForRelease && activeChallenge?.challengeNumber === 1 && !isLeader && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${panel} space-y-3 text-center`}
              style={{ borderColor: `${clueTheme.hex}40` }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: clueTheme.hex }}
              >
                Clue 1 · standby
              </p>
              <h3 className="text-lg font-semibold text-white">Stay with your leader</h3>
              <p className="text-sm text-white/65">
                Only the Team Leader types the answer on their phone.
                You&apos;ll scan the Orange card together next.
              </p>
              <p className="rounded-xl bg-black/25 px-3 py-2 text-xs text-white/45">
                Keep this screen open — it unlocks the Orange scan automatically.
              </p>
            </motion.section>
          )}

          {/* Clue action */}
          {!waitingForRelease && activeChallenge && (isLeader || activeChallenge.challengeNumber !== 1) && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
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
                      ? 'Decode'
                      : activeChallenge.challengeNumber === 4
                        ? 'Final'
                        : `Clue ${activeChallenge.challengeNumber}`}
                  </p>
                </div>
                {activeChallenge.challengeNumber === 2
                  && activeChallenge.instructionPhase
                  && activeChallenge.timerStartsAt && (
                  <CountdownTimer
                    expiresAt={activeChallenge.timerStartsAt}
                    serverTime={serverTime}
                    label="Starts in"
                    onComplete={onRefresh}
                  />
                )}
                {activeChallenge.expiresAt
                  && !(activeChallenge.challengeNumber === 2 && activeChallenge.instructionPhase) && (
                  <CountdownTimer
                    expiresAt={activeChallenge.expiresAt}
                    serverTime={serverTime}
                    label={activeChallenge.timeExpired ? 'Time up' : 'Left'}
                    onComplete={
                      activeChallenge.allowLateSubmit ? onRefresh : undefined
                    }
                  />
                )}
              </div>

              <ClueHowTo challenge={activeChallenge} />

              {activeChallenge.timeExpired && activeChallenge.allowLateSubmit && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                  Timer ended — you can still submit for 0 points.
                </p>
              )}

              {activeChallenge.prompt == null && activeChallenge.challengeNumber === 1 ? (
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
              )}

              {activeChallenge.collaborative && activeChallenge.memberCode && (
                <div className="rounded-xl bg-black/30 px-4 py-4 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">Your fragment</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.18em]">
                    {activeChallenge.memberCode}
                  </p>
                </div>
              )}

              {activeChallenge.revealedLocation && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="text-amber-100/80">Location revealed (0 pts)</p>
                  <p className="mt-0.5 text-lg font-semibold capitalize">
                    {activeChallenge.revealedLocation}
                  </p>
                </div>
              )}

              {activeChallenge.destinationInstruction && (
                <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50/90">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-200/70">Next</p>
                  <p className="mt-0.5 text-white">{activeChallenge.destinationInstruction}</p>
                </div>
              )}

              {(activeChallenge.hintUsed || hintPreview) && (
                <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100/90">
                  Hint: {hintPreview || activeChallenge.hintText || '—'}
                </div>
              )}

              {isLeader && activeChallenge.state === 'ACTIVE' && (
                <form onSubmit={onSubmit} className="space-y-3">
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={
                      activeChallenge.challengeNumber === 1
                        ? 'Type the place name'
                        : activeChallenge.challengeNumber === 2
                          ? '3-digit number'
                          : activeChallenge.challengeNumber === 3
                            ? 'Decoded word'
                            : 'One word'
                    }
                    inputMode={activeChallenge.challengeNumber === 2 ? 'numeric' : 'text'}
                    disabled={Boolean(activeChallenge.instructionPhase)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-base outline-none focus:border-white/25 disabled:opacity-50"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={
                      busy
                      || !answer.trim()
                      || Boolean(activeChallenge.instructionPhase)
                    }
                    className="w-full rounded-xl py-3.5 text-base font-semibold text-black disabled:opacity-45"
                    style={{ background: clueTheme.hex }}
                  >
                    {busy
                      ? 'Submitting…'
                      : activeChallenge.instructionPhase
                        ? 'Wait for timer…'
                        : activeChallenge.timeExpired
                          ? 'Submit for 0 pts'
                          : 'Submit'}
                  </button>
                  {activeChallenge.challengeNumber > 1
                    && !activeChallenge.hintUsed
                    && !activeChallenge.timeExpired
                    && !activeChallenge.instructionPhase && (
                    <button
                      type="button"
                      onClick={onHint}
                      disabled={busy}
                      className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/55"
                    >
                      Use hint (−15 pts)
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
              <p className="font-medium text-white/90">Next location</p>
              <p className="mt-1">
                {(team.currentStage === 'CLUE_1_COMPLETED'
                  ? clue1?.destinationInstruction
                  : challenges.find((c) => c.challengeNumber === 2)?.destinationInstruction)
                  || 'Go to the next place. All 4 members scan the shared QR, then enter your team code.'}
              </p>
            </section>
          )}

          {!waitingForRelease && (
            <PassedCluesPanel
              challenges={challenges}
              isLeader={isLeader}
              currentActiveNum={activeNum}
            />
          )}

          <button
            type="button"
            onClick={() => onRefresh?.()}
            className="w-full py-2 text-center text-sm text-white/30 transition hover:text-white/55"
          >
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}
