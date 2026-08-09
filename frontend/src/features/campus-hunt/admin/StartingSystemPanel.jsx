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

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

function entityId(value) {
  return String(value?._id || value?.id || value || '');
}

function dateTimeLocal(date = new Date(Date.now() + 15 * 60 * 1000)) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function pointLabel(point) {
  return `${point.code || '—'} · ${point.name || point.locationName || 'Starting point'}`;
}

export default function StartingSystemPanel({
  eventId,
  roundId,
  onChanged,
  mode = 'all',
}) {
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
    capacity: 10,
    active: true,
  });
  const [schedule, setSchedule] = useState({
    startsAt: dateTimeLocal(),
    releaseIntervalMinutes: 2,
    assignmentStrategy: 'route_balanced',
  });

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
    const timer = window.setInterval(() => {
      adminGetStartDashboard(eventId)
        .then((result) => setDashboard(result.data || null))
        .catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [eventId, refresh]);

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

  const createPoint = async (event) => {
    event.preventDefault();
    const result = await run(
      'create-point',
      () => adminCreateStartingPoint(eventId, {
        ...draft,
        roundId,
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        capacity: Number(draft.capacity),
      }),
      'Starting point created',
    );
    if (result) {
      setDraft({ code: '', name: '', description: '', capacity: 10, active: true });
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

  return (
    <div className="space-y-5">
      {showSetup && <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Starting points</h2>
            <p className="text-xs text-white/50">
              Teams are released in waves from their assigned physical location.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {points.length} configured
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {points.map((point) => (
            <div key={entityId(point)} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#0ECCEE]">{pointLabel(point)}</p>
                  <p className="mt-1 text-xs text-white/55">{point.description || 'No description'}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {point.capacity ?? '—'} team capacity ·{' '}
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
                        'Teams released per wave',
                        String(point.capacity ?? 10),
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
                    onClick={() => run(
                      `active-${entityId(point)}`,
                      () => adminUpdateStartingPoint(entityId(point), {
                        active: point.active === false,
                      }),
                      point.active === false ? 'Starting point activated' : 'Starting point deactivated',
                    )}
                    className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100"
                  >
                    {point.active === false ? 'Activate' : 'Deactivate'}
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

        <form onSubmit={createPoint} className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          <input
            required
            value={draft.code}
            onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))}
            placeholder="Code (NORTH)"
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
              aria-label="Teams per wave"
              className={`${inputClass} min-w-0`}
            />
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </form>
      </section>}

      {showSchedule && <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold">Build staggered schedule</h2>
        <p className="mt-1 text-xs text-white/50">
          Follow these steps in order. Preview does not save anything; Generate assigns every
          team; Lock prevents accidental changes.
        </p>
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
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-white/55">
            First release
            <input
              type="datetime-local"
              value={schedule.startsAt}
              onChange={(event) => setSchedule((value) => ({
                ...value,
                startsAt: event.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            />
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
          <label className="text-xs text-white/55">
            Assignment strategy
            <select
              value={schedule.assignmentStrategy}
              onChange={(event) => setSchedule((value) => ({
                ...value,
                assignmentStrategy: event.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            >
              <option value="route_balanced">Route balanced</option>
              <option value="sequential">Sequential / preserve valid routes</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !roundId || !points.length || !schedule.startsAt}
            onClick={async () => {
              const result = await run(
                'preview',
                () => adminPreviewStartSchedule(eventId, scheduleBody()),
                'Preview ready — review before generating',
              );
              if (result) {
                setPreview(result.data || null);
                setGenerated(false);
              }
            }}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            Preview
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !preview}
            onClick={async () => {
              const result = await run(
                'generate',
                () => adminGenerateStartSchedule(eventId, scheduleBody({
                  confirm: true,
                  reason: 'Generated from event control',
                })),
                'Assignments saved. Review the table, then lock the schedule.',
              );
              if (result) setGenerated(true);
            }}
            className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-100 disabled:opacity-40"
          >
            Generate assignments
          </button>
          <button
            type="button"
            disabled={
              Boolean(busy)
              || !preview
              || (!generated && dashboard?.round?.scheduleStatus !== 'locked')
            }
            onClick={() => {
              if (!window.confirm('Lock this start schedule? Manual changes will require an audited reason.')) return;
              run(
                'lock',
                () => adminLockStartSchedule(eventId, scheduleBody({
                  confirm: true,
                  reason: 'Schedule reviewed and locked by admin',
                })),
                'Start schedule locked',
              );
            }}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
          >
            Lock schedule
          </button>
        </div>

        {preview && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-white/5 text-white/50">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th>Starting point</th>
                  <th>Release</th>
                  <th>Route</th>
                  <th>Clue 1</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={entityId(row.teamId || row.team) || index} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono">{row.teamCode || row.team?.teamCode || '—'}</td>
                    <td>{row.startingPoint?.code || row.startingPointCode || '—'}</td>
                    <td>{row.scheduledStartAt ? new Date(row.scheduledStartAt).toLocaleString() : '—'}</td>
                    <td>{row.route?.routeKey || row.routeKey || '—'}</td>
                    <td>{row.clue1VariantKey || row.clue1Challenge?.variantKey || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!previewRows.length && (
              <p className="px-3 py-4 text-xs text-white/50">Preview returned no assignments.</p>
            )}
          </div>
        )}
      </section>}

      {showLive && <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Live release control</h2>
            <p className="text-xs text-white/50">Dashboard refreshes every 10 seconds.</p>
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
            className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${
              releasesPaused ? 'bg-emerald-500 text-black' : 'bg-red-500/20 text-red-100'
            }`}
          >
            {releasesPaused ? 'Resume all releases' : 'Pause all releases'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Waiting', summary.waiting],
            ['Ready', summary.ready],
            ['Released', summary.released],
            ['Active', summary.active],
          ].map(([label, count]) => (
            <div key={label} className="rounded-lg bg-black/25 p-3">
              <p className="text-xs text-white/45">{label}</p>
              <p className="text-xl font-bold">{count ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {groups.map((group) => {
            const point = group.startingPoint || group.point || group;
            const paused = Boolean(group.releasesPaused || point.releasesPaused);
            const teamRows = ungroupedTeams.filter(
              (team) => entityId(team.startingPoint) === entityId(point),
            );
            return (
              <div key={entityId(point)} className="rounded-xl bg-black/25 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pointLabel(point)}</p>
                    <p className="text-xs text-white/45">
                      Waiting {group.counts?.waiting ?? group.waiting ?? 0} · Released{' '}
                      {group.counts?.released ?? group.released ?? 0}
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
                    className={`rounded px-2 py-1 text-[11px] ${
                      paused ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-100'
                    }`}
                  >
                    {paused ? 'Resume point' : 'Pause point'}
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {teamRows.slice(0, 8).map((team) => (
                    <TeamReleaseRow
                      key={entityId(team)}
                      team={team}
                      busy={busy}
                      onRelease={() => run(
                        `release-${entityId(team)}`,
                        () => adminReleaseTeam(entityId(team), { reason: 'Manual release from dashboard' }),
                        `${team.teamCode || team.teamName} released`,
                      )}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {!groups.length && ungroupedTeams.length > 0 && (
            <div className="rounded-xl bg-black/25 p-3">
              <p className="mb-2 font-semibold">Upcoming teams</p>
              {ungroupedTeams.slice(0, 12).map((team) => (
                <TeamReleaseRow
                  key={entityId(team)}
                  team={team}
                  busy={busy}
                  onRelease={() => run(
                    `release-${entityId(team)}`,
                    () => adminReleaseTeam(entityId(team), { reason: 'Manual release from dashboard' }),
                    `${team.teamCode || team.teamName} released`,
                  )}
                />
              ))}
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
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-2 text-xs">
      <div className="min-w-0">
        <p className="truncate font-mono">{team.teamCode || team.teamName}</p>
        <p className="text-white/40">
          {team.startStatus || 'WAITING'} ·{' '}
          {team.scheduledStartAt ? new Date(team.scheduledStartAt).toLocaleTimeString() : 'unscheduled'}
        </p>
      </div>
      {!released && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            if (window.confirm(`Release ${team.teamCode || team.teamName} now?`)) onRelease();
          }}
          className="shrink-0 rounded bg-[#0ECCEE]/20 px-2 py-1 text-[#0ECCEE] disabled:opacity-40"
        >
          Release now
        </button>
      )}
    </div>
  );
}
