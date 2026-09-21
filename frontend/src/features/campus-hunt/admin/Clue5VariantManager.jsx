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
  clue5WordForStart,
  fifthStopArrivalPlan,
  letterSlipsForWord,
  resolveStations,
  resolveStarts,
  routeClueDefaults,
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

/**
 * Clue 5: letter slips → one word. Show plant list for every team’s red stop.
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
  const [challenges, setChallenges] = useState([]);
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
      (row) => Number(row.challengeNumber) === 5,
    );
    setChallenges(list);
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
      const route = routeForStart(routeList, point);
      const existing = list.find((row) => id(row.routeId) === id(route));
      nextWords[code] = String(existing?.answer || clue5WordForStart(code))
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase() || clue5WordForStart(code);
    });
    setWords(nextWords);

    const sample = list.find((row) => {
      const old = String(row.prompt || '');
      return old && !/collaborative|piece of the|each teammate/i.test(old);
    })?.prompt;
    setPrompt(sample || SHARED_PROMPT);
  }, [eventId]);

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
    setMessage('Saving Clue 5 letter words for all teams…');

    try {
      const sharedPrompt = String(prompt || SHARED_PROMPT).trim() || SHARED_PROMPT;
      const routesPayload = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const answer = String(words[code] || clue5WordForStart(code))
          .replace(/[^A-Za-z]/g, '')
          .toUpperCase();
        if (!answer || answer.length < 3) {
          setError(`${startLabel(point)}: Clue 5 word needs at least 3 letters`);
          setMessage('');
          setBusy(false);
          return;
        }
        const defaults = routeClueDefaults(5, answer, people);
        routesPayload.push({
          startCode: code,
          prompt: sharedPrompt,
          answer,
          memberPrompts: defaults.memberPrompts,
          destinationInstruction: defaults.destinationInstruction,
          routeId: id(routeForStart(routes, point)),
          startingPointId: id(point),
        });
      }

      const result = await adminBulkSaveClue5(eventId, {
        roundId,
        scoring: coerceClueScoring(settings, CLUE5_DEFAULT_SETTINGS),
        routes: routesPayload,
      });
      const saved = result.data?.saved ?? 0;
      const apiErrors = result.data?.errors || [];

      await refresh();
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || 'Clue 5 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} Clue 5 word(s) · letter slips ready for all ${teamCapacity} teams.`,
        );
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Could not save Clue 5');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = challenges.filter((c) => c.active !== false).length;
  const plantedPlaces = arrivalPlan.filter((p) => p.teamCount > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Red · letter slips → one word · for all teams
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {plantedPlaces} red stops · {teamsPerStation === 1 ? '1 team each' : `~${teamsPerStation} teams each`}
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= orderedPoints.length && orderedPoints.length > 0
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{orderedPoints.length || starts.length} start paths
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">1. Defaults for all teams</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-white/55">
            Solve timer (sec)
            <input
              type="number"
              min="1"
              value={settings.timerSeconds}
              onChange={(e) => setSettings((s) => ({ ...s, timerSeconds: e.target.value }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs text-white/55">
            Max attempts
            <input
              type="number"
              min="1"
              value={settings.maxAttempts}
              onChange={(e) => setSettings((s) => ({ ...s, maxAttempts: e.target.value }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs text-white/55">
            Hint cost (pts)
            <input
              type="number"
              min="0"
              value={settings.hintCost}
              onChange={(e) => setSettings((s) => ({ ...s, hintCost: e.target.value }))}
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
        <h2 className="text-base font-semibold text-white">2. Shared phone prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={`mt-2 min-h-20 ${inputClass}`}
          placeholder={SHARED_PROMPT}
        />
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">3. Word per start path</h2>
        <p className="mt-1 text-xs text-white/50">
          Teams from the same gather share one word. Print that word’s letter slips at every red stop
          those teams visit.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {orderedPoints.map((point) => {
            const code = startCode(point);
            const word = words[code] || clue5WordForStart(code);
            const slips = letterSlipsForWord(word);
            const teamCount = teamSlots.length;
            return (
              <div
                key={code}
                className={`rounded-xl border px-3 py-3 ${THEME.borderClass} bg-black/20`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{startLabel(point)}</p>
                  <p className={`text-xs font-semibold ${THEME.textClass}`}>
                    {teamCount} teams
                  </p>
                </div>
                <label className="mt-2 block text-xs text-white/55">
                  Correct word
                  <input
                    value={word}
                    onChange={(e) => setWords((prev) => ({
                      ...prev,
                      [code]: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase(),
                    }))}
                    className={`mt-1 font-mono tracking-[0.2em] ${inputClass}`}
                    placeholder={clue5WordForStart(code)}
                  />
                </label>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-white/35">
                  Print {slips.length} letter slips
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {slips.map((letter, index) => (
                    <span
                      key={`${code}-slip-${index}`}
                      className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 font-mono text-lg font-bold tracking-wide text-red-100"
                    >
                      <span className="mr-1 text-[10px] text-white/35">{index + 1}.</span>
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">4. Who goes where · letter slips for all teams</h2>
        <p className="mt-1 text-xs text-white/50">
          Fifth stop = red. Plant the numbered letter slips below at that place for each team.
          After they type the word → red FIFTH SCAN → Clue 6.
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
                    const code = row.startingPointCode;
                    const word = words[code]
                      || clue5WordForStart(code);
                    const slips = letterSlipsForWord(word);
                    return (
                      <div
                        key={`${place.code}-${row.teamNumber}`}
                        className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold text-white">T{row.teamNumber}</span>
                          <span className="truncate text-white/55">
                            from{' '}
                            <span className="text-emerald-300">
                              {row.startingPointName || row.waitName}
                            </span>
                            {' · '}
                            <span className={`font-mono font-bold ${THEME.textClass}`}>{word}</span>
                          </span>
                        </div>
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
          {busy ? 'Saving…' : `Save Clue 5 · all ${teamCapacity} teams`}
        </button>
      </div>
      {message && <p className={`text-xs ${THEME.textClass}`}>{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
