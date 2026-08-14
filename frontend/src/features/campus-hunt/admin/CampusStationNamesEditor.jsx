import { useEffect, useMemo, useState } from 'react';
import { adminUpdateCampusStations, adminUpdateEvent, adminBootstrapRound1 } from '../services/campusHunt.api';
import {
  CAMPUS_STATIONS,
  WAIT_POINTS,
  resolveStarts,
  resolveStations,
  suggestHuntLayout,
} from './campusHuntFormat';
import { deriveCompetitionFormat } from './competitionFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

/**
 * Edit teams / people, starting points, and campus places.
 * Small demos can use 1 start + fewer hunt places.
 */
export default function CampusStationNamesEditor({
  eventId,
  campusStations,
  campusStarts,
  startCount: startCountProp = 4,
  stationCount: stationCountProp = 10,
  teamCapacity: teamCapacityProp = 40,
  teamSize: teamSizeProp = 4,
  onChanged,
  onLayoutDraftChange,
}) {
  const [teams, setTeams] = useState(String(teamCapacityProp));
  const [people, setPeople] = useState(String(teamSizeProp));
  const [startCount, setStartCount] = useState(startCountProp);
  const [stationCount, setStationCount] = useState(stationCountProp);
  const [stationDraft, setStationDraft] = useState(() => resolveStations(campusStations));
  const [startDraft, setStartDraft] = useState(() => resolveStarts(campusStarts));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setTeams(String(teamCapacityProp));
    setPeople(String(teamSizeProp));
  }, [teamCapacityProp, teamSizeProp]);

  useEffect(() => {
    setStartCount(startCountProp);
    setStationCount(stationCountProp);
    // Full rename catalog — activeStations / activeStarts slice by local count for display.
    setStationDraft(resolveStations(campusStations));
    setStartDraft(resolveStarts(campusStarts));
  }, [campusStations, campusStarts, startCountProp, stationCountProp]);

  const preview = useMemo(
    () => deriveCompetitionFormat({ teamCapacity: teams, teamSize: people }),
    [teams, people],
  );

  const activeStarts = useMemo(
    () => startDraft.slice(0, Math.max(1, Math.min(4, Number(startCount) || 1))),
    [startDraft, startCount],
  );
  const activeStations = useMemo(
    () => stationDraft.slice(0, Math.max(1, Math.min(10, Number(stationCount) || 1))),
    [stationDraft, stationCount],
  );

  useEffect(() => {
    onLayoutDraftChange?.({
      stationCount: Number(stationCount) || 1,
      startCount: Number(startCount) || 1,
      campusStations: activeStations,
      campusStarts: activeStarts,
    });
  }, [stationCount, startCount, activeStations, activeStarts, onLayoutDraftChange]);

  const suggested = useMemo(
    () => suggestHuntLayout(preview.teamCapacity),
    [preview.teamCapacity],
  );

  const applySuggested = () => {
    setStartCount(suggested.startCount);
    setStationCount(suggested.stationCount);
    setMessage('');
    setError('');
  };

  const save = async () => {
    if (!eventId) return;
    const emptyStart = activeStarts.find((row) => !String(row.name || '').trim());
    if (emptyStart) {
      setError(`Start ${emptyStart.code} needs a name`);
      return;
    }
    const emptyPlace = activeStations.find((row) => !String(row.name || '').trim());
    if (emptyPlace) {
      setError(`${emptyPlace.code} needs a name`);
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const format = deriveCompetitionFormat({ teamCapacity: teams, teamSize: people });
      await adminUpdateEvent(eventId, {
        teamCapacity: format.teamCapacity,
        teamSize: format.teamSize,
        reason: 'Organizer set teams / people from hunt layout',
      });
      const result = await adminUpdateCampusStations(eventId, {
        campusStations: stationDraft.map((row) => ({
          code: row.code,
          name: String(row.name).trim(),
        })),
        campusStarts: startDraft.map((row) => ({
          code: row.code,
          name: String(row.name).trim(),
        })),
        startCount: Number(startCount) || 1,
        stationCount: Number(stationCount) || 1,
        reason: 'Admin updated hunt layout',
      });
      // Layout only — starts/places/routes. Update each clue one-by-one below.
      await adminBootstrapRound1(eventId, {
        createTeams: false,
        enablePublicLeaderboard: false,
        challengeNumbers: [],
      });
      const renamed = result.data?.renames?.length || 0;
      setMessage(
        `Setup saved · ${format.teamCapacity} teams × ${format.teamSize}/team · `
        + `${result.data.startCount} start(s) · ${result.data.stationCount} place(s)`
        + (renamed ? ` · ${renamed} rename(s)` : '')
        + ' · purple stops rebinding to active places · open each clue and tap Update',
      );
      onChanged?.({
        ...result.data,
        teamCapacity: format.teamCapacity,
        teamSize: format.teamSize,
        cluesRebuilt: false,
      });
    } catch (err) {
      setError(err.message || 'Could not save hunt layout');
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
    setTeams('40');
    setPeople('4');
    setStartCount(4);
    setStationCount(10);
    setStationDraft(CAMPUS_STATIONS.map((s) => ({ ...s })));
    setStartDraft(WAIT_POINTS.map((s) => ({ code: s.code, name: s.name })));
    setMessage('');
    setError('');
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">Teams, starts & places</h2>
          <p className="mt-1 text-xs text-white/50">
            Set overall teams and people per team, then starting points and campus places.
            Save setup here, then update Clue 1 → 2 → 3 → 4 → Final one by one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applySuggested}
            className="rounded-lg bg-[#0ECCEE]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#0ECCEE]"
          >
            Suggest starts/places for {preview.teamCapacity} teams
            ({suggested.startCount} start · {suggested.stationCount} places)
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] text-white/70"
          >
            Reset defaults
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[11px] text-white/45">
          Overall teams
          <input
            type="number"
            min={2}
            max={200}
            value={teams}
            onChange={(e) => setTeams(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-[11px] text-white/45">
          People per team
          <input
            type="number"
            min={2}
            max={8}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-[11px] text-white/45">
          Starting points (1–4)
          <input
            type="number"
            min={1}
            max={4}
            value={startCount}
            onChange={(e) => setStartCount(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-[11px] text-white/45">
          Campus places (1–10)
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer places"
              disabled={Number(stationCount) <= 1}
              onClick={() => setStationCount((n) => Math.max(1, Number(n) - 1))}
              className="h-9 w-9 shrink-0 rounded-lg border border-white/15 bg-white/5 text-lg text-white disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={10}
              value={stationCount}
              onChange={(e) => setStationCount(e.target.value)}
              className={`${inputClass} text-center`}
            />
            <button
              type="button"
              aria-label="More places"
              disabled={Number(stationCount) >= 10}
              onClick={() => setStationCount((n) => Math.min(10, Number(n) + 1))}
              className="h-9 w-9 shrink-0 rounded-lg border border-white/15 bg-white/5 text-lg text-white disabled:opacity-30"
            >
              +
            </button>
          </div>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        {preview.totalPlayers} players total · Round 1 / Survival / Finale ladder updates from team count.
        Raise campus places with + to unlock more scan locations (then Save setup + bootstrap QRs).
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-white">
          Starting point names · {activeStarts.length} active
        </h3>
        <p className="mt-0.5 text-[11px] text-white/40">
          Teams gather here before release. Unused starts stay hidden after bootstrap.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {activeStarts.map((row, index) => (
            <label key={row.code} className="block text-[11px] text-white/45">
              Start {row.code}
              <input
                value={row.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setStartDraft((prev) => prev.map((item, i) => (
                    i === index ? { ...item, name } : item
                  )));
                }}
                className={`mt-1 ${inputClass}`}
                placeholder={WAIT_POINTS[index]?.name || 'Start name'}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-white">
          Campus place names · {activeStations.length} active
        </h3>
        <p className="mt-0.5 text-[11px] text-white/40">
          Hunt QR cards live here (not at starting points). Each place gets 1 shared QR per scan stage.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {activeStations.map((row, index) => (
            <label key={row.code} className="block text-[11px] text-white/45">
              {row.code}
              <input
                value={row.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setStationDraft((prev) => prev.map((item, i) => (
                    i === index ? { ...item, name } : item
                  )));
                }}
                className={`mt-1 ${inputClass}`}
                placeholder={CAMPUS_STATIONS[index]?.name || 'Place name'}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={save}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save setup'}
        </button>
        {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
        {error && <p className="text-sm text-amber-200">{error}</p>}
      </div>
    </section>
  );
}
