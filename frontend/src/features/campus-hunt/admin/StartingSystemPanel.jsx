import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminCreateStartingPoint,
  adminDeleteStartingPoint,
  adminGenerateStartSchedule,
  adminGetStartDashboard,
  adminListStartingPoints,
  adminLockStartSchedule,
  adminPreviewStartSchedule,
  adminReleaseTeam,
  adminSetRoundReleasesPaused,
  adminSetStartingPointPaused,
  adminUpdateStartingPoint,
} from '../services/campusHunt.api';
import {
  clue5WordForStart,
  firstStopForLocalTeam,
  fourthStopForLocalTeam,
  globalTeamNumber,
  resolveStations,
  secondStopForLocalTeam,
  thirdStopForLocalTeam,
  waitIndexForStart,
} from './campusHuntFormat';
import { stageLabel } from '../types/stages';
import { teamPrimaryLabel, teamSecondaryName } from '../utils/teamLabel';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

function entityId(value) {
  return String(value?._id || value?.id || value || '');
}

function dateTimeLocal(date = new Date(Date.now() + 15 * 60 * 1000)) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

/** Default Round 1 launch: today (or tomorrow) at 4:00 PM local. */
function round1LaunchDateTime() {
  return dateTimeAtHourMinute(16, 0);
}

/** Today (or tomorrow if already past) at local HH:MM — e.g. 16:00 for 4:00 PM. */
function dateTimeAtHourMinute(hour, minute = 0) {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() < Date.now() - 60 * 1000) {
    date.setDate(date.getDate() + 1);
  }
  return dateTimeLocal(date);
}

function formatClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatLeaveDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function pointLabel(point) {
  return `${point.code || '—'} · ${point.name || point.locationName || 'Starting point'}`;
}

function waitLetter(code) {
  const raw = String(code || '').toUpperCase().trim();
  if (/^[A-D]$/.test(raw)) return raw;
  return raw.match(/^START[-_\s]?([A-D])$/)?.[1] || raw.match(/^([A-D])/)?.[1] || null;
}

export default function StartingSystemPanel({
  eventId,
  roundId,
  onChanged,
  mode = 'all',
  eventMeta = null,
}) {
  const teamCapacity = Math.max(2, Number(eventMeta?.teamCapacity) || 40);
  const startCount = Math.max(1, Math.min(4, Number(eventMeta?.startCount) || 4));
  const teamsPerWait = Math.max(1, Math.ceil(teamCapacity / startCount));
  const activeStations = useMemo(
    () => resolveStations(eventMeta?.campusStations, eventMeta?.stationCount),
    [eventMeta?.campusStations, eventMeta?.stationCount],
  );
  const [points, setPoints] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [preview, setPreview] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({
    code: '',
    name: '',
    description: '',
    capacity: teamsPerWait,
    active: true,
  });
  const [schedule, setSchedule] = useState({
    startsAt: round1LaunchDateTime(),
    releaseIntervalMinutes: 5,
    assignmentStrategy: 'route_balanced',
  });
  const [scheduleHydrated, setScheduleHydrated] = useState(false);
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('waiting'); // waiting | all | released

  useEffect(() => {
    setDraft((prev) => ({ ...prev, capacity: teamsPerWait }));
  }, [teamsPerWait]);

  useEffect(() => {
    setScheduleHydrated(false);
    setGenerated(false);
    setPreview(null);
  }, [eventId]);

  // Load saved date / interval from the round when dashboard arrives
  useEffect(() => {
    if (scheduleHydrated || !dashboard?.round) return;
    const round = dashboard.round;
    const next = {};
    if (round.startsAt) {
      const at = new Date(round.startsAt);
      if (!Number.isNaN(at.getTime())) next.startsAt = dateTimeLocal(at);
    }
    if (round.releaseIntervalMinutes != null && Number(round.releaseIntervalMinutes) > 0) {
      next.releaseIntervalMinutes = Number(round.releaseIntervalMinutes);
    }
    if (Object.keys(next).length) {
      setSchedule((prev) => ({ ...prev, ...next }));
    }
    if (round.scheduleStatus === 'locked' || round.startsAt) {
      setGenerated(true);
    }
    setScheduleHydrated(true);
  }, [dashboard, scheduleHydrated]);

  const ensureDefaultLocations = async () => {
    const defaults = [
      { code: 'A', name: 'Library', description: `Starting point — ~${teamsPerWait} teams hold here. Hunt stops are separate campus stations.` },
      { code: 'B', name: 'Chanakya Porch', description: `Starting point — ~${teamsPerWait} teams hold here. Hunt stops are separate campus stations.` },
      { code: 'C', name: 'Design', description: `Starting point — ~${teamsPerWait} teams hold here. Hunt stops are separate campus stations.` },
      { code: 'D', name: 'Vyas Parking', description: `Starting point — ~${teamsPerWait} teams hold here. Hunt stops are separate campus stations.` },
    ].slice(0, startCount);
    setBusy('defaults');
    setMessage('');
    try {
      // Always re-fetch so we don't create against stale empty state.
      const latest = await adminListStartingPoints(eventId);
      const livePoints = latest.data?.startingPoints || latest.data?.points || [];
      const existingLetters = new Set(
        livePoints.map((point) => waitLetter(point.code)).filter(Boolean),
      );

      let created = 0;
      let skipped = 0;
      for (const loc of defaults) {
        if (existingLetters.has(loc.code)) {
          skipped += 1;
          continue;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await adminCreateStartingPoint(eventId, {
            ...loc,
            roundId: roundId || undefined,
            capacity: teamsPerWait,
            active: true,
          });
          created += 1;
          existingLetters.add(loc.code);
        } catch (err) {
          const msg = String(err.message || '');
          // Duplicate is fine — another tab / bootstrap already created it.
          if (/already exists/i.test(msg)) {
            skipped += 1;
            existingLetters.add(loc.code);
            continue;
          }
          throw err;
        }
      }

      await refresh();
      onChanged?.();
      if (created === 0 && skipped >= startCount) {
        setMessage(
          `All ${startCount} starting point${startCount === 1 ? '' : 's'} already exist. Ready.`,
        );
      } else {
        setMessage(
          `Starting points ready for ${startCount} start(s) `
          + `(~${teamsPerWait}/start · ${teamCapacity} teams) `
          + `(added ${created}, already had ${skipped}).`,
        );
      }
    } catch (error) {
      setMessage(error.message || 'Could not create default locations');
    } finally {
      setBusy('');
    }
  };

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [pointResult, dashboardResult] = await Promise.all([
      adminListStartingPoints(eventId),
      adminGetStartDashboard(eventId).catch(() => ({ data: null })),
    ]);
    setPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    setDashboard(dashboardResult.data || null);
  }, [eventId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
    // Live mode needs a faster queue poll; setup/schedule can stay quieter.
    const pollMs = mode === 'live' ? 10000 : 30000;
    const timer = window.setInterval(() => {
      adminGetStartDashboard(eventId)
        .then((result) => setDashboard(result.data || null))
        .catch(() => {});
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [eventId, refresh, mode]);

  const run = async (key, action, success) => {
    setBusy(key);
    setMessage('');
    try {
      const result = await action();
      setMessage(success);
      await refresh();
      onChanged?.();
      return result;
    } catch (error) {
      setMessage(error.message || 'Action failed');
      return null;
    } finally {
      setBusy('');
    }
  };

  const scheduleBody = (extra = {}) => ({
    roundId,
    startsAt: new Date(schedule.startsAt).toISOString(),
    releaseIntervalMinutes: Number(schedule.releaseIntervalMinutes),
    assignmentStrategy: schedule.assignmentStrategy,
    ...extra,
  });

  /** One-tap: preview + generate so date/interval are saved on teams. */
  const saveScheduleDateAndInterval = async () => {
    if (!roundId || !schedule.startsAt || points.length < 1) {
      setMessage(
        !roundId
          ? 'Create Round 1 first'
          : points.length < 1
            ? 'Add starting points first'
            : 'Pick a first-release date/time',
      );
      return;
    }
    const roundStatus = dashboard?.round?.status;
    const scheduleLocked = dashboard?.round?.scheduleStatus === 'locked';
    const liveOrLocked = roundStatus === 'live' || roundStatus === 'locked' || scheduleLocked;
    let forceResetProgress = false;
    if (liveOrLocked) {
      const ok = window.confirm(
        'Save this date & interval?\n\n'
        + 'Updates every team’s unlock time. Teams already hunting stay as they are '
        + 'unless you choose to reset them next.',
      );
      if (!ok) return;
      forceResetProgress = window.confirm(
        'Also force-reset in-progress teams back to WAITING?\n\n'
        + 'Only say OK if you intentionally want to wipe live progress.',
      );
    }

    setBusy('save-schedule');
    setMessage('');
    try {
      const previewResult = await adminPreviewStartSchedule(eventId, scheduleBody());
      setPreview(previewResult.data || null);
      await adminGenerateStartSchedule(eventId, scheduleBody({
        confirm: true,
        forceResetProgress,
        reason: forceResetProgress
          ? 'Saved date & interval from schedule panel (force reset)'
          : 'Saved date & interval from schedule panel',
      }));
      setGenerated(true);
      setMessage(
        forceResetProgress
          ? 'Date & interval saved (progress reset). Lock schedule when ready.'
          : 'Date & interval saved on all teams. Lock schedule when ready.',
      );
      await refresh();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Could not save schedule');
    } finally {
      setBusy('');
    }
  };

  const createPoint = async (event) => {
    event.preventDefault();
    const code = draft.code.trim().toUpperCase();
    if (waitLetter(code) && points.some((p) => waitLetter(p.code) === waitLetter(code))) {
      setMessage(`Starting point ${waitLetter(code)} already exists — edit it above instead.`);
      return;
    }
    const result = await run(
      'create-point',
      () => adminCreateStartingPoint(eventId, {
        ...draft,
        roundId: roundId || undefined,
        code,
        name: draft.name.trim(),
        description: draft.description.trim(),
        capacity: Number(draft.capacity),
      }),
      'Starting point saved',
    );
    if (result) {
      setDraft({ code: '', name: '', description: '', capacity: teamsPerWait, active: true });
    }
  };

  const previewRows = preview?.assignments
    || preview?.schedule?.assignments
    || preview?.teams
    || [];
  const rawGroups = dashboard?.startingPoints
    || dashboard?.groups
    || dashboard?.byStartingPoint
    || [];
  const groups = Array.isArray(rawGroups) ? rawGroups : Object.values(rawGroups);
  const summary = dashboard?.counts || dashboard?.summary || {
    waiting: (dashboard?.teams || []).filter((team) => team.startStatus === 'WAITING').length,
    ready: (dashboard?.teams || []).filter((team) => team.startStatus === 'READY').length,
    released: (dashboard?.teams || []).filter((team) => team.startStatus === 'RELEASED').length,
    active: (dashboard?.teams || []).filter((team) => team.startStatus === 'ACTIVE').length,
  };
  const releasesPaused = Boolean(
    dashboard?.releasesPaused || dashboard?.round?.releasesPaused,
  );

  const ungroupedTeams = useMemo(
    () => dashboard?.teams || dashboard?.upcomingTeams || [],
    [dashboard],
  );
  const showSetup = mode === 'all' || mode === 'setup';
  const showSchedule = mode === 'all' || mode === 'schedule';
  const showLive = mode === 'all' || mode === 'live';

  const requiredStartLetters = useMemo(
    () => ['A', 'B', 'C', 'D'].slice(0, startCount),
    [startCount],
  );
  const canonicalReadyCount = useMemo(() => {
    const letters = new Set(
      points
        .filter((p) => p.active !== false)
        .map((p) => waitLetter(p.code))
        .filter(Boolean),
    );
    return requiredStartLetters.filter((code) => letters.has(code)).length;
  }, [points, requiredStartLetters]);
  const locationsReady = canonicalReadyCount >= startCount;

  /** Local team 1–N release clock — same times at every active wait. */
  const waveTiming = useMemo(() => {
    const base = new Date(schedule.startsAt);
    const interval = Math.max(1, Number(schedule.releaseIntervalMinutes) || 5);
    if (Number.isNaN(base.getTime())) return [];
    return Array.from({ length: teamsPerWait }, (_, index) => {
      const at = new Date(base.getTime() + index * interval * 60 * 1000);
      return {
        teamNumber: index + 1,
        at,
        label: formatClock(at),
      };
    });
  }, [schedule.startsAt, schedule.releaseIntervalMinutes, teamsPerWait]);

  const activePoints = useMemo(() => {
    const order = ['A', 'B', 'C', 'D'];
    return [...points]
      .filter((p) => p.active !== false)
      .sort((a, b) => (
        order.indexOf(waitLetter(a.code) || '')
        - order.indexOf(waitLetter(b.code) || '')
      ))
      .slice(0, startCount);
  }, [points, startCount]);

  const startNames = useMemo(() => (
    activePoints.length
      ? activePoints.map((point) => point.name || point.code)
      : ['Library', 'Chanakya Porch', 'Design', 'Vyas Parking'].slice(0, startCount)
  ), [activePoints, startCount]);

  return (
    <div className="space-y-5">
      {showSetup && <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {startCount} starting point{startCount === 1 ? '' : 's'}
            </h2>
            <p className="text-xs text-white/50">
              {startNames.join(' · ') || 'Set under Clues → Starts & places'}
              {' '}— ~{teamsPerWait} team{teamsPerWait === 1 ? '' : 's'} each
              ({teamCapacity} overall). Hunt QR cards are separate (Clues tab).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy) || !eventId}
              onClick={ensureDefaultLocations}
              className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${
                locationsReady
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-[#0ECCEE] text-black'
              }`}
            >
              {busy === 'defaults'
                ? 'Saving…'
                : locationsReady
                  ? `Refresh / repair ${startCount} start${startCount === 1 ? '' : 's'}`
                  : `Add ${startCount} starting point${startCount === 1 ? '' : 's'}`}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs self-center ${
              locationsReady
                ? 'bg-emerald-500/20 text-emerald-100'
                : 'bg-amber-500/20 text-amber-100'
            }`}>
              {canonicalReadyCount}/{startCount} ready
            </span>
          </div>
        </div>

        {locationsReady && (
          <p className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            Locations are set. You can move to Teams → Schedule. No need to add A–D again.
          </p>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {points.map((point) => (
            <div key={entityId(point)} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#0ECCEE]">{pointLabel(point)}</p>
                  <p className="mt-1 text-xs text-white/55">{point.description || 'No description'}</p>
                  <p className="mt-1 text-xs text-white/40">
                    Max {point.capacity ?? teamsPerWait} teams ·{' '}
                    {point.active === false ? 'inactive' : 'active'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const name = window.prompt('Starting point name', point.name || '');
                      if (!name?.trim()) return;
                      const description = window.prompt('Player-facing description', point.description || '');
                      const capacity = window.prompt(
                        'Max teams at this location',
                        String(point.capacity ?? teamsPerWait),
                      );
                      if (!capacity || Number(capacity) < 1) return;
                      run(
                        `edit-${entityId(point)}`,
                        () => adminUpdateStartingPoint(entityId(point), {
                          name: name.trim(),
                          description: String(description || '').trim(),
                          capacity: Number(capacity),
                        }),
                        'Starting point updated',
                      );
                    }}
                    className="rounded bg-white/10 px-2 py-1 text-[11px]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (!window.confirm(`Delete ${pointLabel(point)}?`)) return;
                      run(
                        `delete-${entityId(point)}`,
                        () => adminDeleteStartingPoint(entityId(point)),
                        'Starting point deleted',
                      );
                    }}
                    className="rounded bg-red-500/15 px-2 py-1 text-[11px] text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!locationsReady && (
          <form onSubmit={createPoint} className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <input
              required
              value={draft.code}
              onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))}
              placeholder="Code (A)"
              className={inputClass}
            />
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
              placeholder="Display name"
              className={inputClass}
            />
            <input
              value={draft.description}
              onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))}
              placeholder="Meeting instructions"
              className={`${inputClass} lg:col-span-2`}
            />
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                required
                value={draft.capacity}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  capacity: event.target.value,
                }))}
                aria-label="Max teams at location"
                className={`${inputClass} min-w-0`}
              />
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </section>}

      {showSchedule && <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold">Staggered start ({schedule.releaseIntervalMinutes || 5} min)</h2>
        <p className="mt-1 text-xs text-white/50">
          Team 1 leaves at the first release time at all {startCount} starting point
          {startCount === 1 ? '' : 's'}. Team 2 leaves
          {' '}{schedule.releaseIntervalMinutes || 5} min later, and so on through Team {teamsPerWait}.
          {startCount > 1
            ? ` ${startCount} teams release together each wave (one per start).`
            : ' One team releases each wave from the single start.'}
          {' '}Overall: {teamCapacity} teams.
        </p>

        {(!roundId || canonicalReadyCount < startCount) && (
          <div className="mt-3 space-y-1 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
            <p className="font-semibold">Schedule controls are blocked until:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {!roundId && <li>Round 1 exists (use Create Round 1 below)</li>}
              {canonicalReadyCount < startCount && (
                <li>
                  {startCount} starting point{startCount === 1 ? '' : 's'} exist
                  ({canonicalReadyCount}/{startCount}) — go to Locations or Clues → Save setup
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            ['1', 'Preview', Boolean(preview)],
            ['2', 'Generate', generated],
            ['3', 'Review', generated],
            ['4', 'Lock', dashboard?.round?.scheduleStatus === 'locked'],
          ].map(([number, label, done]) => (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 ${
                done ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
              }`}
            >
              <span className="mr-1 text-white/40">{number}.</span> {label}
              {done ? ' ✓' : ''}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/55">
            First release (Team 1 at every location)
            <input
              type="datetime-local"
              value={schedule.startsAt}
              onChange={(event) => setSchedule((value) => ({
                ...value,
                startsAt: event.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => setSchedule((value) => ({
                ...value,
                startsAt: round1LaunchDateTime(),
              }))}
              className="mt-2 rounded-md bg-[#0ECCEE]/20 px-2.5 py-1 text-[11px] font-semibold text-[#0ECCEE] hover:bg-[#0ECCEE]/30"
            >
              Set 22 Aug · 4:00 PM
            </button>
            <button
              type="button"
              onClick={() => setSchedule((value) => ({
                ...value,
                startsAt: dateTimeAtHourMinute(16, 0),
              }))}
              className="ml-2 mt-2 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15"
            >
              Today/tomorrow 4 PM
            </button>
            {schedule.startsAt && (
              <p className="mt-2 text-[11px] text-white/45">
                First wave leaves:{' '}
                <span className="font-medium text-white/75">
                  {formatLeaveDateTime(new Date(schedule.startsAt))}
                </span>
              </p>
            )}
          </label>
          <label className="text-xs text-white/55">
            Interval (minutes)
            <input
              type="number"
              min="1"
              value={schedule.releaseIntervalMinutes}
              onChange={(event) => setSchedule((value) => ({
                ...value,
                releaseIntervalMinutes: event.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !roundId || points.length < 1 || !schedule.startsAt}
            onClick={saveScheduleDateAndInterval}
            className="rounded-lg bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy === 'save-schedule' ? 'Saving…' : 'Save date & interval'}
          </button>
          <p className="text-[11px] text-white/45">
            Writes first release time + stagger minutes onto every team (Preview + Generate).
          </p>
        </div>

        {waveTiming.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-3">
            <p className="text-sm font-semibold text-[#0ECCEE]">
              Release clock — same at all {startCount} start{startCount === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-[11px] text-white/50">
              {startNames.join(' · ')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {waveTiming.map((wave) => (
                <div
                  key={wave.teamNumber}
                  className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
                    Team {wave.teamNumber}
                  </p>
                  <p className="text-sm font-bold text-white">{wave.label}</p>
                  <p className="text-[10px] text-white/40">×{startCount} start{startCount === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-white/45">
              Example: Team 1 @ {waveTiming[0]?.label}
              {waveTiming[1] ? `, Team 2 @ ${waveTiming[1].label}` : ''}
              {waveTiming[2] ? `, Team 3 @ ${waveTiming[2].label}` : ''}
              {' '}— at {startNames.join(', ')}
              {startCount > 1 ? ' together' : ''}.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !roundId || points.length < 1 || !schedule.startsAt}
            title={
              !roundId
                ? 'Create Round 1 first'
                : points.length < 1
                  ? 'Add starting points on Locations tab'
                  : ''
            }
            onClick={async () => {
              const result = await run(
                'preview',
                () => adminPreviewStartSchedule(eventId, scheduleBody()),
                'Preview ready — next tap Generate',
              );
              if (result) {
                setPreview(result.data || null);
                setGenerated(false);
              }
            }}
            className="rounded-lg bg-[#0ECCEE] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            1. Preview
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !preview}
            title={!preview ? 'Run Preview first' : ''}
            onClick={async () => {
              const roundStatus = dashboard?.round?.status;
              const scheduleLocked = dashboard?.round?.scheduleStatus === 'locked';
              const liveOrLocked = roundStatus === 'live' || roundStatus === 'locked' || scheduleLocked;
              let forceResetProgress = false;
              if (liveOrLocked) {
                const ok = window.confirm(
                  'Round is live or schedule is locked. Regenerate will update bindings '
                  + 'but will NOT reset teams already in progress.\n\nContinue?',
                );
                if (!ok) return;
                forceResetProgress = window.confirm(
                  'Also force-reset in-progress teams back to WAITING? '
                  + 'Only say OK if you intentionally want to wipe live progress.',
                );
              }
              const result = await run(
                'generate',
                () => adminGenerateStartSchedule(eventId, scheduleBody({
                  confirm: true,
                  forceResetProgress,
                  reason: forceResetProgress
                    ? 'Generated from event control (force reset progress)'
                    : 'Generated from event control',
                })),
                forceResetProgress
                  ? 'Assignments saved (progress reset). Next: Lock schedule.'
                  : 'Assignments saved. Next: Lock schedule.',
              );
              if (result) setGenerated(true);
            }}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            2. Generate
          </button>
          <button
            type="button"
            disabled={
              Boolean(busy)
              || !preview
              || (!generated && dashboard?.round?.scheduleStatus !== 'locked')
            }
            title={
              !preview
                ? 'Run Preview first'
                : (!generated && dashboard?.round?.scheduleStatus !== 'locked')
                  ? 'Run Generate first'
                  : ''
            }
            onClick={() => {
              if (!window.confirm('Lock this start schedule? Manual changes will require an audited reason.')) return;
              run(
                'lock',
                () => adminLockStartSchedule(eventId, scheduleBody({
                  confirm: true,
                  reason: 'Schedule reviewed and locked by admin',
                })),
                'Schedule locked — you can Start Round 1 now',
              );
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            3. Lock schedule
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          Tip: use <strong className="text-white/70">Save date &amp; interval</strong> after
          picking the time, or Preview → Generate → Lock. Then Start Round 1 — players unlock
          live without refreshing.
        </p>

        {preview && (
          <div className="mt-4 space-y-3">
            <div className="space-y-2 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 px-4 py-3 text-sm text-white/75">
              <p className="font-semibold text-[#0ECCEE]">What this preview means</p>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
                <li>
                  <span className="font-semibold text-white">
                    Team 1–{teamCapacity}
                  </span>
                  {startCount === 1
                    ? ' — all meet at the same starting point, leave one team per wave.'
                    : (
                      <>
                        {' '}— split across {startCount} starts
                        (~{teamsPerWait} per start, sorted by team code).
                      </>
                    )}
                </li>
                <li>
                  <span className="font-semibold text-emerald-200">Meet here</span>
                  {' '}— starting point only ({startNames.join(', ') || 'active starts'}).
                  Not a campus scan place.
                </li>
                <li>
                  <span className="font-semibold text-white">Leave turn</span>
                  {startCount === 1
                    ? ' — Turn 1 = first team leaves, Turn 2 = next team '
                      + `${schedule.releaseIntervalMinutes || 5} min later, …`
                    : (
                      <>
                        {' '}— which turn they leave that place. Turn 1 = first group, Turn 2 ={' '}
                        {schedule.releaseIntervalMinutes || 5} minutes later, …
                        {` (same turn leaves from all ${startCount} places together).`}
                      </>
                    )}
                </li>
                <li>
                  <span className="font-semibold text-white">Leave time</span>
                  {' '}— clock time their Clue 1 unlocks.
                </li>
                <li>
                  <span className="font-semibold text-amber-100">Orange place</span>
                  {' '}— 1st campus scan (Clue 1).
                </li>
                <li>
                  <span className="font-semibold text-emerald-200">Green place</span>
                  {' '}— 2nd campus scan (Clue 2).
                </li>
                <li>
                  <span className="font-semibold text-sky-200">Blue place</span>
                  {' '}— 3rd campus scan (Clue 3).
                </li>
                <li>
                  <span className="font-semibold text-purple-200">Purple place</span>
                  {' '}— 4th campus scan after prop hunt (Clue 4).
                </li>
                <li>
                  <span className="font-semibold text-rose-200">Final</span>
                  {' '}— one-word puzzle on phones, then report back to Meet here.
                </li>
              </ul>
              {previewRows.some((r) => (
                !r.firstStopName || !r.secondStopName || !r.thirdStopName || !r.fourthStopName
              )) && (
                <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Orange → purple below are the <strong>planned path</strong> across campus places
                  (Food Court, Student Centre, … — not starting points).
                  To bind real QR cards, open <strong>Clues</strong>, save Clue 1–4, then Preview again.
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[1080px] text-left text-xs">
                <thead className="bg-white/5 text-white/55">
                  <tr>
                    <th className="px-3 py-2">Team</th>
                    <th>Meet here</th>
                    <th>Leave turn</th>
                    <th>Leave time</th>
                    <th>Orange place</th>
                    <th>Green place</th>
                    <th>Blue place</th>
                    <th>Purple place</th>
                    <th>Final</th>
                  </tr>
                </thead>
                <tbody>
                  {[...previewRows]
                    .map((row) => {
                      const code = String(
                        row.startingPointCode
                        || row.startingPoint?.code
                        || '',
                      ).toUpperCase();
                      const waitIdx = waitIndexForStart(
                        row.startingPointCode || waitLetter(code) || row.startingPointName,
                      );
                      const waveNum = Number(row.waveNumber) || 1;
                      const teamNumber = Number(row.teamNumber)
                        || globalTeamNumber(waitIdx, waveNum);
                      return { ...row, _waitIdx: waitIdx, _waveNum: waveNum, _teamNumber: teamNumber };
                    })
                    .sort((a, b) => a._teamNumber - b._teamNumber)
                    .map((row, index) => {
                      const release = row.scheduledStartAt
                        ? new Date(row.scheduledStartAt)
                        : null;
                      const code = String(
                        row.startingPointCode
                        || row.startingPoint?.code
                        || '',
                      ).toUpperCase();
                      const gatherName = row.startingPointName
                        || row.startingPoint?.name
                        || points.find((p) => String(p.code || '').toUpperCase() === code)?.name
                        || points.find((p) => waitLetter(p.code) === waitLetter(code))?.name
                        || code
                        || '—';
                      const wave = row._waveNum
                        || (release && waveTiming.length
                          ? (() => {
                            const base = new Date(schedule.startsAt).getTime();
                            const interval = Math.max(
                              1,
                              Number(schedule.releaseIntervalMinutes) || 5,
                            );
                            const slot = Math.round(
                              (release.getTime() - base) / (interval * 60 * 1000),
                            );
                            return Number.isFinite(slot) && slot >= 0 ? slot + 1 : null;
                          })()
                          : null);
                      const teamNumber = row._teamNumber;
                      const teamCode = row.teamCode || row.team?.teamCode || '';
                      const waitIdx = row._waitIdx;
                      const waveNum = wave || 1;
                      const OrangePlace = row.firstStopName
                        || firstStopForLocalTeam(waveNum, waitIdx, activeStations);
                      const greenPlace = row.secondStopName
                        || secondStopForLocalTeam(waveNum, waitIdx, activeStations);
                      const bluePlace = row.thirdStopName
                        || thirdStopForLocalTeam(waveNum, waitIdx, activeStations);
                      const purplePlace = row.fourthStopName
                        || fourthStopForLocalTeam(waveNum, waitIdx, activeStations);
                      const startCode = waitLetter(code) || code.charAt(0) || 'A';
                      const finalWord = clue5WordForStart(startCode);
                      const finalLabel = `${finalWord} → ${gatherName}`;
                      const fromClues = Boolean(
                        row.firstStopName
                        || row.secondStopName
                        || row.thirdStopName
                        || row.fourthStopName,
                      );
                      return (
                        <tr
                          key={entityId(row.teamId || row.team) || index}
                          className="border-t border-white/5"
                        >
                          <td className="px-3 py-2.5 font-medium text-white">
                            <span className="block">Team {teamNumber}</span>
                            <span className="block text-[10px] font-normal text-white/45">
                              {teamCode || '—'}
                              {row.teamName && !/^team\s*#?\s*\d+$/i.test(String(row.teamName).trim())
                                ? ` · ${row.teamName}`
                                : ''}
                            </span>
                          </td>
                          <td className="text-emerald-200">{gatherName}</td>
                          <td className="text-white">
                            {wave
                              ? (
                                <span>
                                  Turn {wave}
                                  <span className="block text-[10px] text-white/40">
                                    {wave === 1
                                      ? 'first to leave'
                                      : `${(wave - 1) * (Number(schedule.releaseIntervalMinutes) || 5)} min after Turn 1`}
                                  </span>
                                </span>
                              )
                              : '—'}
                          </td>
                          <td className="font-semibold text-white">
                            {release ? formatLeaveDateTime(release) : '—'}
                          </td>
                          <td className="text-amber-100">
                            {OrangePlace}
                            {!row.firstStopName && (
                              <span className="mt-0.5 block text-[10px] text-white/40">
                                {fromClues ? '' : 'planned path · save Clues to lock cards'}
                              </span>
                            )}
                          </td>
                          <td className="text-emerald-100/90">
                            {greenPlace}
                          </td>
                          <td className="text-sky-200/90">
                            {bluePlace}
                          </td>
                          <td className="text-purple-200/90">
                            {purplePlace}
                          </td>
                          <td className="text-rose-200/90">
                            {finalLabel}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {!previewRows.length && (
                <p className="px-3 py-4 text-xs text-white/50">
                  No teams to preview yet — create teams on the Teams tab first.
                </p>
              )}
            </div>
          </div>
        )}
      </section>}

      {showLive && <section className="rounded-2xl border border-cyan-400/30 bg-[#0a1218] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Live release desk
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">Release teams at each start</h2>
            <p className="mt-1 text-sm text-white/55">
              {teamCapacity} teams · {startCount} start{startCount === 1 ? '' : 's'}
              {' '}· auto-releases on schedule · tap Release for early / stuck teams
            </p>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || !roundId}
            onClick={() => run(
              'round-pause',
              () => adminSetRoundReleasesPaused(roundId, !releasesPaused, {
                reason: `${releasesPaused ? 'Resumed' : 'Paused'} from event control`,
              }),
              releasesPaused ? 'All releases resumed' : 'All releases paused',
            )}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
              releasesPaused
                ? 'bg-emerald-400 text-black'
                : 'border border-rose-400/40 bg-rose-500/20 text-rose-100'
            }`}
          >
            {releasesPaused ? '▶ Resume all' : '⏸ Pause all'}
          </button>
        </div>

        {releasesPaused && (
          <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            All timed releases are paused. Resume when starts are ready.
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            {
              label: 'Waiting',
              hint: 'Not released yet',
              count: Number(summary.waiting || 0) + Number(summary.ready || 0),
              color: 'text-amber-200',
            },
            {
              label: 'Released',
              hint: 'Clue 1 unlocked',
              count: summary.released,
              color: 'text-emerald-200',
            },
            {
              label: 'Hunting',
              hint: 'In progress',
              count: summary.active,
              color: 'text-[#0ECCEE]',
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-white/45">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.count ?? 0}</p>
              <p className="mt-1 text-[10px] text-white/35">{card.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={liveSearch}
            onChange={(e) => setLiveSearch(e.target.value)}
            placeholder="Find team code / name…"
            className="min-w-[12rem] flex-1 rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white"
          />
          {[
            ['waiting', 'Need release'],
            ['released', 'Already out'],
            ['all', 'All teams'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLiveFilter(id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                liveFilter === id
                  ? 'bg-[#0ECCEE] text-black'
                  : 'border border-white/15 text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {groups
            .filter((group) => {
              const point = group.startingPoint || group.point || group;
              const letter = waitLetter(point.code);
              if (!letter) return activePoints.some((p) => entityId(p) === entityId(point));
              return requiredStartLetters.includes(letter);
            })
            .map((group) => {
            const point = group.startingPoint || group.point || group;
            const paused = Boolean(group.releasesPaused || point.releasesPaused);
            let teamRows = ungroupedTeams.filter(
              (team) => entityId(team.startingPoint) === entityId(point),
            );
            // Prefer teams in current capacity when leftover CC teams exist
            teamRows = [...teamRows]
              .sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true }));
            const q = liveSearch.trim().toLowerCase();
            if (q) {
              teamRows = teamRows.filter((team) => (
                String(team.teamCode || '').toLowerCase().includes(q)
                || String(team.teamName || '').toLowerCase().includes(q)
              ));
            }
            if (liveFilter === 'waiting') {
              teamRows = teamRows.filter((team) => !['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team.startStatus));
            } else if (liveFilter === 'released') {
              teamRows = teamRows.filter((team) => ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team.startStatus));
            }
            teamRows = [...teamRows].sort((a, b) => {
              const ta = a.scheduledStartAt ? new Date(a.scheduledStartAt).getTime() : 0;
              const tb = b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : 0;
              if (ta !== tb) return ta - tb;
              return String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true });
            });

            return (
              <div
                key={entityId(point)}
                className={`rounded-xl border p-3 ${
                  paused
                    ? 'border-amber-400/35 bg-amber-500/10'
                    : 'border-white/10 bg-black/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">{pointLabel(point)}</p>
                    <p className="text-xs text-white/45">
                      Waiting {group.counts?.waiting ?? group.waiting ?? 0}
                      {' · '}Released {group.counts?.released ?? group.released ?? 0}
                      {(group.counts?.returningAtStart ?? group.returningAtStart)
                        ? ` · Back ${group.counts?.returningAtStart ?? group.returningAtStart}`
                        : ''}
                      {(group.counts?.finishLocked ?? group.finishLocked)
                        ? ` · Locked ${group.counts?.finishLocked ?? group.finishLocked}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => run(
                      `point-pause-${entityId(point)}`,
                      () => adminSetStartingPointPaused(entityId(point), !paused, {
                        reason: `${paused ? 'Resumed' : 'Paused'} point from event control`,
                      }),
                      paused ? 'Starting point resumed' : 'Starting point paused',
                    )}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      paused
                        ? 'bg-emerald-400 text-black'
                        : 'bg-amber-500/20 text-amber-100'
                    }`}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {teamRows.map((team) => (
                    <TeamReleaseRow
                      key={entityId(team)}
                      team={team}
                      busy={busy}
                      onRelease={() => run(
                        `release-${entityId(team)}`,
                        () => adminReleaseTeam(entityId(team), {
                          reason: 'Manual release from live desk',
                        }),
                        `${team.teamCode || team.teamName} released`,
                      )}
                    />
                  ))}
                  {!teamRows.length && (
                    <p className="px-1 py-2 text-xs text-white/40">
                      {liveFilter === 'waiting' ? 'No teams waiting here' : 'No teams match'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {!groups.length && ungroupedTeams.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/35 p-3 lg:col-span-2">
              <p className="mb-2 font-semibold text-white">All teams</p>
              <div className="space-y-1.5">
                {ungroupedTeams
                  .filter((team) => {
                    const q = liveSearch.trim().toLowerCase();
                    if (q && !(
                      String(team.teamCode || '').toLowerCase().includes(q)
                      || String(team.teamName || '').toLowerCase().includes(q)
                    )) return false;
                    if (liveFilter === 'waiting') {
                      return !['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team.startStatus);
                    }
                    if (liveFilter === 'released') {
                      return ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team.startStatus);
                    }
                    return true;
                  })
                  .map((team) => (
                    <TeamReleaseRow
                      key={entityId(team)}
                      team={team}
                      busy={busy}
                      onRelease={() => run(
                        `release-${entityId(team)}`,
                        () => adminReleaseTeam(entityId(team), {
                          reason: 'Manual release from live desk',
                        }),
                        `${team.teamCode || team.teamName} released`,
                      )}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>}

      {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
    </div>
  );
}

function TeamReleaseRow({ team, busy, onRelease }) {
  const released = ['RELEASED', 'ACTIVE', 'COMPLETED'].includes(team.startStatus);
  const when = team.scheduledStartAt
    ? new Date(team.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const secondary = teamSecondaryName(team);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold text-white">
          {teamPrimaryLabel(team)}
          {secondary ? (
            <span className="ml-2 font-sans font-normal text-white/45">{secondary}</span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/45">
          {[
            team.startStatus || 'WAITING',
            stageLabel(team.currentStage),
            `due ${when}`,
            team.currentScore != null ? `${team.currentScore} pts` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      {released ? (
        <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200">
          Out
        </span>
      ) : (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={onRelease}
          className="shrink-0 rounded-lg bg-[#0ECCEE] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
        >
          Release
        </button>
      )}
    </div>
  );
}
