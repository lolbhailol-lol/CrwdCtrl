import { useEffect, useMemo, useState } from 'react';
import { deriveCompetitionFormat } from './competitionFormat';
import { suggestHuntLayout } from './campusHuntFormat';
import { applyRound1Scale } from './applyRound1Scale';

/**
 * Organizer control: how many teams + people per team.
 * Saving updates starts/places + demo teams so every Round 1 tab stays in sync.
 */
export default function DemoScalePanel({
  eventId,
  eventMeta,
  teamCount = 0,
  onChanged,
}) {
  const initial = useMemo(() => deriveCompetitionFormat({
    teamCapacity: eventMeta?.teamCapacity,
    teamSize: eventMeta?.teamSize,
  }), [eventMeta?.teamCapacity, eventMeta?.teamSize]);

  const [teams, setTeams] = useState(initial.teamCapacity);
  const [people, setPeople] = useState(initial.teamSize);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setTeams(initial.teamCapacity);
    setPeople(initial.teamSize);
  }, [initial.teamCapacity, initial.teamSize]);

  const preview = useMemo(() => deriveCompetitionFormat({
    teamCapacity: teams,
    teamSize: people,
  }), [teams, people]);

  const layout = useMemo(
    () => suggestHuntLayout(preview.teamCapacity),
    [preview.teamCapacity],
  );

  const saveScale = async ({ alsoCreateTeams = true } = {}) => {
    if (!eventId) return;
    setBusy(alsoCreateTeams ? 'create' : 'save');
    setMsg('');
    try {
      const result = await applyRound1Scale(eventId, {
        teamCapacity: preview.teamCapacity,
        teamSize: preview.teamSize,
        createDemoTeams: alsoCreateTeams,
        existingStations: eventMeta?.campusStationsCatalog || eventMeta?.campusStations,
        existingStarts: eventMeta?.campusStartsCatalog || eventMeta?.campusStarts,
      });
      setMsg(result.message);
      await onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not save scale');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
        Event scale
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">Teams & people</h3>
      <p className="mt-1 text-sm text-white/55">
        Changing size updates starts, places, demo teams, and every workflow tab. Rename later anytime.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/50">
          Teams
          <input
            type="number"
            min={2}
            max={200}
            value={teams}
            onChange={(e) => setTeams(Number(e.target.value) || 2)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-white/50">
          People per team
          <select
            value={people}
            onChange={(e) => setPeople(Number(e.target.value) || 4)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
            <option value={6}>6</option>
            <option value={7}>7</option>
            <option value={8}>8</option>
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/75">
        <p className="font-medium text-white">
          {preview.teamCapacity} teams × {preview.teamSize} = {preview.totalPlayers} players
        </p>
        <p className="mt-1 text-xs text-white/45">
          Suggested · {layout.startCount} start(s) · {layout.stationCount} place(s) · ~{Math.ceil(preview.teamCapacity / layout.startCount)}/start
          {' · '}
          Have {teamCount} team row(s) now
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            if (!window.confirm(
              `Update whole Round 1 for ${preview.teamCapacity}×${preview.teamSize}? `
              + `Starts → ${layout.startCount}, places → ${layout.stationCount}, demo teams created/repaired.`,
            )) return;
            saveScale({ alsoCreateTeams: true });
          }}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy === 'create' ? 'Updating all…' : 'Save + update all sections'}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => saveScale({ alsoCreateTeams: false })}
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy === 'save' ? 'Saving…' : 'Layout only (no demo teams)'}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p>}
    </section>
  );
}
