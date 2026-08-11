import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminPreviewFinaleSchedule,
  adminGenerateFinaleSchedule,
  adminLockFinaleSchedule,
  adminGetFinaleLiveDashboard,
  adminSyncFinaleReleases,
  adminSetFinaleReleasesPaused,
  adminSetFinaleMeetPaused,
  adminReleaseFinaleTeam,
  adminStartFinaleRound,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';

function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Finale Schedule + Live release desk — same pattern as Round 1:
 * Preview → Generate → Lock → Start, then per-location / per-team release.
 */
export default function FinaleReleaseDesk({
  eventId,
  eventSlug,
  round,
  entriesCount = 0,
  mode = 'schedule',
  onChanged,
}) {
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 10 * 60 * 1000)));
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [preview, setPreview] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const loadDashboard = useCallback(async () => {
    const res = await adminGetFinaleLiveDashboard(eventId);
    setDashboard(res.data);
  }, [eventId]);

  useEffect(() => {
    if (mode !== 'live' && mode !== 'schedule') return undefined;
    loadDashboard().catch((err) => setMsg(err.message));
    if (mode !== 'live') return undefined;
    const id = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [mode, loadDashboard]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    setMsg('');
    try {
      await fn();
      setMsg(ok);
      await loadDashboard().catch(() => {});
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  const scheduleLocked = dashboard?.round?.scheduleStatus === 'locked'
    || round?.scheduleStatus === 'locked';
  const roundLive = dashboard?.round?.status === 'live' || round?.status === 'live';

  const waveSummary = useMemo(() => {
    const rows = preview?.assignments || dashboard?.teams || [];
    if (!rows.length) return [];
    const waves = new Map();
    rows.forEach((row) => {
      const wave = row.releaseWave || 1;
      if (!waves.has(wave)) waves.set(wave, { wave, at: row.scheduledStartAt, count: 0 });
      waves.get(wave).count += 1;
    });
    return [...waves.values()].sort((a, b) => a.wave - b.wave);
  }, [preview, dashboard]);

  if (mode === 'schedule') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
            Step 3 · Schedule
          </p>
          <h2 className="mt-1 text-xl font-bold">Finals staggered releases</h2>
          <p className="text-sm text-white/55">
            4 meet locations · 3 waves · Team 1 leaves first at every location, then Team 2, then Team 3
            every {intervalMinutes} min — same flow as Round 1.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            ['1', 'Preview', Boolean(preview)],
            ['2', 'Generate', Boolean(dashboard?.teams?.some((t) => t.scheduledStartAt))],
            ['3', 'Lock', scheduleLocked],
            ['4', 'Start', roundLive],
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

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/55">
            First release (Wave 1 at all 4 meet locations)
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-white/55">
            Interval (minutes)
            <input
              type="number"
              min={1}
              max={30}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || entriesCount < 12}
            onClick={() => run(
              'preview',
              async () => {
                const res = await adminPreviewFinaleSchedule(eventId, {
                  startsAt: new Date(startsAt).toISOString(),
                  releaseIntervalMinutes: intervalMinutes,
                });
                setPreview(res.data);
              },
              'Preview ready',
            )}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            1. Preview
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || entriesCount < 12}
            onClick={() => run(
              'generate',
              async () => {
                const res = await adminGenerateFinaleSchedule(eventId, {
                  startsAt: new Date(startsAt).toISOString(),
                  releaseIntervalMinutes: intervalMinutes,
                });
                setPreview(res.data);
              },
              'Schedule generated',
            )}
            className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
          >
            2. Generate
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !dashboard?.teams?.some((t) => t.scheduledStartAt)}
            onClick={() => run('lock', () => adminLockFinaleSchedule(eventId), 'Schedule locked')}
            className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
          >
            3. Lock
          </button>
        </div>

        {entriesCount < 12 && (
          <p className="text-sm text-amber-100">Need 12 finalists on Teams tab before scheduling.</p>
        )}

        {waveSummary.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase text-white/45">Release waves</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {waveSummary.map((w) => (
                <div key={w.wave} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <p className="font-semibold text-[#0ECCEE]">Wave {w.wave}</p>
                  <p className="text-xs text-white/55">{formatWhen(w.at)}</p>
                  <p className="text-xs text-white/40">{w.count} teams (1 per location)</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(preview?.meetLocations || dashboard?.meetLocations)?.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {(preview?.meetLocations || dashboard.meetLocations).map((loc) => (
              <div key={loc.code} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                <p className="font-semibold">{loc.name}</p>
                <p className="text-[11px] text-white/45">Meet {loc.code}</p>
                <p className="mt-1 text-xs text-white/60">
                  {(preview?.assignments || dashboard?.teams || [])
                    .filter((t) => t.meetLocationCode === loc.code)
                    .map((t) => t.teamCode)
                    .join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        <section className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-5">
          <h2 className="text-lg font-bold text-emerald-100">4. Start Finals round</h2>
          <p className="mt-1 text-sm text-white/70">
            After Lock, start the 45-min Finals. Teams still only unlock at their scheduled wave.
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || !scheduleLocked || roundLive || !round}
            onClick={() => run(
              'start',
              () => adminStartFinaleRound(round._id || round.id),
              'Finals round live — releases follow schedule',
            )}
            className="mt-4 rounded-xl bg-emerald-400 px-6 py-3 text-base font-bold text-black disabled:opacity-40"
          >
            {roundLive ? 'Finals already live' : 'Start Finals round'}
          </button>
          {!scheduleLocked && (
            <p className="mt-3 text-sm text-amber-100">
              Locked out until: <strong>1 Preview → 2 Generate → 3 Lock</strong>
            </p>
          )}
        </section>

        {msg && <p className="text-sm text-white/70">{msg}</p>}
      </div>
    );
  }

  /* Live desk */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
            Step 4 · Live
          </p>
          <h2 className="mt-1 text-xl font-bold">Finals release desk</h2>
          <p className="text-sm text-white/55">
            Pause all / pause one meet location / force-release a team — same ops as Round 1.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !roundLive}
            onClick={() => run('sync', () => adminSyncFinaleReleases(eventId), 'Synced due releases')}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            Sync due releases
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !roundLive}
            onClick={() => run(
              'pauseAll',
              () => adminSetFinaleReleasesPaused(eventId, !dashboard?.round?.releasesPaused),
              dashboard?.round?.releasesPaused ? 'Releases resumed' : 'All releases paused',
            )}
            className="rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40"
          >
            {dashboard?.round?.releasesPaused ? 'Resume all' : 'Pause all'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Total', dashboard?.counts?.total ?? 0],
          ['Waiting', dashboard?.counts?.waiting ?? 0],
          ['Released', dashboard?.counts?.released ?? 0],
          ['Playing', dashboard?.counts?.playing ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase text-white/45">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {dashboard?.round?.endsAt && (
        <p className="text-sm text-white/60">
          Ends {formatWhen(dashboard.round.endsAt)}
          {dashboard.round.releasesPaused ? ' · RELEASES PAUSED' : ''}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(dashboard?.meetLocations || []).map((loc) => (
          <section key={loc.code} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{loc.name}</p>
                <p className="text-xs text-white/45">
                  Meet {loc.code} · {loc.released}/{loc.total} released · {loc.waiting} waiting
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busy) || !roundLive}
                onClick={() => run(
                  `loc-${loc.code}`,
                  () => adminSetFinaleMeetPaused(eventId, loc.code, !loc.paused),
                  loc.paused ? `${loc.name} resumed` : `${loc.name} paused`,
                )}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase disabled:opacity-40 ${
                  loc.paused ? 'bg-red-500/20 text-red-100' : 'bg-white/10 text-white/70'
                }`}
              >
                {loc.paused ? 'Paused' : 'Pause loc'}
              </button>
            </div>
            <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
              {(loc.teams || []).map((team) => (
                <div key={team.teamId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                  <span className="w-14 font-semibold text-white/60">{team.finaleSlotLabel}</span>
                  {eventSlug ? (
                    <Link
                      to={CAMPUS_HUNT_PATHS.teamLogin(eventSlug, team.teamCode)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[#0ECCEE] hover:underline"
                    >
                      {team.teamCode}
                    </Link>
                  ) : (
                    <span className="font-mono text-[#0ECCEE]">{team.teamCode}</span>
                  )}
                  <span className="text-white/40">W{team.releaseWave}</span>
                  <span className="ml-auto text-white/45">{formatWhen(team.scheduledStartAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                    team.released
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-amber-500/15 text-amber-100'
                  }`}
                  >
                    {team.released ? 'Released' : 'Waiting'}
                  </span>
                  {!team.released && roundLive && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => run(
                        `rel-${team.teamId}`,
                        () => adminReleaseFinaleTeam(eventId, team.teamId),
                        `${team.teamCode} released`,
                      )}
                      className="rounded-lg bg-[#0ECCEE]/20 px-2 py-1 text-[10px] font-bold text-[#0ECCEE] disabled:opacity-40"
                    >
                      Release
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {msg && <p className="text-sm text-white/70">{msg}</p>}
    </div>
  );
}
