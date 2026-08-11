import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from '../components/CountdownTimer';
import ScoreChip from '../components/ScoreChip';
import { CAMPUS_HUNT_PATHS } from '../config';
import {
  startFinaleMission,
  submitFinaleMission,
  abandonFinaleMission,
  stopFinaleTeam,
} from '../services/campusHunt.api';
import IntelHuntMission from './missions/IntelHuntMission';
import FieldTerminalMission from './missions/FieldTerminalMission';
import { teamPrimaryLabel } from '../utils/teamLabel';
import { formatUnlockDateTime } from '../utils/format';
import { missionCardShell, missionTheme } from '../admin/finaleMissionTheme';
import CampusHuntBackLink from '../components/CampusHuntBackLink';

const panel = 'rounded-2xl border border-white/[0.08] bg-[#121416]/85 p-4 backdrop-blur-sm';

const STATUS_LABEL = {
  available: 'Start',
  active: 'In progress',
  completed: 'Done',
  locked: 'Locked',
  coming_soon: 'Coming soon',
};

function MissionCard({ mission, disabled, busy, onStart, isLeader }) {
  const isDone = mission.status === 'completed';
  const isSoon = mission.status === 'coming_soon';
  const canStart = mission.status === 'available' && !disabled && isLeader;
  const { theme, shell, badge, cta } = missionCardShell(mission.id, { status: mission.status });

  return (
    <div
      className={`rounded-2xl border p-4 transition ${shell}`}
      style={{
        boxShadow: mission.status === 'active'
          ? `0 0 28px ${theme.hex}33`
          : undefined,
      }}
    >
      <div
        className="mb-3 h-1 w-12 rounded-full"
        style={{ background: theme.hex }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl">{mission.emoji || theme.emoji || '🎯'}</p>
          <h3 className="mt-1 text-sm font-bold uppercase tracking-wide text-white">
            {mission.title}
          </h3>
          {mission.points > 0 && (
            <p className={`mt-1 text-xs font-semibold ${theme.textClass}`}>
              +{mission.points} pts
            </p>
          )}
          {theme.colorName && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-white/35">
              {theme.colorName}
            </p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badge}`}>
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
          Start mission
        </button>
      )}
      {mission.status === 'available' && !disabled && !isLeader && (
        <p className="mt-3 text-center text-[11px] text-white/45">
          Only the Team Leader can start
        </p>
      )}
      {isDone && (
        <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
          Cleared
        </p>
      )}
      {isSoon && (
        <p className="mt-3 text-center text-[11px] text-white/40">Not unlocked yet</p>
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
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const entry = data?.entry;
  const round = data?.round;
  const missions = data?.missions || [];
  const activeMission = data?.activeMission;
  const isLeader = Boolean(data?.isLeader ?? teamMeta?.isLeader);
  const roundClosed = Boolean(round?.closed || round?.status === 'locked' || round?.status === 'finalized');
  const waitingForRelease = Boolean(data?.waitingForRelease);
  const activeTheme = missionTheme(activeMission?.missionId || activeMission?.playerView?.missionId);

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
    setBusy(true);
    setFeedback('');
    try {
      const res = await fn();
      const payload = res.data;
      if (onActionResult?.(payload)) {
        // applied
      } else {
        await onRefresh?.();
      }
      const msg = payload?.submitResult?.message
        || payload?.activeMission?.playerView?.message;
      if (msg) setFeedback(msg);
      if (payload?.submitResult?.complete) {
        setFeedback(payload.submitResult.message || 'Mission complete!');
      }
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
      } else {
        setFeedback(err.message || 'Action failed');
      }
      await onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleStart = (missionId) => runAction(() => startFinaleMission(teamId, missionId));

  const handleSubmit = (answer) => runAction(() =>
    submitFinaleMission(teamId, activeMission.missionId, answer));

  const handleAbandon = () => {
    if (!window.confirm('Leave this mission? You can start it again later.')) return;
    runAction(() => abandonFinaleMission(teamId));
  };

  const handleStop = () => {
    if (!window.confirm('Stop for now? You cannot start new missions until the organizer reopens.')) return;
    runAction(() => stopFinaleTeam(teamId));
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-10 pt-6 text-white">
      <CampusHuntBackLink to={CAMPUS_HUNT_PATHS.leaderboard} label="Back" className="mb-3" />
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
            {round?.label || 'Finals round'}
          </p>
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {waitingForRelease ? 'Finals holding' : 'Final Mission Board'}
          </h1>
          {teamMeta && (
            <p className="mt-1 text-sm text-white/55">{teamPrimaryLabel(teamMeta)}</p>
          )}
          {entry?.meetLocationName && (
            <p className="mt-1 text-xs text-white/40">
              Meet at {entry.meetLocationName}
              {entry.finaleSlot ? ` · Team ${entry.finaleSlot}` : ''}
            </p>
          )}
        </div>
        <ScoreChip score={entry?.finaleScore ?? 500} label="Score" />
      </header>

      {waitingForRelease && (
        <section className="mb-4 space-y-4">
          <div
            className="rounded-3xl border border-emerald-400/35 px-5 py-6 text-center"
            style={{
              background:
                'radial-gradient(ellipse at top, rgba(16,185,129,0.22), rgba(18,20,22,0.95) 55%)',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/85">
              You made it
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white">
              Congratulations
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Your team is initiated into the{' '}
              <span className="font-semibold text-emerald-100">Finals</span>.
              {entry?.promotionSource === 'direct_r1'
                ? ' Direct from Round 1.'
                : entry?.promotionSource === 'manual_pick'
                  ? ' Advanced through Survival.'
                  : ''}
            </p>
            <p className="mt-3 font-mono text-3xl font-black text-[#0ECCEE]">
              {entry?.finaleScore ?? 500}
              <span className="ml-1 text-sm font-semibold text-white/45">start pts</span>
            </p>
          </div>

          <div className={`${panel} space-y-4 text-center`} style={{ borderColor: '#F9731655' }}>
            {entry?.scheduledStartAt ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                    {round?.status === 'live'
                      ? (isLeader ? 'Mission board unlocks on' : 'Your team starts on')
                      : 'Finals begins on'}
                  </p>
                  <p className="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
                    {formatUnlockDateTime(entry.scheduledStartAt)}
                  </p>
                  {entry.meetLocationName && (
                    <p className="mt-2 text-sm text-white/55">
                      Meet at{' '}
                      <span className="font-medium text-white/85">{entry.meetLocationName}</span>
                      {isLeader ? ' · keep your team together' : ' · stay with your leader'}
                    </p>
                  )}
                </div>
                <CountdownTimer
                  expiresAt={entry.scheduledStartAt}
                  label="Time remaining"
                  expiredLabel="READY"
                  onComplete={onRefresh}
                  longForm
                  className="mx-auto w-full"
                />
                <p className="text-xs text-white/40">
                  {isLeader
                    ? 'When the timer hits READY, you open the mission board and start Mission 1.'
                    : 'Same idea as Round 1 — wait with your leader. Only the Team Leader starts missions.'}
                </p>
                {isLeader && round?.status === 'live' && (
                  <p className="rounded-xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/10 px-3 py-2 text-xs font-semibold text-[#0ECCEE]">
                    You’re the leader — stay ready to start
                  </p>
                )}
                {isLeader && round?.status !== 'live' && (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                    Finals hasn’t started yet. Organizers will go live — then your unlock timer counts down.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Standing by
                </p>
                <p className="text-sm text-white/70">
                  {round?.status === 'live'
                    ? 'Waiting for organizers to release your wave.'
                    : 'Finals round has not started yet. Stay at your meet point — the timer will appear when the schedule is locked.'}
                </p>
                {entry?.meetLocationName && (
                  <p className="text-sm text-white/55">
                    Meet at{' '}
                    <span className="font-medium text-white/85">{entry.meetLocationName}</span>
                  </p>
                )}
                {isLeader && (
                  <p className="pt-1 text-xs text-white/45">
                    Only the Team Leader starts the first mission after unlock.
                  </p>
                )}
              </div>
            )}
            {round?.releasesPaused && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-100">
                Releases paused — stay at your meet location.
              </p>
            )}
          </div>
        </section>
      )}

      {!waitingForRelease && round?.endsAt && (
        <CountdownTimer
          expiresAt={round.endsAt}
          label="Finals timer"
          expiredLabel="TIME'S UP"
          className="mb-4"
        />
      )}

      {roundClosed && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Finals round is locked. No new missions can be started.
        </p>
      )}

      {entry?.status === 'stopped' && (
        <p className="mb-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm text-white/70">
          Your team stopped early. Rest up — scores are locked when the timer ends.
        </p>
      )}

      {feedback && (
        <p className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/80">
          {feedback}
        </p>
      )}

      {!waitingForRelease && activeView ? (
        <div
          className="space-y-4 rounded-3xl border p-1"
          style={{
            borderColor: `${activeTheme.hex}66`,
            boxShadow: `0 0 40px ${activeTheme.hex}22`,
          }}
        >
          <div
            className={`mx-1 mt-1 rounded-2xl px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] ${activeTheme.bgClass} ${activeTheme.textClass}`}
          >
            {activeTheme.label || activeView.missionId}
          </div>
          {missionExpiresAt && (
            <CountdownTimer
              expiresAt={missionExpiresAt}
              label="Mission timer"
              expiredLabel="MISSION TIME UP"
              className="mx-1 mb-1"
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
          {(activeView.missionId === 'field_terminal' || activeView.missionId === 'borrowed_device') && (
            <FieldTerminalMission
              view={activeView}
              isLeader={isLeader}
              busy={busy}
              onSubmit={handleSubmit}
              onAbandon={handleAbandon}
            />
          )}
        </div>
      ) : !waitingForRelease ? (
        <>
          <p className="mb-3 text-center text-[11px] uppercase tracking-wide text-white/40">
            Orange · Intel · Blue · Device
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
              className="mt-6 w-full rounded-xl border border-white/15 py-3 text-xs font-semibold uppercase tracking-wide text-white/50 hover:border-white/30 hover:text-white/80"
            >
              Stop for now
            </button>
          )}
        </>
      ) : null}

      <div className="mt-8 text-center">
        <Link
          to={CAMPUS_HUNT_PATHS.leaderboard}
          className="text-xs text-white/40 underline hover:text-[#0ECCEE]"
        >
          View leaderboard
        </Link>
      </div>
    </div>
  );
}
