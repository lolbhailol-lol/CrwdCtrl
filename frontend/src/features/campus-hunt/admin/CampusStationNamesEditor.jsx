import { useEffect, useState } from 'react';
import { adminUpdateCampusStations } from '../services/campusHunt.api';
import { CAMPUS_STATIONS, resolveStations } from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

/**
 * One box to rename all 10 hunt places — saves to event and updates
 * checkpoints + clues everywhere (admin + player).
 */
export default function CampusStationNamesEditor({
  eventId,
  campusStations,
  onChanged,
}) {
  const [draft, setDraft] = useState(() => resolveStations(campusStations));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(resolveStations(campusStations));
  }, [campusStations]);

  const save = async () => {
    if (!eventId) return;
    const empty = draft.find((row) => !String(row.name || '').trim());
    if (empty) {
      setError(`${empty.code} needs a name`);
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await adminUpdateCampusStations(
        eventId,
        draft.map((row) => ({ code: row.code, name: String(row.name).trim() })),
        'Admin renamed campus stations',
      );
      const renamed = result.data?.renames?.length || 0;
      setMessage(
        renamed
          ? `Saved ${renamed} rename(s). Updated checkpoints & clues everywhere.`
          : 'Station names saved.',
      );
      onChanged?.(result.data?.campusStations || draft);
    } catch (err) {
      setError(err.message || 'Could not save station names');
    } finally {
      setBusy(false);
    }
  };

  const resetDefaults = () => {
    setDraft(CAMPUS_STATIONS.map((s) => ({ ...s })));
    setMessage('');
    setError('');
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">Campus place names</h2>
          <p className="mt-1 text-xs text-white/50">
            Change all 10 hunt locations here. Applies in Clue 1, posters, checkpoints, and player screens.
            Each place gets 1 shared QR (all teams scan the same poster).
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] text-white/70"
        >
          Reset defaults
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {draft.map((row, index) => (
          <label key={row.code} className="block text-[11px] text-white/45">
            {row.code}
            <input
              value={row.name}
              onChange={(e) => {
                const name = e.target.value;
                setDraft((prev) => prev.map((item, i) => (
                  i === index ? { ...item, name } : item
                )));
              }}
              className={`mt-1 ${inputClass}`}
              placeholder={CAMPUS_STATIONS[index]?.name || 'Place name'}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={save}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save place names'}
        </button>
        {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
        {error && <p className="text-sm text-amber-200">{error}</p>}
      </div>
    </section>
  );
}
