import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminBulkSaveClue5,
  adminGetOverview,
  adminListChallenges,
  adminListRoutes,
  adminListStartingPoints,
  adminSaveClueScoring,
} from '../services/campusHunt.api';
import {
  CLUE5_DEFAULT_SETTINGS,
  coerceClueScoring,
  loadClueSettings,
} from './clueSettings';
import {
  CAMPUS_STARTS,
  TARGET_TEAMS_PER_STATION,
  TEAMS_PER_WAIT,
  buildTeamSlots,
  clue5WordForTeam,
  fifthStopArrivalPlan,
  letterSlipsForWord,
  resolveStations,
  resolveStarts,
  routeClueDefaults,
  waitIndexForStart,
} from './campusHuntFormat';
import { STAGE_THEMES } from '../types/stageTheme';

const THEME = STAGE_THEMES.final;
const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const SHARED_PROMPT =
  'At the red stop: find the letter slips planted nearby (letters only — not digits).\n'
  + 'Join them in order into one word. Leader submits.';

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function startCode(pointOrCode) {
  const raw = typeof pointOrCode === 'string'
    ? pointOrCode
    : String(pointOrCode?.code || pointOrCode?.routeKey || '');
  const upper = raw.toUpperCase().trim();
  if (/^[A-D]$/.test(upper)) return upper;
  const stripped = upper.replace(/^START[-_\s]?/, '');
  if (/^[A-D]$/.test(stripped)) return stripped;
  return stripped.match(/^([A-D])/)?.[1] || upper.charAt(0);
}

function startLabel(point) {
  const code = startCode(point);
  return CAMPUS_STARTS.find((s) => s.code === code)?.name || point?.name || code;
}

function routeForStart(routes, point) {
  const code = startCode(point);
  return routes.find((route) => String(route.routeKey || '').toUpperCase() === code) || null;
}

function variantKeyFor(code, waveId) {
  return `${code}-${waveId}`.toUpperCase();
}

/**
 * Clue 5: unique letter-word per team — plant slips at that team’s red stop.
 */
export default function Clue5VariantManager({
  eventId,
  roundId,
  campusStations,
  campusStarts,
  stationCount = null,
  onChanged,
  teamCapacity = 20,
  teamSize = 4,
  teamsPerWait = TEAMS_PER_WAIT,
  teamsPerStation = TARGET_TEAMS_PER_STATION,
}) {
  const people = Math.max(2, Math.min(12, Number(teamSize) || 4));
  const stations = useMemo(
    () => resolveStations(campusStations, stationCount),
    [campusStations, stationCount],
  );
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const teamSlots = useMemo(() => buildTeamSlots(teamsPerWait), [teamsPerWait]);
  const arrivalPlan = useMemo(
    () => fifthStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [variants, setVariants] = useState([]);
  const [words, setWords] = useState({});
  const [prompt, setPrompt] = useState(SHARED_PROMPT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(CLUE5_DEFAULT_SETTINGS);

  const orderedPoints = useMemo(() => {
    const order = CAMPUS_STARTS.map((s) => s.code);
    return [...points]
      .filter((p) => p.active !== false)
      .sort((a, b) => order.indexOf(startCode(a)) - order.indexOf(startCode(b)));
  }, [points]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [overview, challengeResult, routeResult, pointResult] = await Promise.all([
      adminGetOverview(eventId),
      adminListChallenges(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId),
    ]);
    const routeList = routeResult.data?.routes || [];
    const pointList = pointResult.data?.startingPoints || pointResult.data?.points || [];
    setRoutes(routeList);
    setPoints(pointList);
    const list = (challengeResult.data?.challenges || []).filter(
      (row) => Number(row.challengeNumber) === 5 && row.active !== false,
    );
    setVariants(list);
    setSettings(loadClueSettings(
      overview.data?.event?.scoringConfig,
      'clue5',
      CLUE5_DEFAULT_SETTINGS,
      list[0],
    ));

    const order = CAMPUS_STARTS.map((s) => s.code);
    const ordered = [...pointList]
      .filter((p) => p.active !== false)
      .sort((a, b) => order.indexOf(startCode(a)) - order.indexOf(startCode(b)));

    const nextWords = {};
    ordered.forEach((point) => {
      const code = startCode(point);
      const waitIndex = waitIndexForStart(code);
      teamSlots.forEach((slot) => {
        const waveId = slot.id;
        const key = `${code}-${waveId}`;
        const existing = list.find((row) => (
          String(row.variantKey || '').toUpperCase() === variantKeyFor(code, waveId)
        ));
        nextWords[key] = String(
          existing?.answer || clue5WordForTeam(waitIndex, slot.localTeamNumber, teamsPerWait),
        ).replace(/[^A-Za-z]/g, '').toUpperCase()
          || clue5WordForTeam(waitIndex, slot.localTeamNumber, teamsPerWait);
      });
    });
    setWords(nextWords);

    const sample = list.find((row) => {
      const old = String(row.prompt || '');
      return old && !/collaborative|piece of the|each teammate/i.test(old);
    })?.prompt;
    setPrompt(sample || SHARED_PROMPT);
  }, [eventId, teamSlots, teamsPerWait]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 5'));
  }, [refresh]);

  const saveDefaults = async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminSaveClueScoring(eventId, 5, {
        roundId,
        scoring: coerceClueScoring(settings, CLUE5_DEFAULT_SETTINGS),
      });
      await refresh();
      setMessage(`Saved Clue 5 timer & hint settings for all ${teamCapacity} teams`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save settings');
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    if (!eventId || !roundId) {
      setError('Create the hunt first');
      return;
    }
    if (orderedPoints.length < 1) {
      setError('Need at least 1 active starting point.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Saving unique Clue 5 letter words for all teams…');

    try {
      const sharedPrompt = String(prompt || SHARED_PROMPT).trim() || SHARED_PROMPT;
      const variantsPayload = [];
      const failures = [];
      const usedWords = new Set();

      for (const point of orderedPoints) {
        const code = startCode(point);
        const waitIndex = waitIndexForStart(code);
        const route = routeForStart(routes, point);
        if (!route) {
          failures.push(`${startLabel(point)}: no route ${code}`);
          continue;
        }
        for (const slot of teamSlots) {
          const waveId = slot.id;
          const codeKey = `${code}-${waveId}`;
          let answer = String(
            words[codeKey]
            || clue5WordForTeam(waitIndex, slot.localTeamNumber, teamsPerWait),
          ).replace(/[^A-Za-z]/g, '').toUpperCase();
          if (!answer || answer.length < 3) {
            failures.push(
              `${startLabel(point)} · ${waveId}: word needs at least 3 letters`,
            );
            continue;
          }
          if (usedWords.has(answer)) {
            failures.push(
              `${startLabel(point)} · ${waveId}: word ${answer} already used — each team needs a unique word`,
            );
            continue;
          }
          usedWords.add(answer);
          const defaults = routeClueDefaults(5, answer, people);
          variantsPayload.push({
            startCode: code,
            waveId,
            localTeamNumber: slot.localTeamNumber,
            prompt: sharedPrompt,
            answer,
            memberPrompts: [],
            destinationInstruction: defaults.destinationInstruction,
            routeId: id(route),
            startingPointId: id(point),
          });
        }
      }

      if (!variantsPayload.length) {
        setError(failures[0] || 'Nothing to save');
        setMessage('');
        return;
      }

      const result = await adminBulkSaveClue5(eventId, {
        roundId,
        scoring: coerceClueScoring(settings, CLUE5_DEFAULT_SETTINGS),
        variants: variantsPayload,
      });
      const saved = result.data?.saved ?? 0;
      const bound = result.data?.teamsUpdated ?? 0;
      const apiErrors = result.data?.errors || [];

      await refresh();
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || failures[0] || 'Clue 5 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} unique Clue 5 words · bound ${bound} teams.`
          + (apiErrors.length || failures.length
            ? ` (${apiErrors.length + failures.length} warnings)`
            : ''),
        );
        setError(failures[0] || '');
      }
    } catch (err) {
      setError(err.message || 'Could not save Clue 5');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = variants.filter((v) => (
    v.active !== false && String(v.variantKey || '').toUpperCase() !== 'DEFAULT'
  )).length;
  const uniqueSaved = new Set(
    variants
      .filter((v) => v.active !== false && String(v.variantKey || '').toUpperCase() !== 'DEFAULT')
      .map((v) => String(v.answer || '').replace(/[^A-Za-z]/g, '').toUpperCase())
      .filter((w) => w.length >= 3),
  ).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Red · unique letter word per team · plant slips
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · {teamsPerStation === 1 ? '1 team each' : `~${teamsPerStation} teams each`}
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= teamCapacity && uniqueSaved >= teamCapacity
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{teamCapacity} · {uniqueSaved} unique words
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Defaults for all teams</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs text-white/55">
            Max attempts
            <input
              type="number"
              min={1}
              max={5}
              value={settings.maxAttempts}
              onChange={(e) => setSettings((s) => ({ ...s, maxAttempts: Number(e.target.value) || 2 }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs text-white/55">
            Timer (seconds)
            <input
              type="number"
              min={0}
              value={settings.timerSeconds}
              onChange={(e) => setSettings((s) => ({ ...s, timerSeconds: Number(e.target.value) || 0 }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs text-white/55">
            Hint cost
            <input
              type="number"
              min={0}
              value={settings.hintCost}
              onChange={(e) => setSettings((s) => ({ ...s, hintCost: Number(e.target.value) || 0 }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={saveDefaults}
          className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save settings only'}
        </button>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Shared phone prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={`mt-2 min-h-20 ${inputClass}`}
          placeholder={SHARED_PROMPT}
        />
      </section>

      <p className="text-xs text-white/50">
        Each team gets its own letter word. Plant that team’s numbered letter slips at their red stop.
        No two teams share a word. After they type → red FIFTH SCAN → Clue 6.
      </p>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Who goes where · unique letter words</h2>
        <p className="mt-1 text-xs text-white/50">
          Edit each team’s word. Slips update live — print those letters at that red place.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {arrivalPlan.map((place) => {
            if (!place.teamCount) return null;
            return (
              <div
                key={place.code}
                className={`rounded-xl border px-3 py-3 ${THEME.borderClass} bg-black/20`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{place.name}</p>
                  <p className={`text-xs font-semibold ${THEME.textClass}`}>
                    {place.teamCount} {place.teamCount === 1 ? 'team' : 'teams'}
                  </p>
                </div>
                <div className="mt-2 space-y-3">
                  {place.arrivals.map((row) => {
                    const codeKey = `${row.startingPointCode}-T${row.localTeamNumber}`;
                    const word = words[codeKey] || '';
                    const slips = letterSlipsForWord(word);
                    return (
                      <div
                        key={`${place.code}-${row.teamNumber}`}
                        className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2"
                      >
                        <div className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-2 text-sm">
                          <span className="font-semibold text-white">T{row.teamNumber}</span>
                          <span className="truncate text-white/55">
                            from{' '}
                            <span className="text-emerald-300">
                              {row.startingPointName || row.waitName}
                            </span>
                          </span>
                          <input
                            value={word}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
                              setWords((prev) => ({ ...prev, [codeKey]: value }));
                            }}
                            aria-label={`Clue 5 word for team ${row.teamNumber}`}
                            className={`${inputClass} py-1.5 text-center font-mono text-sm tracking-[0.18em] ${THEME.textClass}`}
                            placeholder="WORD"
                          />
                        </div>
                        {slips.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {slips.map((letter, index) => (
                              <span
                                key={`t${row.teamNumber}-l${index}`}
                                className="rounded border border-red-400/35 bg-red-500/10 px-2 py-1 font-mono text-sm font-bold text-red-100"
                              >
                                <span className="mr-0.5 text-[9px] text-white/35">{index + 1}</span>
                                {letter}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !roundId || orderedPoints.length < 1}
          onClick={saveAll}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
        >
          {busy ? 'Saving…' : `Save Clue 5 · bind ${teamCapacity} unique words`}
        </button>
      </div>
      {message && <p className={`text-xs ${THEME.textClass}`}>{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
