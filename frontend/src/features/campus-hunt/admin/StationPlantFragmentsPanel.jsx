import { useEffect, useMemo, useState } from 'react';
import { adminUpdateCampusStations } from '../services/campusHunt.api';
import {
  DEFAULT_STATION_JOINED_WORDS,
  resolveStations,
  splitPlantFragments,
  withStationPlantDefaults,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

/**
 * Per-station shared plant fragments + joined word (same for all teams at that stop).
 */
export default function StationPlantFragmentsPanel({
  eventId,
  campusStations,
  stationCount = 20,
  teamSize = 4,
  onChanged,
}) {
  const n = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const [draft, setDraft] = useState(() => (
    withStationPlantDefaults(resolveStations(campusStations, stationCount, n), n)
  ));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(withStationPlantDefaults(
      resolveStations(campusStations, stationCount, n),
      n,
    ).map((row) => ({
      ...row,
      plantFragments: Array.isArray(row.plantFragments) && row.plantFragments.length
        ? [...row.plantFragments]
        : Array.from({ length: n }, () => ''),
      joinedWord: row.joinedWord || DEFAULT_STATION_JOINED_WORDS[row.code] || '',
    })));
  }, [campusStations, stationCount, n]);

  const active = useMemo(
    () => draft.slice(0, Math.max(1, Math.min(20, Number(stationCount) || 1))),
    [draft, stationCount],
  );

  const fillDefaults = () => {
    setDraft((prev) => prev.map((row) => {
      const joinedWord = DEFAULT_STATION_JOINED_WORDS[row.code] || row.joinedWord || 'QUEST';
      return {
        ...row,
        joinedWord,
        plantFragments: splitPlantFragments(joinedWord, n),
      };
    }));
    setMsg(`Filled default join-words + ${n} plant slips per stop — tap Save`);
  };

  const save = async () => {
    if (!eventId) return;
    setBusy(true);
    setMsg('');
    try {
      const fullCatalog = resolveStations(campusStations, null, n);
      const byCode = new Map(active.map((r) => [r.code, r]));
      const next = fullCatalog.map((row) => {
        const edited = byCode.get(row.code);
        if (!edited) {
          const joinedWord = row.joinedWord || DEFAULT_STATION_JOINED_WORDS[row.code] || '';
          return {
            code: row.code,
            name: row.name,
            ...(joinedWord ? {
              joinedWord,
              plantFragments: row.plantFragments?.length
                ? row.plantFragments
                : splitPlantFragments(joinedWord, n),
            } : {}),
          };
        }
        const joinedWord = String(edited.joinedWord || DEFAULT_STATION_JOINED_WORDS[row.code] || '')
          .trim()
          .toUpperCase();
        let plantFragments = (edited.plantFragments || [])
          .map((f) => String(f || '').trim())
          .filter(Boolean);
        if (joinedWord && plantFragments.length < n) {
          plantFragments = splitPlantFragments(joinedWord, n);
        }
        return {
          code: row.code,
          name: edited.name || row.name,
          plantFragments,
          joinedWord,
        };
      });
      await adminUpdateCampusStations(eventId, {
        campusStations: next,
        stationCount,
        reason: 'Digit slips + joined answers saved',
      });
      setMsg('Saved plant fragments + joined words for all stops');
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
        Digit slips (shared)
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">Number find · green stop</h3>
      <p className="mt-1 text-sm text-white/55">
        Print {n} short numbered slips per place. Every team that visits finds the same digits,
        joins them in order into one answer, types it, then scans the poster once.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={fillDefaults}
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
        >
          Fill COEP defaults
        </button>
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={save}
          className="rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save digit slips'}
        </button>
      </div>

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
                <label key={`${row.code}-f${i}`} className="block text-[11px] text-white/50">
                  Slip {i + 1}
                  <input
                    className={`${inputClass} mt-1 font-mono`}
                    value={row.plantFragments?.[i] || ''}
                    onChange={(e) => setFrag(row.code, i, e.target.value)}
                    placeholder={`frag ${i + 1}`}
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block text-[11px] text-white/50">
              Joined word (leaders type this)
              <input
                className={`${inputClass} mt-1 font-mono uppercase tracking-wide`}
                value={row.joinedWord || ''}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setDraft((prev) => prev.map((r) => (
                    r.code === row.code ? { ...r, joinedWord: value } : r
                  )));
                }}
                placeholder="e.g. THRUSTJET"
              />
            </label>
          </div>
        ))}
      </div>

      {msg ? <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p> : null}
    </section>
  );
}
