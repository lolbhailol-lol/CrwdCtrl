import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetStartDashboard,
  adminMarkTeamStartReached,
} from '../services/campusHunt.api';
import { STAGE_THEMES } from '../types/stageTheme';
import { isGenericTeamName } from '../utils/teamLabel';

const THEME = STAGE_THEMES.final;

const RETURNING_STAGES = new Set(['CLUE_4_COMPLETED', 'CLUE_4_FAILED']);
const DONE_STAGES = new Set(['SCORE_LOCKED', 'FINISH_COMPLETED']);

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function waitLetter(code) {
  const raw = String(code || '').toUpperCase().trim();
  if (/^[A-D]$/.test(raw)) return raw;
  return raw.match(/^START[-_\s]?([A-D])$/)?.[1] || raw.match(/^([A-D])/)?.[1] || null;
}

function stageBucket(stage) {
  const s = String(stage || '');
  if (RETURNING_STAGES.has(s)) return 'returning';
  if (DONE_STAGES.has(s)) return 'done';
  if (s === 'WAITING' || !s) return 'waiting';
  return 'out';
}

/**
 * Red Final board: teams coming back to each active start.
 * Sized to event teamCapacity / startCount (not fixed 40×4×10).
 */
export default function FinishReturnBoard({
  eventId,
  reloadKey = 0,
  onChanged,
  eventMeta = null,
}) {
  const teamCapacity = Math.max(2, Number(eventMeta?.teamCapacity) || 40);
  const startCount = Math.max(1, Math.min(4, Number(eventMeta?.startCount) || 4));
  const teamSize = Math.max(2, Math.min(8, Number(eventMeta?.teamSize) || 4));
  const teamsPerWait = Math.max(1, Math.ceil(teamCapacity / startCount));

  const [dashboard, setDashboard] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [lookup, setLookup] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminGetStartDashboard(eventId);
      setDashboard(res.data || null);
    } catch (err) {
      setError(err.message || 'Could not load return board');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, reloadKey]);

  useEffect(() => {
    if (!eventId) return undefined;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 12000);
    return () => clearInterval(t);
  }, [eventId, refresh]);

  const layoutTeamIds = useMemo(() => {
    const all = [...(dashboard?.teams || [])]
      .sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true }))
      .slice(0, teamCapacity);
    return new Set(all.map((t) => id(t)));
  }, [dashboard, teamCapacity]);

  const teams = useMemo(
    () => (dashboard?.teams || []).filter((t) => layoutTeamIds.has(id(t))),
    [dashboard, layoutTeamIds],
  );

  const points = useMemo(() => {
    const order = ['A', 'B', 'C', 'D'];
    const required = order.slice(0, startCount);
    const starts = [...(dashboard?.startingPoints || [])]
      .filter((p) => p.active !== false)
      .sort((a, b) => (
        order.indexOf(waitLetter(a.code) || '')
        - order.indexOf(waitLetter(b.code) || '')
      ))
      .filter((p) => {
        const letter = waitLetter(p.code);
        return letter ? required.includes(letter) : true;
      })
      .slice(0, startCount);

    return starts.map((point) => {
      const assigned = teams.filter((team) => id(team.startingPoint) === id(point));
      const returning = assigned.filter((t) => stageBucket(t.currentStage) === 'returning');
      const done = assigned.filter((t) => stageBucket(t.currentStage) === 'done');
      const out = assigned.filter((t) => stageBucket(t.currentStage) === 'out');
      const capacity = Math.max(
        teamsPerWait,
        Number(point.capacity) || 0,
        assigned.length,
      );
      return {
        point,
        assigned,
        returning,
        done,
        out,
        capacity,
      };
    });
  }, [dashboard, teams, startCount, teamsPerWait]);

  const totals = useMemo(() => ({
    returning: teams.filter((t) => stageBucket(t.currentStage) === 'returning').length,
    done: teams.filter((t) => stageBucket(t.currentStage) === 'done').length,
    out: teams.filter((t) => stageBucket(t.currentStage) === 'out').length,
    total: teams.length,
    capacity: teamCapacity,
  }), [teams, teamCapacity]);

  const markReached = async (team, reason = 'Organizer marked reached at start') => {
    const teamId = id(team);
    if (!teamId) return;
    setBusyId(teamId);
    setMessage('');
    setError('');
    try {
      await adminMarkTeamStartReached(teamId, { reason });
      setMessage(`${team.teamCode || 'Team'} marked complete · score locked`);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not mark team');
    } finally {
      setBusyId('');
    }
  };

  const markByCode = async (e) => {
    e.preventDefault();
    const q = String(lookup || '').trim().toUpperCase();
    if (!q) return;
    const match = teams.find((t) => {
      const code = String(t.teamCode || '').toUpperCase();
      const name = String(t.teamName || '').toUpperCase();
      return code === q
        || code.replace(/^CC/, '') === q.replace(/^CC/, '')
        || name === q
        || code.endsWith(q);
    });
    if (!match) {
      setError(`No team found for “${lookup}” (layout is ${teamCapacity} teams)`);
      return;
    }
    if (!RETURNING_STAGES.has(String(match.currentStage || ''))) {
      setError(
        `${match.teamCode} is on ${match.currentStage || '—'} — only Clue 4 done teams can be marked`,
      );
      return;
    }
    setLookup('');
    await markReached(match, `Organizer lookup mark: ${match.teamCode}`);
  };

  if (!eventId) {
    return (
      <p className="text-sm text-white/50">Select an event to open the red return board.</p>
    );
  }

  return (
    <div className={`space-y-4 rounded-2xl border p-4 ${THEME.borderClass} ${THEME.bgClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${THEME.solidClass} ${THEME.solidTextClass}`}>
              {THEME.colorName} · START CHECK-IN
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-white">Teams coming back</h3>
          <p className="mt-1 text-sm text-white/65">
            After the one-word Final clue, teams return to their own start
            ({teamCapacity} teams · {startCount} start{startCount === 1 ? '' : 's'}
            {' '}· ~{teamsPerWait}/start · {teamSize}/team).
            Mark them by team number when they arrive — score locks.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => refresh()}
          className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-xs text-white/80 disabled:opacity-40"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['At start (mark)', totals.returning, THEME.textClass],
          ['Finished', totals.done, 'text-emerald-200'],
          ['Still out', totals.out, 'text-amber-200'],
          ['Teams', `${totals.done + totals.returning + totals.out}/${totals.capacity}`, 'text-white/70'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={markByCode} className="flex flex-wrap gap-2">
        <input
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Team code / number (e.g. CC001 or 001)"
          className="min-w-48 flex-1 rounded-lg border border-white/15 bg-[#161718] px-3 py-2 font-mono text-sm text-white"
        />
        <button
          type="submit"
          disabled={busyId || !lookup.trim()}
          className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
        >
          Mark by number
        </button>
      </form>

      {message && <p className="text-sm text-emerald-200">{message}</p>}
      {error && <p className="text-sm text-red-200">{error}</p>}

      <div className={`grid gap-3 ${points.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {points.map(({ point, assigned, returning, done, out, capacity }) => (
          <section
            key={id(point)}
            className="rounded-xl border border-white/10 bg-black/30 p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${THEME.textClass}`}>
                  Start {point.code || '—'}
                </p>
                <h4 className="text-base font-bold text-white">{point.name || 'Starting point'}</h4>
              </div>
              <p className="font-mono text-sm text-white/70">
                {done.length}/{capacity} done · {returning.length} waiting
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-100">
                Mark now {returning.length}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
                Locked {done.length}
              </span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-100">
                Out {out.length}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                Roster {assigned.length}/{capacity}
              </span>
            </div>

            {returning.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {returning
                  .slice()
                  .sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true }))
                  .map((team) => (
                    <li
                      key={id(team)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-lg font-bold tracking-wide text-white">
                          {team.teamCode || '—'}
                        </p>
                        <p className="text-xs text-white/60">
                          {team.teamName && !isGenericTeamName(team.teamName)
                            ? team.teamName
                            : 'Say this code at the desk'}
                        </p>
                        <p className="text-[10px] uppercase text-red-100/70">
                          {team.currentStage === 'CLUE_4_FAILED' ? 'Clue 4 failed · still check in' : 'Clue 4 done · at start'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => markReached(team)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
                      >
                        {busyId === id(team) ? 'Marking…' : 'Mark reached'}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/45">
                No teams waiting here yet.
              </p>
            )}

            {done.length > 0 && (
              <div className="mt-3 border-t border-white/10 pt-2">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Already locked</p>
                <p className="mt-1 font-mono text-xs text-white/55">
                  {done
                    .slice()
                    .sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true }))
                    .map((t) => t.teamCode)
                    .join(' · ')}
                </p>
              </div>
            )}
          </section>
        ))}
      </div>

      {!points.length && !loading && (
        <p className="text-sm text-white/50">
          No active starts yet — Save setup (starts & places), then Schedule.
        </p>
      )}
    </div>
  );
}
