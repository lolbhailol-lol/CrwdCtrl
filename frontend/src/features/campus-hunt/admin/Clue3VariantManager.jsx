import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetOverview,
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue3,
  adminSaveClueScoring,
} from '../services/campusHunt.api';
import {
  CLUE3_DEFAULT_SETTINGS,
  coerceClueScoring,
  loadClueSettings,
} from './clueSettings';
import {
  CAMPUS_STARTS,
  TARGET_TEAMS_PER_STATION,
  TEAMS_PER_WAIT,
  buildTeamSlots,
  globalTeamNumber,
  lockboxCodeForTeam,
  resolveStations,
  resolveStarts,
  routeClueDefaults,
  thirdStopArrivalPlan,
  thirdStopForLocalTeam,
  waitIndexForStart,
} from './campusHuntFormat';
import { STAGE_THEMES } from '../types/stageTheme';

const THEME = STAGE_THEMES.clue3;
const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const SHARED_PROMPT =
  'Find the physical lockbox nearby.\n'
  + 'Type the code written on it.';

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
 * Clue 3: unique lockbox digit code per team — plant one box per team path.
 */
export default function Clue3VariantManager({
  eventId,
  roundId,
  campusStations,
  campusStarts,
  stationCount = null,
  onChanged,
  teamCapacity = 20,
  teamSize: teamSize = 4,
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
    () => thirdStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [_checkpoints, setCheckpoints] = useState([]);
  const [variants, setVariants] = useState([]);
  const [codes, setCodes] = useState({});
  const [prompt, setPrompt] = useState(SHARED_PROMPT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(CLUE3_DEFAULT_SETTINGS);

  const orderedPoints = useMemo(() => {
    const order = CAMPUS_STARTS.map((s) => s.code);
    return [...points]
      .filter((p) => p.active !== false)
      .sort((a, b) => order.indexOf(startCode(a)) - order.indexOf(startCode(b)));
  }, [points]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [overview, challengeResult, routeResult, pointResult, checkpointResult] = await Promise.all([
      adminGetOverview(eventId),
      adminListChallenges(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId),
      adminListCheckpoints(eventId),
    ]);
    setRoutes(routeResult.data?.routes || []);
    setPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    setCheckpoints(checkpointResult.data?.checkpoints || []);
    const list = (challengeResult.data?.challenges || []).filter(
      (row) => Number(row.challengeNumber) === 3 && String(row.variantKey || '') !== 'DEFAULT',
    );
    setVariants(list);
    setSettings(loadClueSettings(
      overview.data?.event?.scoringConfig,
      'clue3',
      CLUE3_DEFAULT_SETTINGS,
      list[0],
    ));

    const nextCodes = {};
    const used = new Set();
    arrivalPlan.forEach((place) => {
      place.arrivals.forEach((row) => {
        const waitIndex = waitIndexForStart(row.startingPointCode);
        const key = `${row.startingPointCode}-T${row.localTeamNumber}`;
        const existing = list.find((v) => (
          String(v.variantKey || '').toUpperCase()
          === variantKeyFor(row.startingPointCode, `T${row.localTeamNumber}`)
        ));
        const existingDigits = String(existing?.answer || '').replace(/\D/g, '');
        let answer = existingDigits;
        if (!answer || used.has(answer)) {
          answer = lockboxCodeForTeam(waitIndex, row.localTeamNumber, teamsPerWait);
          let spin = 0;
          while (used.has(answer) && spin < 24) {
            spin += 1;
            answer = lockboxCodeForTeam(waitIndex, row.localTeamNumber + spin, teamsPerWait);
          }
        }
        used.add(answer);
        nextCodes[key] = answer;
      });
    });
    setCodes(nextCodes);

    const sample = list.find((row) => {
      const old = String(row.prompt || '');
      return old
        && !/hard find|digit slips|LOCKBOX plaque|not numbered/i.test(old)
        && !/^THE LOCKBOX/i.test(old);
    })?.prompt;
    setPrompt(sample || SHARED_PROMPT);
  }, [eventId, arrivalPlan, teamsPerWait]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 3'));
  }, [refresh]);

  const saveDefaults = async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await adminSaveClueScoring(eventId, 3, {
        roundId,
        scoring: coerceClueScoring(settings, CLUE3_DEFAULT_SETTINGS),
      });
      await refresh();
      setMessage(`Saved Clue 3 attempt & hint settings for all ${teamCapacity} teams`);
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
      setError('Need at least 1 active starting point. Save layout / bootstrap first.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Saving unique Clue 3 Lockbox codes…');

    try {
      const variantsPayload = [];
      const failures = [];
      const usedAnswers = new Set();
      const sharedPrompt = String(prompt || SHARED_PROMPT).trim() || SHARED_PROMPT;

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
          const place = thirdStopForLocalTeam(slot.localTeamNumber, waitIndex, stations, teamsPerWait);
          const station = stations.find((s) => s.name === place);
          const stationCode = station?.code;
          const codeKey = `${code}-${waveId}`;
          let answer = String(
            codes[codeKey]
              || lockboxCodeForTeam(waitIndex, slot.localTeamNumber, teamsPerWait),
          ).replace(/\D/g, '').trim();
          if (!answer || answer.length < 3) {
            failures.push(
              `${startLabel(point)} · ${waveId}: Team ${globalTeamNumber(waitIndex, slot.localTeamNumber, teamsPerWait)} needs a lockbox code`,
            );
            continue;
          }
          if (usedAnswers.has(answer)) {
            failures.push(
              `${startLabel(point)} · ${waveId}: lockbox ${answer} is already used — each team needs a unique code`,
            );
            continue;
          }
          usedAnswers.add(answer);
          const defaults = routeClueDefaults(3, place, people, null, answer);
          variantsPayload.push({
            startCode: code,
            waveId,
            localTeamNumber: slot.localTeamNumber,
            prompt: sharedPrompt,
            answer,
            hintText: defaults.hintText,
            place,
            stationCode,
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

      const result = await adminBulkSaveClue3(eventId, {
        roundId,
        scoring: coerceClueScoring(settings, CLUE3_DEFAULT_SETTINGS),
        variants: variantsPayload,
      });
      const saved = result.data?.saved ?? 0;
      const bound = result.data?.thirdPostersBound ?? result.data?.teamsUpdated ?? 0;
      const apiErrors = result.data?.errors || [];

      await refresh();
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || failures[0] || 'Clue 3 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} unique Clue 3 Lockbox codes · bound ${bound} teams.`
          + (apiErrors.length || failures.length
            ? ` (${apiErrors.length + failures.length} warnings)`
            : ''),
        );
        setError(failures[0] || '');
      }
    } catch (err) {
      setError(err.message || 'Could not save Clue 3');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = variants.filter((v) => v.active !== false).length;
  const uniqueSaved = new Set(
    variants
      .filter((v) => v.active !== false)
      .map((v) => String(v.answer || '').replace(/\D/g, ''))
      .filter(Boolean),
  ).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Blue · unique lockbox per team · type the code
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · {teamsPerStation === 1 ? '1 team each' : `~${teamsPerStation} teams each`}
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= teamCapacity && uniqueSaved >= teamCapacity
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{teamCapacity} · {uniqueSaved} unique codes
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Defaults for all teams</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <h2 className="text-base font-semibold text-white">Shared phone prompt</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={`mt-2 min-h-20 ${inputClass}`}
          placeholder={SHARED_PROMPT}
        />
      </section>

      <p className="text-xs text-white/50">
        Plant one physical lockbox per team with that team’s unique code printed on it.
        No two teams share a code. After they type → blue THIRD SCAN → Field Terminal.
      </p>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Who goes where · unique lockbox codes</h2>
        <p className="mt-1 text-xs text-white/50">
          Each team gets its own number. Print that code on their lockbox at the blue stop.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {arrivalPlan.map((place) => (
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
              <div className="mt-2 space-y-2">
                {place.arrivals.map((row) => {
                  const codeKey = `${row.startingPointCode}-T${row.localTeamNumber}`;
                  return (
                    <div
                      key={`${place.code}-${row.teamNumber}`}
                      className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-2 text-sm"
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
                          const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                          setCodes((prev) => ({ ...prev, [codeKey]: value }));
                        }}
                        aria-label={`Lockbox code for team ${row.teamNumber}`}
                        className={`${inputClass} py-1.5 text-center font-mono text-base tracking-[0.2em] ${THEME.textClass}`}
                        placeholder="····"
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
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
        >
          {busy ? 'Saving…' : `Save Clue 3 · bind ${teamCapacity} unique codes`}
        </button>
      </div>
      {message && <p className={`text-xs ${THEME.textClass}`}>{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
