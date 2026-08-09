import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreChip from '../components/ScoreChip';
import CountdownTimer from '../components/CountdownTimer';
import HuntQrScanner from '../components/HuntQrScanner';
import HuntProgressTrack from '../components/HuntProgressTrack';
import PassedCluesPanel from '../components/PassedCluesPanel';
import ClueHowTo from '../components/ClueHowTo';
import { stageLabel } from '../types/stages';
import { CAMPUS_HUNT_PATHS } from '../config';
import {
  submitChallengeAnswer,
  requestChallengeHint,
  scanStationCheckpoint,
  forceUnlockClue2,
} from '../services/campusHunt.api';

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
    || stage === 'CLUE_4_COMPLETED'
    || stage === 'CLUE_4_FAILED'
  );
}

export default function PlayerPlayScreen({ data, onRefresh, eventSlug }) {
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
  const [awardedFlash, setAwardedFlash] = useState(null);

  useEffect(() => {
    if (!showSuccess) return undefined;
    const t = setTimeout(() => setShowSuccess(false), 2800);
    return () => clearTimeout(t);
  }, [showSuccess]);

  if (!team) return null;

  const locked = team.currentStage === 'SCORE_LOCKED';
  // Scanner only after a clue answer is correct — never while typing Clue 1/2/3/4
  const atCheckpoint = !waitingForRelease && needsStationScan(team.currentStage) && !activeNum;

  const celebrate = (text) => {
    setSuccessText(text);
    setShowSuccess(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeNum || !isLeader) return;
    setBusy(true);
    setFeedback('');
    try {
      const requestId = `${team.id}-${activeNum}-${Date.now()}`;
      const res = await submitChallengeAnswer(team.id, activeNum, answer, requestId);
      if (res.data?.correct) {
        setAnswer('');
        const pts = res.data.awardedPoints ?? 0;
        if (activeNum === 1) {
          celebrate(pts > 0 ? `Correct! +${pts} pts` : 'Correct! Head to the location');
          setAwardedFlash(pts);
        } else if (activeNum === 2) {
          celebrate(pts > 0 ? `Correct! +${pts} pts — next location` : 'Correct — go to next location');
          setAwardedFlash(pts);
        } else if (activeNum === 3) {
          celebrate(pts > 0 ? `Decoded! +${pts} pts` : 'Decoded!');
          setAwardedFlash(pts);
        } else if (res.data?.late) {
          celebrate('Correct — 0 points (time up)');
          setAwardedFlash(0);
        } else {
          celebrate(`Correct! +${pts} pts`);
          setAwardedFlash(pts);
        }
        setFeedback(res.data.message || res.data.destinationInstruction || '');
      } else if (res.data?.revealed) {
        setAnswer('');
        celebrate('Location revealed — 0 points');
        setAwardedFlash(0);
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
      await onRefresh?.();
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
      await onRefresh?.();
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
      setFeedback(res.data?.message || 'Scanned');
      if (res.data?.unlockedNext || res.data?.unlockedClue2 || res.data?.unlockedClue3
        || res.data?.verifiedCount >= 4) {
        celebrate(res.data?.message || 'Checkpoint cleared!');
      }
      await onRefresh?.();
    } catch (err) {
      setFeedback(err.message || 'Scan failed — use the station poster QR');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-lg space-y-6 px-4 py-6 text-white">
      {eventSlug && (
        <Link
          to={CAMPUS_HUNT_PATHS.event(eventSlug)}
          className="inline-block text-sm text-white/60 hover:text-[#0ECCEE]"
        >
          ← Event
        </Link>
      )}

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-x-4 top-16 z-50 mx-auto max-w-sm rounded-2xl border border-[#0ECCEE]/50 bg-[#0b0c0d]/95 px-5 py-6 text-center shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.45 }}
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#0ECCEE] text-2xl font-bold text-black"
            >
              ✓
            </motion.div>
            <p className="text-lg font-bold">{successText}</p>
            {awardedFlash != null && (
              <p className="mt-1 text-sm text-[#0ECCEE]">+{awardedFlash} points</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0ECCEE]">Campus Hunt</p>
          <h1 className="text-2xl font-bold">{team.teamName}</h1>
          <p className="text-sm text-white/60">{team.teamCode}</p>
        </div>
        <ScoreChip score={team.currentScore} />
      </header>

      {waitingForRelease && (
        <section className="space-y-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-5 text-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-200">Your starting point</p>
            <h2 className="mt-1 text-xl font-bold">
              {team.startingPoint?.name || team.startingPoint?.code || 'Assigned meeting point'}
            </h2>
            {team.startingPoint?.description && (
              <p className="mt-2 text-sm text-white/70">{team.startingPoint.description}</p>
            )}
          </div>
          {team.scheduledStartAt && (
            <CountdownTimer
              expiresAt={team.scheduledStartAt}
              serverTime={serverTime}
              label={isLeader ? 'Your clue releases in' : 'Your leader starts in'}
              expiredLabel="READY"
              onComplete={onRefresh}
              className="mx-auto max-w-xs"
            />
          )}
          <p className="text-sm text-white/75">
            {isLeader
              ? 'Clue 1 stays hidden until your team is released. Keep everyone together.'
              : `Your Team Leader starts at ${
                team.scheduledStartAt
                  ? new Date(team.scheduledStartAt).toLocaleTimeString()
                  : 'the assigned release time'
              }. You will not see Clue 1.`}
          </p>
          {team.releasePaused && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">
              Releases are temporarily paused by the event team. Stay at your starting point.
            </p>
          )}
        </section>
      )}

      {released && isLeader && (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="text-lg font-bold">🔥 YOUR HUNT HAS STARTED</p>
          {team.startingPoint?.name && (
            <p className="mt-1 text-xs text-white/60">
              Started from {team.startingPoint.name}
              {team.actualStartAt ? ` at ${new Date(team.actualStartAt).toLocaleTimeString()}` : ''}
            </p>
          )}
        </div>
      )}

      {released && !isLeader && team.currentStage === 'CLUE_1_ACTIVE' && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-4 text-center">
          <p className="font-semibold text-amber-100">Your Team Leader is solving Clue 1.</p>
          <p className="mt-1 text-sm text-white/65">
            Clue 1 is leader-only. Stay together and be ready for checkpoint verification.
          </p>
        </div>
      )}

      <HuntProgressTrack stage={team.currentStage} />

      <div className="rounded-2xl bg-white/5 px-4 py-3">
        <p className="text-xs uppercase text-white/50">Now</p>
        <p className="text-lg font-semibold">{stageLabel(team.currentStage)}</p>
        {isLeader ? (
          <p className="mt-1 text-xs text-[#0ECCEE]">Team Leader — clues, answers & scans</p>
        ) : (
          <p className="mt-1 text-xs text-amber-200">
            Scanner login — open camera / paste code only when the team is at a checkpoint
          </p>
        )}
      </div>

      {!waitingForRelease && (
        <PassedCluesPanel
          challenges={challenges}
          isLeader={isLeader}
          currentActiveNum={activeNum}
        />
      )}

      {/* After Clue 1: go to library + scan station QR */}
      {atCheckpoint && checkpointStatus && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 p-4"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-[#0ECCEE]">Physical checkpoint</p>
            <h2 className="text-xl font-bold">
              {checkpointStatus.locationName || 'Station'}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              {checkpointStatus.publicInstruction
                || 'Find the Campus Hunt QR poster. Every team member must scan it.'}
            </p>
          </div>

          <div className="rounded-xl bg-black/40 px-4 py-3 text-center">
            <p className="text-3xl font-bold text-[#0ECCEE]">
              {checkpointStatus.verifiedCount}/{checkpointStatus.requiredCount}
            </p>
            <p className="text-xs uppercase tracking-wide text-white/50">Members scanned</p>
            {checkpointStatus.youScanned ? (
              <p className="mt-2 text-sm text-emerald-300">You already scanned ✓</p>
            ) : (
              <p className="mt-2 text-sm text-amber-200">Your scan is still needed</p>
            )}
          </div>

          {!checkpointStatus.youScanned && (
            <>
              <button
                type="button"
                onClick={() => setShowScanner((v) => !v)}
                className="w-full rounded-lg border border-white/20 py-2 text-sm"
              >
                {showScanner ? 'Hide camera' : 'Open camera to scan station QR'}
              </button>
              {showScanner && (
                <HuntQrScanner
                  active={!busy}
                  onScan={onStationScan}
                />
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const raw = String(fd.get('stationRaw') || '').trim();
                  if (raw) onStationScan(raw);
                }}
                className="space-y-2"
              >
                <p className="text-xs text-white/40">
                  Camera failing? Paste the station code from the poster (e.g. CH-A1B2C3D4)
                </p>
                <input
                  name="stationRaw"
                  placeholder="CH-A1B2C3D4"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 font-mono text-sm tracking-wider uppercase"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-white/10 py-2 text-sm"
                >
                  Submit station code
                </button>
              </form>
            </>
          )}

          {checkpointStatus.youScanned && checkpointStatus.verifiedCount < 4 && (
            <p className="text-center text-sm text-white/60">
              Waiting for {checkpointStatus.membersNeeded} more teammate
              {checkpointStatus.membersNeeded === 1 ? '' : 's'}…
            </p>
          )}

          {import.meta.env.DEV && (
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
                      ? 'Dev: all scanned → Decode clue'
                      : key === '1'
                        ? 'Dev: all scanned → Clue 2'
                        : 'Dev: checkpoint cleared',
                  );
                  await onRefresh?.();
                } catch (err) {
                  setFeedback(err.message || 'Force unlock failed');
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-lg border border-amber-400/40 bg-amber-500/10 py-2 text-sm text-amber-100"
            >
              Dev: scan all 4 & continue
            </button>
          )}
        </motion.section>
      )}

      {locked && (
        <div className="rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 p-4 text-center">
          <p className="text-xl font-bold">SCORE LOCKED</p>
          <p className="mt-1 text-white/70">Final score: {team.finalScore ?? team.currentScore}</p>
        </div>
      )}

      {/* Active clue */}
      {!waitingForRelease && activeChallenge && (isLeader || activeChallenge.challengeNumber !== 1) && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {activeChallenge.challengeNumber === 3
                ? 'Clue 3 — Decode'
                : activeChallenge.challengeNumber === 4
                  ? 'Final clue'
                  : `Clue ${activeChallenge.challengeNumber}`}
            </h2>
            {activeChallenge.expiresAt && (
              <CountdownTimer
                expiresAt={activeChallenge.expiresAt}
                serverTime={serverTime}
                label={activeChallenge.timeExpired ? 'Time up' : 'Time left'}
              />
            )}
          </div>

          <ClueHowTo challenge={activeChallenge} />

          {activeChallenge.timeExpired && activeChallenge.challengeNumber === 2 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Timer ended. You can still submit the correct number — you will get 0 points.
            </div>
          )}

          {activeChallenge.prompt == null && activeChallenge.challengeNumber === 1 ? (
            <p className="text-white/60">
              Clue 1 is visible only to your Team Leader. Stay together.
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-base leading-relaxed text-white/90">
              {activeChallenge.prompt}
            </p>
          )}

          {activeChallenge.revealedLocation && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
              <p className="font-semibold">Location revealed (0 pts)</p>
              <p className="mt-1 text-lg font-bold capitalize text-white">
                {activeChallenge.revealedLocation}
              </p>
              {activeChallenge.destinationInstruction && (
                <p className="mt-1 text-xs text-white/70">
                  {activeChallenge.destinationInstruction}
                </p>
              )}
            </div>
          )}

          {(activeChallenge.hintUsed || hintPreview) && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-100">
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
                    ? 'Type the location'
                    : activeChallenge.challengeNumber === 2
                      ? 'Enter 3-digit number'
                      : activeChallenge.challengeNumber === 3
                        ? 'Enter decoded word'
                        : 'Enter answer'
                }
                inputMode={activeChallenge.challengeNumber === 2 ? 'numeric' : 'text'}
                className="w-full rounded-xl border border-white/20 bg-[#161718] px-4 py-3 text-white"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={busy || !answer.trim()}
                className="w-full rounded-xl bg-[#0ECCEE] py-3 font-semibold text-black disabled:opacity-50"
              >
                {busy
                  ? 'Submitting…'
                  : activeChallenge.timeExpired
                    ? 'Submit for 0 pts'
                    : 'Submit'}
              </button>
              {activeChallenge.challengeNumber > 1
                && !activeChallenge.hintUsed
                && !activeChallenge.timeExpired && (
                <button
                  type="button"
                  onClick={onHint}
                  disabled={busy}
                  className="w-full rounded-xl border border-amber-400/50 py-2 text-sm text-amber-200"
                >
                  Use hint (−15 pts)
                </button>
              )}
            </form>
          )}

          {!isLeader && activeChallenge.challengeNumber === 2 && (
            <p className="text-sm text-white/50">
              Help find the number — only the Team Leader can submit.
            </p>
          )}
        </section>
      )}

      {!waitingForRelease && !isLeader && activeChallenge?.challengeNumber === 1 && (
        <section className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 p-4 text-center">
          <p className="font-semibold">Clue 1 is with your Team Leader</p>
          <p className="mt-1 text-sm text-white/65">Stay together and help navigate once they solve it.</p>
        </section>
      )}

      {/* Destination reminder if checkpointStatus not loaded yet */}
      {atCheckpoint && !checkpointStatus && (
        <section className="rounded-2xl bg-white/5 p-4 text-sm text-white/80">
          <p className="font-semibold text-[#0ECCEE]">Next location</p>
          <p className="mt-1">
            {(team.currentStage === 'CLUE_1_COMPLETED'
              ? clue1?.destinationInstruction
              : challenges.find((c) => c.challengeNumber === 2)?.destinationInstruction)
              || 'Go to the next location. All 4 members must scan the station QR.'}
          </p>
        </section>
      )}

      {!waitingForRelease && !activeChallenge && !atCheckpoint && !locked && (
        <section className="rounded-2xl bg-white/5 p-4 text-sm text-white/70">
          <p>Waiting for the round to begin.</p>
        </section>
      )}

      {feedback ? (
        <p className="text-center text-sm text-white/80">{feedback}</p>
      ) : null}

      <button
        type="button"
        onClick={() => onRefresh?.()}
        className="w-full text-sm text-white/50 underline"
      >
        Refresh status
      </button>
    </div>
  );
}
