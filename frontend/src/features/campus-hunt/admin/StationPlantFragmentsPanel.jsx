import { useEffect, useMemo, useState } from 'react';
import { adminUpdateCampusStations } from '../services/campusHunt.api';
import { resolveStations } from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

/**
 * Per-station shared plant fragments + joined word (same for all teams at that stop).
 */
export default function StationPlantFragmentsPanel({
  eventId,
  campusStations,
  stationCount = 10,
  teamSize = 4,
  onChanged,
}) {
  const n = Math.max(2, Math.min(8, Number(teamSize) || 4));
  const [draft, setDraft] = useState(() => resolveStations(campusStations, stationCount));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(resolveStations(campusStations, stationCount).map((row) => ({
      ...row,
      plantFragments: Array.isArray(row.plantFragments)
        ? [...row.plantFragments]
        : Array.from({ length: n }, () => ''),
      joinedWord: row.joinedWord || '',
    })));
  }, [campusStations, stationCount, n]);

  const active = useMemo(
    () => draft.slice(0, Math.max(1, Math.min(10, Number(stationCount) || 1))),
    [draft, stationCount],
  );

  const save = async () => {
    if (!eventId) return;
    setBusy(true);
    setMsg('');
    try {
      const fullCatalog = resolveStations(campusStations);
      const byCode = new Map(active.map((r) => [r.code, r]));
      const next = fullCatalog.map((row) => {
        const edited = byCode.get(row.code);
        if (!edited) return row;
        const plantFragments = (edited.plantFragments || [])
          .map((f) => String(f || '').trim())
          .filter(Boolean);
        return {
          code: row.code,
          name: edited.name || row.name,
          plantFragments,
          joinedWord: String(edited.joinedWord || '').trim(),
        };
      });
      await adminUpdateCampusStations(eventId, {
        campusStations: next,
        stationCount,
        reason: 'Plant fragments updated',
      });
      setMsg('Saved plant fragments for all teams at these stops');
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const setFrag = (code, index, value) => {
    setDraft((prev) => prev.map((row) => {
      if (row.code !== code) return row;
      const plantFragments = Array.from({ length: n }, (_, i) => row.plantFragments?.[i] || '');
      plantFragments[index] = value;
      return { ...row, plantFragments };
    }));
  };

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/30 bg-[#0a1218] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
        Plant fragments (shared)
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">Join-word stops</h3>
      <p className="mt-1 text-sm text-white/55">
        Print {n} short slips per place. Every team that visits that place finds the same slips,
        joins them into one word, types it, then scans the poster once.
      </p>

      <div className="mt-4 space-y-3">
        {active.map((row) => (
          <div key={row.code} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="font-mono text-xs font-bold text-[#0ECCEE]">
              {row.code}
              {' · '}
              <span className="font-sans text-white">{row.name}</span>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: n }, (_, i) => (
                <label key={i} className="text-[10px] text-white/45">
                  Fragment {i + 1}
                  <input
                    className={`${inputClass} mt-1`}
                    value={row.plantFragments?.[i] || ''}
                    onChange={(e) => setFrag(row.code, i, e.target.value)}
                    placeholder={`bit ${i + 1}`}
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block text-[10px] text-white/45">
              Joined word (what leader types)
              <input
                className={`${inputClass} mt-1 max-w-sm`}
                value={row.joinedWord || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft((prev) => prev.map((r) => (
                    r.code === row.code ? { ...r, joinedWord: value } : r
                  )));
                }}
                placeholder="e.g. QUEST"
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || !eventId}
        onClick={save}
        className="mt-4 rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save plant fragments'}
      </button>
      {msg ? <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p> : null}
    </section>
  );
}
