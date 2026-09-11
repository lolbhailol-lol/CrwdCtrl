import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import { deriveCompetitionFormat, normalizeRoundPlan, roundPlanSummary } from './competitionFormat';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const EMPTY_FORM = {
  name: '',
  college: '',
  slug: '',
  teamCapacity: 40,
  date: '',
  teamSize: 4,
  startingScore: 100,
  featureNotes: '',
  round1Name: 'Campus Hunt',
  round2Name: '',
  round3Name: '',
  finaleName: 'Finale',
  qualifyFromRound1: 0,
  qualifyFromRound2: 0,
  qualifyFromRound3: 0,
};

export default function CampusHuntAdminDashboard() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const previewPlan = normalizeRoundPlan(form, { teamCapacity: form.teamCapacity });
  const previewFormat = deriveCompetitionFormat({
    teamCapacity: form.teamCapacity,
    teamSize: form.teamSize,
    roundPlan: previewPlan,
  });

  const reload = async () => {
    const res = await adminListEvents();
    setEvents(res.data?.events || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormMsg('');
    try {
      const slug = form.slug.trim() || slugify(`${form.college}-${form.name}`);
      const plan = normalizeRoundPlan(form, { teamCapacity: form.teamCapacity });
      const format = deriveCompetitionFormat({
        teamCapacity: form.teamCapacity,
        teamSize: form.teamSize,
        roundPlan: plan,
      });
      const res = await adminCreateEvent({
        name: form.name.trim(),
        college: form.college.trim(),
        slug,
        teamCapacity: format.teamCapacity,
        date: form.date || undefined,
        teamSize: format.teamSize,
        startingScore: Number(form.startingScore) || 100,
        featureNotes: form.featureNotes.trim(),
        status: 'registration_open',
        publicLeaderboardLive: false,
        publicLoginLive: false,
        roundPlan: {
          round1Name: plan.round1Name,
          round2Name: plan.round2Name,
          round3Name: plan.round3Name,
          finaleName: plan.finaleName,
          qualifyFromRound1: plan.qualifyFromRound1,
          qualifyFromRound2: plan.qualifyFromRound2,
          qualifyFromRound3: plan.qualifyFromRound3,
        },
      });
      setFormMsg(
        `Created ${res.data?.event?.name}. Turn on Profile login / leaderboard when ready.`,
      );
      setForm(EMPTY_FORM);
      setSlugTouched(false);
      await reload();
    } catch (err) {
      setFormMsg(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const toggleProfileFlag = async (ev, field) => {
    setBusyId(ev._id);
    setError('');
    try {
      await adminUpdateEvent(ev._id, {
        [field]: !ev[field],
      });
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to update Profile flag');
    } finally {
      setBusyId('');
    }
  };

  const onDelete = async (ev) => {
    if (!window.confirm(`Delete “${ev.name}” and all teams / progress? This cannot be undone.`)) {
      return;
    }
    setBusyId(ev._id);
    setError('');
    try {
      await adminDeleteEvent(ev._id);
      await reload();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6 p-4 text-white md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campus Hunt</h1>
          <p className="text-sm text-white/50">
            Events stay private until you enable live Profile leaderboard. Nothing is promoted on the main website.
          </p>
        </div>
        <Link
          to={CAMPUS_HUNT_PATHS.leaderboard}
          className="text-sm text-[#0ECCEE] underline"
        >
          Preview Profile leaderboard
        </Link>
      </div>

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <p className="text-sm font-semibold text-[#0ECCEE]">Create college hunt</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/50">
            College name
            <input
              required
              value={form.college}
              onChange={(e) => setForm((f) => ({
                ...f,
                college: e.target.value,
                slug: slugTouched ? f.slug : slugify(`${e.target.value}-${f.name}`),
              }))}
              placeholder="e.g. MIT WPU"
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Event name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: slugTouched ? f.slug : slugify(`${f.college}-${e.target.value}`),
              }))}
              placeholder="e.g. Spring Campus Hunt 2026"
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Slug (player URL)
            <input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
              placeholder="mit-wpu-spring-hunt"
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Event date
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Overall teams
            <input
              type="number"
              min={4}
              max={200}
              value={form.teamCapacity}
              onChange={(e) => setForm((f) => ({ ...f, teamCapacity: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            People per team
            <input
              type="number"
              min={2}
              max={8}
              value={form.teamSize}
              onChange={(e) => setForm((f) => ({ ...f, teamSize: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Starting score
            <input
              type="number"
              min={0}
              value={form.startingScore}
              onChange={(e) => setForm((f) => ({ ...f, startingScore: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50 sm:col-span-2">
            Operations notes
            <textarea
              value={form.featureNotes}
              onChange={(e) => setForm((f) => ({ ...f, featureNotes: e.target.value }))}
              placeholder="Venue, reporting time, emergency contact"
              className="mt-1 min-h-20 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
            Round names & finals qualify
          </p>
          <p className="mt-1 text-[11px] text-white/50">
            Name Round 1–3 (leave Round 2/3 blank if you only run Round 1 for now).
            Set how many teams from each round go to finals.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-white/50">
              Round 1 name
              <input
                value={form.round1Name}
                onChange={(e) => setForm((f) => ({ ...f, round1Name: e.target.value }))}
                placeholder="Campus Hunt"
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              From Round 1 → finals
              <input
                type="number"
                min={0}
                max={200}
                value={form.qualifyFromRound1}
                onChange={(e) => setForm((f) => ({ ...f, qualifyFromRound1: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              Round 2 name (optional)
              <input
                value={form.round2Name}
                onChange={(e) => setForm((f) => ({ ...f, round2Name: e.target.value }))}
                placeholder="e.g. Survival — blank = skip"
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              From Round 2 → finals
              <input
                type="number"
                min={0}
                max={200}
                disabled={!String(form.round2Name || '').trim()}
                value={form.qualifyFromRound2}
                onChange={(e) => setForm((f) => ({ ...f, qualifyFromRound2: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white disabled:opacity-40"
              />
            </label>
            <label className="block text-xs text-white/50">
              Round 3 name (optional)
              <input
                value={form.round3Name}
                onChange={(e) => setForm((f) => ({ ...f, round3Name: e.target.value }))}
                placeholder="blank = skip"
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              From Round 3 → finals
              <input
                type="number"
                min={0}
                max={200}
                disabled={!String(form.round3Name || '').trim()}
                value={form.qualifyFromRound3}
                onChange={(e) => setForm((f) => ({ ...f, qualifyFromRound3: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white disabled:opacity-40"
              />
            </label>
            <label className="block text-xs text-white/50 sm:col-span-2">
              Finals name
              <input
                value={form.finaleName}
                onChange={(e) => setForm((f) => ({ ...f, finaleName: e.target.value }))}
                placeholder="Finale"
                className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-white/60">
            {previewFormat.teamCapacity} teams · {previewFormat.teamSize}/team · {previewFormat.totalPlayers} players
            {' · '}
            {previewPlan.hasFinale
              ? `${previewPlan.finaleName} field: ${previewPlan.finaleCapacity} teams`
              : 'No finals yet (Round 1 only — set qualify numbers when ready)'}
          </p>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create event'}
        </button>
        {formMsg && <p className="text-sm text-white/70">{formMsg}</p>}
      </form>

      {loading && <p className="text-white/60">Loading…</p>}
      {error && <p className="text-red-300">{error}</p>}

      <div className="space-y-3">
        {events.map((ev) => (
          <div
            key={ev._id}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link
                to={CAMPUS_HUNT_PATHS.adminEvent(ev._id)}
                className="min-w-0 flex-1 hover:text-[#0ECCEE]"
              >
                <p className="font-semibold uppercase tracking-wide">{ev.name}</p>
                <p className="text-sm uppercase tracking-wide text-white/50">
                  {ev.college} · {ev.slug}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {ev.roundPlan?.round1Name || 'Round 1'} · {ev.teamCapacity || 40} teams · {ev.teamSize || 4}/team
                </p>
                {(ev.roundPlan?.qualifyFromRound1 || ev.roundPlan?.round2Name) ? (
                  <p className="mt-0.5 text-[10px] normal-case tracking-normal text-white/35">
                    {roundPlanSummary(ev.roundPlan, ev.teamCapacity)}
                  </p>
                ) : null}
              </Link>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase">
                {ev.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyId === ev._id}
                onClick={() => toggleProfileFlag(ev, 'publicLoginLive')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  ev.publicLoginLive
                    ? 'bg-sky-400 text-black'
                    : 'bg-white/10 text-white'
                }`}
              >
                {ev.publicLoginLive ? 'Login on Profile · ON' : 'Login on Profile · OFF'}
              </button>
              <button
                type="button"
                disabled={busyId === ev._id}
                onClick={() => toggleProfileFlag(ev, 'publicLeaderboardLive')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  ev.publicLeaderboardLive
                    ? 'bg-emerald-500 text-black'
                    : 'bg-white/10 text-white'
                }`}
              >
                {ev.publicLeaderboardLive ? 'Leaderboard on Profile · ON' : 'Leaderboard on Profile · OFF'}
              </button>
              {ev.publicLeaderboardLive && (
                <Link
                  to={CAMPUS_HUNT_PATHS.leaderboardCollege(ev.college)}
                  className="text-xs text-[#0ECCEE] underline"
                >
                  Open board
                </Link>
              )}
              <button
                type="button"
                disabled={busyId === ev._id}
                onClick={() => onDelete(ev)}
                className="ml-auto rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!loading && !events.length && !error && (
          <p className="text-sm text-white/50">
            No events yet. Create one above, then enable Login / Leaderboard on Profile when ready.
          </p>
        )}
      </div>
    </div>
  );
}
