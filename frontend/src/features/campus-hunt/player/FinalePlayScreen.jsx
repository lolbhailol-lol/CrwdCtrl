import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from '../components/CountdownTimer';
import ScoreChip from '../components/ScoreChip';
import UnlockHoldingCard from '../components/UnlockHoldingCard';
import { CAMPUS_HUNT_PATHS } from '../config';
import {
  startFinaleMission,
  submitFinaleMission,
  abandonFinaleMission,
  stopFinaleTeam,
} from '../services/campusHunt.api';
import IntelHuntMission from './missions/IntelHuntMission';
import LockboxMission from './missions/LockboxMission';
import FieldTerminalMission from './missions/FieldTerminalMission';
import BlackoutMission from './missions/BlackoutMission';
import { teamPrimaryLabel, teamSecondaryName } from '../utils/teamLabel';
import { FINALE_MISSIONS, missionCardShell } from '../admin/finaleMissionTheme';
import CampusHuntBackLink from '../components/CampusHuntBackLink';

const STATUS_LABEL = {
  available: 'Ready',
  active: 'Live',
  completed: 'Done',
  locked: 'Locked',
  coming_soon: 'Soon',
};

const ACCENT = '#F97316';

function MissionCard({ mission, disabled, busy, onStart, isLeader }) {
  const isDone = mission.status === 'completed';
  const isSoon = mission.status === 'coming_soon';
  const canStart = mission.status === 'available' && !disabled && isLeader;
  const { theme, shell, badge, cta } = missionCardShell(mission.id, { status: mission.status });
  const shortTitle = (theme.label || mission.title || '')
    .replace(/^MISSION\s*\d+\s*·\s*/i, '')
    .trim();

  return (
    <div className={`rounded-2xl border p-3.5 ${shell}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: theme.hex }}
              aria-hidden
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {theme.colorName}
            </p>
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-white">
            {shortTitle}
          </h3>
          {theme.short && (
            <p className="mt-0.5 text-[12px] leading-snug text-white/50">
              {theme.short}
            </p>
          )}
          {mission.points > 0 && (
            <p className="mt-1.5 text-xs font-medium" style={{ color: theme.hex }}>
              +{mission.points} pts
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge}`}>
          {STATUS_LABEL[mission.status] || mission.status}
        </span>
      </div>

      {canStart && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStart(mission.id)}
          className={`mt-3 w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${cta}`}
        >
          Start
        </button>
      )}
      {mission.status === 'available' && !disabled && !isLeader && (
        <p className="mt-2.5 text-center text-[11px] text-white/40">
          Leader starts
        </p>
      )}
      {isDone && (
        <p className="mt-2.5 text-center text-[11px] font-medium text-emerald-300/85">
          Cleared
        </p>
      )}
      {isSoon && (
        <p className="mt-2.5 text-center text-[11px] text-white/35">Not open yet</p>
      )}
    </div>
  );
}

export default function FinalePlayScreen({
  data,
  teamMeta,
  teamId,
  onRefresh,
  onActionResult,
  eventSlug,
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const busyRef = useRef(false);

  const entry = data?.entry;
  const round = data?.round;
  const missions = data?.missions || [];
  const activeMission = data?.activeMission;
  const isLeader = Boolean(data?.isLeader ?? teamMeta?.isLeader);
  const roundClosed = Boolean(round?.closed || round?.status === 'locked' || round?.status === 'finalized');
  const waitingForRelease = Boolean(data?.waitingForRelease);

  const completedCount = useMemo(() => {
    const fromMissions = missions.filter((m) => m.status === 'completed').length;
    const fromEntry = (entry?.completedMissionIds || []).length;
    return Math.max(fromMissions, fromEntry);
  }, [missions, entry?.completedMissionIds]);

  const allMissionsDone = completedCount >= FINALE_MISSIONS.length
    || (missions.length >= FINALE_MISSIONS.length
      && missions.every((m) => m.status === 'completed'));

  const scoreLocked = Boolean(
    allMissionsDone
    || entry?.status === 'locked',
  );

  const activeView = useMemo(() => {
    if (activeMission?.playerView) {
      return {
        ...activeMission.playerView,
        missionExpiresAt: activeMission.missionExpiresAt || activeMission.playerView.missionExpiresAt,
      };
    }
    return null;
  }, [activeMission]);

  const missionExpiresAt = activeMission?.missionExpiresAt
    || activeMission?.playerView?.missionExpiresAt;

  const runAction = async (fn) => {
    if (busyRef.current) return { ok: false, busy: true };
    busyRef.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const res = await fn();
      const payload = res.data;
      if (!onActionResult?.(payload)) {
        void onRefresh?.();
      }
      const msg = payload?.submitResult?.message
        || payload?.activeMission?.playerView?.message;
      if (payload?.submitResult?.complete) {
        setFeedback(payload.submitResult.message || 'Mission complete!');
      } else if (msg) {
        setFeedback(msg);
      }
      return { ok: true, payload };
    } catch (err) {
      const code = err?.code || err?.data?.code;
      if (code === 'NOT_RELEASED') {
        setFeedback('Not released yet — wait at your meet point, or ask an organizer to Release your team.');
      } else if (code === 'MISSION_COMPLETED') {
        setFeedback('This mission is already cleared. Refresh if the board looks wrong.');
      } else if (code === 'MISSION_ACTIVE') {
        setFeedback('Finish or abandon your current mission first.');
      } else if (code === 'FINALE_NOT_LIVE') {
        setFeedback('Finals are not live yet — wait for the organizer to Start Finals.');
      } else if (code === 'ENTRY_STOPPED') {
        setFeedback('Your team is stopped or locked. Ask an organizer to resume you.');
      } else if (code === 'ROUND_LOCKED') {
        setFeedback(err.message || 'This round is locked.');
      } else {
        setFeedback(err.message || 'Action failed');
      }
      // Only heal when server state may be ahead of the UI
      if (['MISSION_ACTIVE', 'MISSION_COMPLETED', 'NOT_RELEASED', 'WRONG_MISSION', 'NO_ACTIVE_RUN'].includes(code)) {
        void onRefresh?.();
      }
      return { ok: false, error: err };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleStart = (missionId) => runAction(() => startFinaleMission(teamId, missionId));

  const handleSubmit = async (answer) => {
    const result = await runAction(() =>
      submitFinaleMission(teamId, activeMission.missionId, answer));
    return result;
  };

  const handleAbandon = () => {
    if (!window.confirm('Leave this mission? You can start it again later.')) return;
    runAction(() => abandonFinaleMission(teamId));
  };

  const handleStop = () => {
    if (!window.confirm('Stop for now? You cannot start new missions until the organizer reopens.')) return;
    runAction(() => stopFinaleTeam(teamId));
  };

  const teamLabel = teamMeta ? teamPrimaryLabel(teamMeta) : (entry?.teamCode || 'Team');
  const teamSub = teamMeta ? teamSecondaryName(teamMeta) : (entry?.teamName || '');

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, ${ACCENT}22 0%, transparent 55%),
            radial-gradient(ellipse 70% 40% at 100% 80%, ${ACCENT}10 0%, transparent 50%),
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

      <div className="relative mx-auto max-w-lg px-4 pb-10 pt-4">
        <CampusHuntBackLink
          to={eventSlug ? CAMPUS_HUNT_PATHS.play(eventSlug) : CAMPUS_HUNT_PATHS.leaderboard}
          label="← All rounds"
          forceTo
          className="mb-3"
        />

        <header className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
                Finals · 12 teams
              </p>
              <h1 className="mt-1 truncate text-[1.35rem] font-semibold tracking-tight text-white">
                {teamLabel}
              </h1>
              <p className="mt-1 truncate text-sm text-white/50">
                {[
                  teamSub || null,
                  isLeader ? 'You · Leader' : 'You · Player',
                  entry?.meetLocationName ? `Meet · ${entry.meetLocationName}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <ScoreChip score={entry?.finaleScore ?? 500} label="Score" />
          </div>
        </header>

        <div className="space-y-4">
          {waitingForRelease && (
            <UnlockHoldingCard
              accentHex={ACCENT}
              eyebrow={
                round?.status === 'live'
                  ? (isLeader ? 'Mission board unlocks on' : 'Your team starts on')
                  : 'Finals begins on'
              }
              unlockAt={entry?.scheduledStartAt}
              meetLabel={entry?.meetLocationName}
              meetHint={isLeader ? 'keep your team together' : 'stay with your leader'}
              steps={[
                entry?.meetLocationName
                  ? `Stay at ${entry.meetLocationName}`
                  : 'Stay at your meet point',
                'Wait for the countdown',
                isLeader
                  ? 'When READY, open Mission 1 (Intel Hunt)'
                  : 'Only the Team Leader starts missions',
              ]}
              paused={Boolean(round?.releasesPaused)}
              pausedText="Releases paused — stay at your meet location."
              emptyText={
                round?.status === 'live'
                  ? 'Waiting for organizers to release your wave.'
                  : 'Finals not live yet. Stay at your meet point — your unlock timer appears after Start Finals.'
              }
              onReady={onRefresh}
              footer={
                isLeader && round?.status === 'live' ? (
                  <p className="rounded-xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 px-3 py-2 text-xs font-semibold text-[#0ECCEE]">
                    You’re the leader — stay ready to start
                  </p>
                ) : null
              }
            />
          )}

          {!waitingForRelease && !scoreLocked && round?.endsAt && (
            <CountdownTimer
              expiresAt={round.endsAt}
              label="Finals timer"
              expiredLabel="TIME'S UP"
            />
          )}

          {scoreLocked && !activeView && (
            <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                Finals complete
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Score locked · {entry?.finalScore ?? entry?.finaleScore ?? 0} pts
              </p>
              <p className="mt-2 text-sm text-white/60">
                {allMissionsDone
                  ? 'All four missions cleared. Rest up — check the leaderboard for standings.'
                  : 'Finals are locked. Scores are final for this round.'}
              </p>
              <Link
                to={CAMPUS_HUNT_PATHS.leaderboard}
                className="mt-4 inline-flex rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-black"
              >
                View leaderboard →
              </Link>
            </section>
          )}

          {entry?.status === 'stopped' && !scoreLocked && (
            <p className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/70">
              Your team stopped early. Scores lock when the timer ends.
            </p>
          )}

          {roundClosed && !scoreLocked && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
              Finals round is locked. No new missions can be started.
            </p>
          )}

          {feedback && (
            <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-center text-sm text-white/80">
              {feedback}
            </p>
          )}

          {!waitingForRelease && activeView ? (
            <div className="space-y-3">
              {missionExpiresAt && (
                <CountdownTimer
                  expiresAt={missionExpiresAt}
                  label="Mission timer"
                  expiredLabel="MISSION TIME UP"
                />
              )}
              {activeView.missionId === 'intel_hunt' && (
                <IntelHuntMission
                  view={activeView}
                  isLeader={isLeader}
                  busy={busy}
                  onSubmit={handleSubmit}
                  onAbandon={handleAbandon}
                />
              )}
              {activeView.missionId === 'lockbox' && (
                <LockboxMission
                  view={activeView}
                  isLeader={isLeader}
                  busy={busy}
                  onSubmit={handleSubmit}
                  onAbandon={handleAbandon}
                />
              )}
              {(activeView.missionId === 'field_terminal' || activeView.missionId === 'borrowed_device') && (
                <FieldTerminalMission
                  view={activeView}
                  isLeader={isLeader}
                  busy={busy}
                  onSubmit={handleSubmit}
                  onAbandon={handleAbandon}
                />
              )}
              {activeView.missionId === 'operation_blackout' && (
                <BlackoutMission
                  view={activeView}
                  isLeader={isLeader}
                  busy={busy}
                  onSubmit={handleSubmit}
                  onAbandon={handleAbandon}
                />
              )}
            </div>
          ) : !waitingForRelease && !scoreLocked ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                {FINALE_MISSIONS.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: m.hex }}
                      aria-hidden
                    />
                    {m.colorName}
                  </span>
                ))}
              </div>
              <p className="text-center text-xs text-white/40">
                {completedCount}/{FINALE_MISSIONS.length} missions cleared
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {missions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    isLeader={isLeader}
                    disabled={!data?.canStartMission || roundClosed || entry?.status === 'stopped'}
                    busy={busy}
                    onStart={handleStart}
                  />
                ))}
              </div>

              {isLeader && !roundClosed && entry?.status !== 'stopped' && (
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={busy}
                  className="w-full rounded-xl border border-white/15 py-3 text-xs font-semibold uppercase tracking-wide text-white/50 hover:border-white/30 hover:text-white/80"
                >
                  Stop for now
                </button>
              )}
            </>
          ) : null}

          {!scoreLocked && (
            <div className="pt-2 text-center">
              <Link
                to={CAMPUS_HUNT_PATHS.leaderboard}
                className="text-xs text-white/40 underline hover:text-[#0ECCEE]"
              >
                View leaderboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
