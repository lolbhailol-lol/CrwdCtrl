import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetOverview,
  adminListChallenges,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue4,
  adminSaveClueScoring,
} from '../services/campusHunt.api';
import {
  CLUE4_DEFAULT_SETTINGS,
  coerceClueScoring,
  loadClueSettings,
} from './clueSettings';
import {
  CAMPUS_STARTS,
  TARGET_TEAMS_PER_STATION,
  TEAMS_PER_WAIT,
  buildTeamSlots,
  fourthStopArrivalPlan,
  fourthStopForLocalTeam,
  globalTeamNumber,
  propCodeForTeam,
  resolveStations,
  resolveStarts,
  waitIndexForStart,
} from './campusHuntFormat';
import { STAGE_THEMES } from '../types/stageTheme';

const THEME = STAGE_THEMES.clue4;
const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const DEFAULT_SETTINGS = CLUE4_DEFAULT_SETTINGS;

const SHARED_PROMPT =
  'CRAZY PROP HUNT — hunt as a team for the silly planted prop in plain sight. '
  + 'Read the short code on its sticker and type it here (leader submits).';

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

export default function Clue4VariantManager({
  eventId,
  roundId,
  campusStations,
  campusStarts,
  stationCount = null,
  onChanged,
  teamCapacity = 40,
  teamSize = 4,
  teamsPerWait = TEAMS_PER_WAIT,
  teamsPerStation = TARGET_TEAMS_PER_STATION,
}) {
  const stations = useMemo(
    () => resolveStations(campusStations, stationCount),
    [campusStations, stationCount],
  );
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const teamSlots = useMemo(() => buildTeamSlots(teamsPerWait), [teamsPerWait]);
  const arrivalPlan = useMemo(
    () => fourthStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [variants, setVariants] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [codes, setCodes] = useState({});
  const [prompt, setPrompt] = useState(SHARED_PROMPT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    setRoutes(routeResult.data?.routes || []);
    setPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    const list = (challengeResult.data?.challenges || []).filter(
      (row) => Number(row.challengeNumber) === 4 && String(row.variantKey || '') !== 'DEFAULT',
    );
    setVariants(list);

    setSettings(loadClueSettings(overview.data?.event?.scoringConfig, 'clue4', DEFAULT_SETTINGS, list[0]));

    const nextCodes = {};
    arrivalPlan.forEach((place) => {
      place.arrivals.forEach((row) => {
        const stationIndex = stations.findIndex((s) => s.name === place.name);
        const key = `${row.startingPointCode}-T${row.localTeamNumber}`;
        const existing = list.find((v) => (
          String(v.variantKey || '').toUpperCase()
          === variantKeyFor(row.startingPointCode, `T${row.localTeamNumber}`)
        ));
        nextCodes[key] = existing?.answer
          || propCodeForTeam(stationIndex >= 0 ? stationIndex : 0, row.localTeamNumber);
      });
    });
    setCodes(nextCodes);

    const sample = list.find((row) => row.prompt)?.prompt;
    if (sample) setPrompt(sample);
  }, [eventId, arrivalPlan, stations]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 4'));
  }, [refresh]);

  const saveAll = async () => {
    if (!eventId || !roundId) {
      setError('Create Round 1 first');
      return;
    }
    if (orderedPoints.length < 1) {
      setError('Need at least 1 active starting point. Save layout / bootstrap first.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage(`Saving all ${teamCapacity} Clue 4 prop codes…`);

    try {
      const clue4Scoring = coerceClueScoring(settings, DEFAULT_SETTINGS);

      const variantsPayload = [];
      const failures = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const waitIndex = waitIndexForStart(code);
        for (const slot of teamSlots) {
          const waveId = slot.id;
          const place = fourthStopForLocalTeam(slot.localTeamNumber, waitIndex, stations);
          const stationCode = stations.find((s) => s.name === place)?.code;
          const stationIndex = stations.findIndex((s) => s.name === place);
          const codeKey = `${code}-${waveId}`;
          const answer = String(
            codes[codeKey]
              || propCodeForTeam(stationIndex >= 0 ? stationIndex : 0, slot.localTeamNumber),
          ).trim().toUpperCase();
          if (!answer) {
            failures.push(
              `${startLabel(point)} · ${waveId}: Team ${globalTeamNumber(waitIndex, slot.localTeamNumber, teamsPerWait)} needs a prop code`,
            );
            continue;
          }
          variantsPayload.push({
            startCode: code,
            waveId,
            localTeamNumber: slot.localTeamNumber,
            answer,
            place,
            stationCode,
            routeId: id(routeForStart(routes, point)),
            startingPointId: id(point),
          });
        }
      }

      if (!variantsPayload.length) {
        setError(failures[0] || 'No valid prop codes to save');
        setMessage('');
        return;
      }

      const result = await adminBulkSaveClue4(eventId, {
        roundId,
        prompt: prompt.trim() || SHARED_PROMPT,
        scoring: clue4Scoring,
        variants: variantsPayload,
      });
      const saved = result.data?.saved ?? 0;
      const apiErrors = result.data?.errors || [];
      const bound = result.data?.fourthPostersBound ?? result.data?.teamsUpdated ?? 0;

      await refresh();
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || failures[0] || 'Clue 4 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} Clue 4 prop codes in one request · bound ${bound} teams.`
          + (apiErrors.length || failures.length
            ? ` (${apiErrors.length + failures.length} warnings)`
            : ''),
        );
        setError(failures[0] || '');
      }
    } catch (err) {
      setError(err.message || 'Could not save Clue 4');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const saveDefaults = async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    try {
      const scoring = coerceClueScoring(settings, DEFAULT_SETTINGS);
      await adminSaveClueScoring(eventId, 4, {
        roundId,
        scoring,
      });
      await refresh();
      setMessage(`Saved Clue 4 timer & hint settings for all ${teamCapacity} teams`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save defaults');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = variants.filter((v) => v.active !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Purple · prop hunt then FOURTH SCAN
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · ~{teamsPerStation} teams each · prop codes
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= teamCapacity
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{teamCapacity}
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">1. Timer defaults (all teams)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-white/55">
            Read delay (sec)
            <input
              type="number"
              min="0"
              value={settings.timerStartDelaySeconds}
              onChange={(e) => setSettings((s) => ({
                ...s,
                timerStartDelaySeconds: e.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
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
            Hint cost
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
          {busy ? 'Saving…' : 'Save timer defaults'}
        </button>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">2. Shared clue text</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={`mt-2 min-h-20 ${inputClass}`}
          placeholder={SHARED_PROMPT}
        />
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">3. Who goes where · prop codes</h2>
        <p className="mt-1 text-xs text-white/50">
          Fourth stop = purple prop hunt. Each team gets a sticker word to type after finding the prop.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {arrivalPlan.map((place) => (
            <div
              key={place.code}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-white">{place.name}</p>
                <p className="text-xs font-semibold text-[#0ECCEE]">
                  {place.teamCount} teams
                </p>
              </div>
              <div className="mt-2 space-y-2">
                {place.arrivals.map((row) => {
                  const codeKey = `${row.startingPointCode}-T${row.localTeamNumber}`;
                  return (
                    <div
                      key={`${place.code}-${row.teamNumber}`}
                      className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-2 text-sm"
                    >
                      <span className="font-semibold text-white">T{row.teamNumber}</span>
                      <span className="truncate text-white/55">
                        from{' '}
                        <span className="text-emerald-300">
                          {row.startingPointName || row.waitName}
                        </span>
                      </span>
                      <input
                        value={codes[codeKey] || ''}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/\s+/g, '');
                          setCodes((prev) => ({ ...prev, [codeKey]: value }));
                        }}
                        aria-label={`Prop code for team ${row.teamNumber}`}
                        className={`${inputClass} py-1.5 text-center font-mono tracking-wider`}
                        placeholder="WOOF"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !roundId || orderedPoints.length < 1}
          onClick={saveAll}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : `Save Clue 4 · bind ${teamCapacity} teams`}
        </button>
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
