import { useEffect, useMemo, useState } from 'react';
import { adminUpdateCampusStations } from '../services/campusHunt.api';
import {
  CLUE2_DIGIT_SLIPS,
  DEFAULT_STATION_DIGIT_ANSWERS,
  resolveStations,
  splitDigitSlips,
  withStationPlantDefaults,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';
const SLIPS = CLUE2_DIGIT_SLIPS;

/**
 * Clue 2 · Places — exactly 2 numbered digit slips + joined number answer per stop.
 */
export default function StationPlantFragmentsPanel({
  eventId,
  campusStations,
  stationCount = 20,
  teamSize: _teamSize = 4,
  onChanged,
}) {
  void _teamSize;
  const [draft, setDraft] = useState(() => (
    withStationPlantDefaults(resolveStations(campusStations, stationCount, SLIPS), SLIPS)
  ));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setDraft(withStationPlantDefaults(
      resolveStations(campusStations, stationCount, SLIPS),
      SLIPS,
    ).map((row) => {
      const joinedWord = String(
        row.joinedWord || DEFAULT_STATION_DIGIT_ANSWERS[row.code] || '',
      ).replace(/\D/g, '');
      const existing = Array.isArray(row.plantFragments) ? row.plantFragments : [];
      return {
        ...row,
        joinedWord,
        plantFragments: existing.length >= SLIPS
          ? existing.slice(0, SLIPS).map((f) => String(f || '').replace(/\D/g, ''))
          : (joinedWord ? splitDigitSlips(joinedWord, SLIPS) : ['', '']),
      };
    }));
  }, [campusStations, stationCount]);

  const active = useMemo(
    () => draft.slice(0, Math.max(1, Math.min(20, Number(stationCount) || 1))),
    [draft, stationCount],
  );

  const fillDefaults = () => {
    setDraft((prev) => prev.map((row) => {
      const joinedWord = DEFAULT_STATION_DIGIT_ANSWERS[row.code] || '47';
      return {
        ...row,
        joinedWord,
        plantFragments: splitDigitSlips(joinedWord, SLIPS),
      };
    }));
    setMsg('Filled 2 digit slips + 2-digit answers per stop — tap Save');
  };

  const save = async () => {
    if (!eventId) return;
    setBusy(true);
    setMsg('');
    try {
      const fullCatalog = resolveStations(campusStations, null, SLIPS);
      const byCode = new Map(active.map((r) => [r.code, r]));
      const next = fullCatalog.map((row) => {
        const edited = byCode.get(row.code);
        if (!edited) {
          const joinedWord = String(
            row.joinedWord || DEFAULT_STATION_DIGIT_ANSWERS[row.code] || '',
          ).replace(/\D/g, '');
          return {
            code: row.code,
            name: row.name,
            ...(joinedWord ? {
              joinedWord,
              plantFragments: row.plantFragments?.length >= SLIPS
                ? row.plantFragments.slice(0, SLIPS)
                : splitDigitSlips(joinedWord, SLIPS),
            } : {}),
          };
        }
        let joinedWord = String(edited.joinedWord || '').replace(/\D/g, '');
        let plantFragments = (edited.plantFragments || [])
          .slice(0, SLIPS)
          .map((f) => String(f || '').replace(/\D/g, ''));
        if (joinedWord && plantFragments.filter(Boolean).length < SLIPS) {
          plantFragments = splitDigitSlips(joinedWord, SLIPS);
        }
        if (!joinedWord && plantFragments.every(Boolean)) {
          joinedWord = plantFragments.join('');
        }
        return {
          code: row.code,
          name: row.name,
          joinedWord,
          plantFragments,
        };
      });
      await adminUpdateCampusStations(eventId, {
        stations: next,
        reason: 'Clue 2 digit slips (2) saved',
      });
      onChanged?.();
      setMsg('Saved 2 digit slips + answers for all stops');
    } catch (err) {
      setMsg(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const setFrag = (code, index, value) => {
    const digits = String(value || '').replace(/\D/g, '');
    setDraft((prev) => prev.map((row) => {
      if (row.code !== code) return row;
      const plantFragments = Array.from({ length: SLIPS }, (_, i) => row.plantFragments?.[i] || '');
      plantFragments[index] = digits;
      return {
        ...row,
        plantFragments,
        joinedWord: plantFragments.join(''),
      };
    }));
  };

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/30 bg-[#0a1218] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
        Digit slips · Clue 2 · exactly 2
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">Number find · green stop</h3>
      <p className="mt-1 text-sm text-white/55">
        Print 2 numbered digit slips per place (slip 1 + slip 2). Teams join them into one number,
        type it, then scan green. Not blue plaques / not red letters.
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
          {busy ? 'Saving…' : 'Save 2 digit slips'}
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: SLIPS }, (_, i) => (
                <label key={`${row.code}-f${i}`} className="block text-[11px] text-white/50">
                  Slip {i + 1}
                  <input
                    className={`${inputClass} mt-1 font-mono text-lg tracking-widest`}
                    value={row.plantFragments?.[i] || ''}
                    onChange={(e) => setFrag(row.code, i, e.target.value)}
                    placeholder={i === 0 ? '4' : '7'}
                    inputMode="numeric"
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block text-[11px] text-white/50">
              Digit answer (join slip 1 + slip 2)
              <input
                className={`${inputClass} mt-1 font-mono text-lg tracking-[0.2em]`}
                value={row.joinedWord || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setDraft((prev) => prev.map((r) => (
                    r.code === row.code
                      ? {
                        ...r,
                        joinedWord: value,
                        plantFragments: value.length >= SLIPS
                          ? splitDigitSlips(value, SLIPS)
                          : r.plantFragments,
                      }
                      : r
                  )));
                }}
                placeholder="e.g. 47"
                inputMode="numeric"
              />
            </label>
          </div>
        ))}
      </div>

      {msg ? <p className="mt-2 text-sm text-[#0ECCEE]">{msg}</p> : null}
    </section>
  );
}
