import { useEffect, useMemo, useState } from 'react';
import { adminUpdateCampusStations } from '../services/campusHunt.api';
import {
  DEFAULT_STATION_DIGIT_CODES,
  resolveStations,
  splitDigitSlips,
  withStationPlantDefaults,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

/** Clue 2 only — 3-digit answers + 3 numbered digit slips per stop. */
export default function StationPlantFragmentsPanel({
  eventId,
  campusStations,
  stationCount = 20,
  teamSize = 4,
  onChanged,
}) {
  void teamSize;
  const slipCount = 3;
  const [draft, setDraft] = useState(() => (
    withStationPlantDefaults(resolveStations(campusStations, stationCount, slipCount), slipCount)
  ));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(withStationPlantDefaults(
      resolveStations(campusStations, stationCount, slipCount),
      slipCount,
    ));
  }, [campusStations, stationCount]);

  const active = useMemo(
    () => draft.slice(0, Math.max(1, Math.min(20, Number(stationCount) || 1))),
    [draft, stationCount],
  );

  const fillDefaults = () => {
    setDraft((prev) => prev.map((row) => {
      const joinedWord = DEFAULT_STATION_DIGIT_CODES[row.code] || '847';
      return {
        ...row,
        joinedWord,
        plantFragments: splitDigitSlips(joinedWord, slipCount),
      };
    }));
    setMsg(`Filled 3-digit answers + ${slipCount} digit slips per stop — tap Save`);
  };

  const save = async () => {
    if (!eventId) return;
    setBusy(true);
    setMsg('');
    try {
      const fullCatalog = resolveStations(campusStations, null, slipCount);
      const byCode = new Map(active.map((r) => [r.code, r]));
      const next = fullCatalog.map((row) => {
        const edited = byCode.get(row.code);
        if (!edited) {
          const joinedWord = DEFAULT_STATION_DIGIT_CODES[row.code]
            || String(row.joinedWord || '').replace(/\D/g, '').slice(0, 3)
            || '847';
          return {
            code: row.code,
            name: row.name,
            joinedWord,
            plantFragments: splitDigitSlips(joinedWord, slipCount),
          };
        }
        let joinedWord = String(edited.joinedWord || DEFAULT_STATION_DIGIT_CODES[row.code] || '')
          .replace(/\D/g, '')
          .slice(0, 3);
        if (joinedWord.length < 3) {
          joinedWord = DEFAULT_STATION_DIGIT_CODES[row.code] || '847';
        }
        let plantFragments = (edited.plantFragments || [])
          .map((f) => String(f || '').replace(/\D/g, ''))
          .filter(Boolean);
        if (plantFragments.length < slipCount || plantFragments.some((f) => !/^\d+$/.test(f))) {
          plantFragments = splitDigitSlips(joinedWord, slipCount);
        } else {
          plantFragments = plantFragments.slice(0, slipCount);
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
        reason: 'Clue 2 digit slips + 3-digit answers saved',
      });
      setMsg('Saved 3-digit answers + digit slips for all stops');
      onChanged?.();
    } catch (err) {
      setMsg(err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const setFrag = (code, index, value) => {
    const digitsOnly = String(value || '').replace(/\D/g, '').slice(0, 1);
    setDraft((prev) => prev.map((row) => {
      if (row.code !== code) return row;
      const plantFragments = Array.from(
        { length: slipCount },
        (_, i) => row.plantFragments?.[i] || '',
      );
      plantFragments[index] = digitsOnly;
      const joinedWord = plantFragments.join('') || row.joinedWord;
      return { ...row, plantFragments, joinedWord };
    }));
  };

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/30 bg-[#0a1218] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
        Digit slips · Clue 2 only
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">3-digit number · green stop</h3>
      <p className="mt-1 text-sm text-white/55">
        Print 3 numbered digit slips per place (not blue plaques, not red letters).
        Teams join digits in order into one 3-digit number, type it, then scan green once.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={fillDefaults}
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-40"
        >
          Fill COEP 3-digit defaults
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
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {Array.from({ length: slipCount }, (_, i) => (
                <label key={`${row.code}-f${i}`} className="block text-[11px] text-white/50">
                  Digit slip {i + 1}
                  <input
                    className={`${inputClass} mt-1 font-mono text-center text-xl tracking-widest`}
                    value={row.plantFragments?.[i] || ''}
                    onChange={(e) => setFrag(row.code, i, e.target.value)}
                    placeholder={`${i + 1}`}
                    inputMode="numeric"
                    maxLength={1}
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block text-[11px] text-white/50">
              3-digit answer (leaders type this)
              <input
                className={`${inputClass} mt-1 font-mono tracking-[0.3em]`}
                value={row.joinedWord || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setDraft((prev) => prev.map((r) => (
                    r.code === row.code
                      ? {
                        ...r,
                        joinedWord: value,
                        plantFragments: value.length === 3
                          ? splitDigitSlips(value, slipCount)
                          : r.plantFragments,
                      }
                      : r
                  )));
                }}
                placeholder="e.g. 847"
                inputMode="numeric"
                maxLength={3}
              />
            </label>
          </div>
        ))}
      </div>

      {msg ? <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p> : null}
    </section>
  );
}
