import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetOverview,
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue2,
  adminSaveClueScoring,
} from '../services/campusHunt.api';
import {
  CLUE2_DEFAULT_SETTINGS,
  coerceClueScoring,
  loadClueSettings,
} from './clueSettings';
import {
  CAMPUS_STARTS,
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  TEAMS_PER_WAIT,
  buildTeamSlots,
  resolveStations,
  resolveStarts,
  secondStopArrivalPlan,
  secondStopForLocalTeam,
  threeDigitCodeForTeam,
  waitIndexForStart,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const DEFAULT_SETTINGS = CLUE2_DEFAULT_SETTINGS;

const SHARED_PROMPT =
  'At the green stop: find the numbered digit slips (1, 2, 3…) nearby. '
  + 'Join them in order into one number and type it (leader), then scan the green poster.';

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

function _resolveSecondCheckpoint(checkpoints, {
  routeId,
  waveId,
  startingPointId,
  placeName,
}) {
  const key = `2-${String(waveId || '').toUpperCase()}`.toUpperCase();
  const onRoute = checkpoints.filter((cp) => id(cp.routeId) === id(routeId));
  const byStart = onRoute.find(
    (cp) => String(cp.checkpointKey || '').toUpperCase() === key
      && id(cp.startingPointId) === id(startingPointId),
  );
  if (byStart) return byStart;
  const byWave = onRoute.find((cp) => String(cp.checkpointKey || '').toUpperCase() === key);
  if (byWave) return byWave;
  if (placeName) {
    const byPlace = onRoute.find((cp) => (
      String(cp.progressionKey || '') === '2'
      && String(cp.locationName || '').toLowerCase() === String(placeName).toLowerCase()
      && String(cp.checkpointKey || '').toUpperCase().includes(String(waveId || '').toUpperCase())
    ));
    if (byPlace) return byPlace;
  }
  return onRoute.find((cp) => (
    String(cp.progressionKey || '') === '2'
    && String(cp.checkpointKey || '').toUpperCase().includes(String(waveId || '').toUpperCase())
  )) || null;
}

export default function Clue2VariantManager({
  eventId,
  roundId,
  campusStations,
  campusStarts,
  stationCount = null,
  onChanged,
  teamCapacity = 20,
  teamSize: _teamSize = 4,
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
    () => secondStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [_checkpoints, setCheckpoints] = useState([]);
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

  const _expectedCount = orderedPoints.length * teamSlots.length;

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
      (row) => Number(row.challengeNumber) === 2 && String(row.variantKey || '') !== 'DEFAULT',
    );
    setVariants(list);

    setSettings(loadClueSettings(overview.data?.event?.scoringConfig, 'clue2', DEFAULT_SETTINGS, list[0]));

    const nextCodes = {};
    arrivalPlan.forEach((place) => {
      place.arrivals.forEach((row) => {
        const wait = waitIndexForStart(row.startingPointCode);
        const key = `${row.startingPointCode}-T${row.localTeamNumber}`;
        const existing = list.find((v) => (
          String(v.variantKey || '').toUpperCase()
          === variantKeyFor(row.startingPointCode, `T${row.localTeamNumber}`)
        ));
        const plant = String(place.joinedWord || '').replace(/\D/g, '').slice(0, 3);
        const saved = String(existing?.answer || '').replace(/\D/g, '').slice(0, 3);
        if (plant.length >= 3) nextCodes[key] = plant;
        else if (saved.length >= 3) nextCodes[key] = saved;
        else nextCodes[key] = threeDigitCodeForTeam(wait, row.localTeamNumber, teamsPerWait);
      });
    });
    setCodes(nextCodes);

    const sample = list.find((row) => row.prompt)?.prompt;
    if (sample) setPrompt(sample);
  }, [eventId, arrivalPlan, teamsPerWait]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 2'));
  }, [refresh]);

  const saveDefaults = async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const scoring = coerceClueScoring(settings, DEFAULT_SETTINGS);
      await adminSaveClueScoring(eventId, 2, {
        roundId,
        scoring,
      });
      await refresh();
      setMessage(`Saved Clue 2 attempt & hint settings for all ${teamCapacity} teams`);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save defaults');
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
    setMessage(`Saving Clue 2 with shared digit answers…`);

    try {
      const clue2Scoring = coerceClueScoring(settings, DEFAULT_SETTINGS);

      const variantsPayload = [];
      const failures = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const waitIndex = waitIndexForStart(code);
        for (const slot of teamSlots) {
          const waveId = slot.id;
          const place = secondStopForLocalTeam(slot.localTeamNumber, waitIndex, stations, teamsPerWait);
          const station = stations.find((s) => s.name === place || s.code === place);
          const stationCode = station?.code;
          // Prefer plant digit slips for this place; never leave letter-word leftovers.
          const plantDigits = String(
            station?.joinedWord
            || place?.joinedWord
            || '',
          ).replace(/\D/g, '').slice(0, 3);
          const savedDigits = String(codes[`${code}-${waveId}`] || '').replace(/\D/g, '').slice(0, 3);
          const answer = (plantDigits.length >= 3 ? plantDigits : '')
            || (savedDigits.length >= 3 ? savedDigits : '')
            || threeDigitCodeForTeam(waitIndex, slot.localTeamNumber, teamsPerWait);
          if (!answer || answer.length < 3) {
            failures.push(
              `${startLabel(point)} · ${waveId}: Set 3-digit answer for ${place || 'stop'}`,
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
        setError(failures[0] || 'No digit answers to save — Fill COEP defaults under Places → Digit slips');
        setMessage('');
        return;
      }

      const result = await adminBulkSaveClue2(eventId, {
        roundId,
        prompt: prompt.trim() || SHARED_PROMPT,
        scoring: clue2Scoring,
        variants: variantsPayload,
      });
      const saved = result.data?.saved ?? 0;
      const apiErrors = result.data?.errors || [];
      const bound = result.data?.secondPostersBound ?? result.data?.teamsUpdated ?? 0;

      await refresh();
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || failures[0] || 'Clue 2 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} Clue 2 digit answers · bound ${bound} teams.`
          + (apiErrors.length || failures.length
            ? ` (${apiErrors.length + failures.length} warnings)`
            : ''),
        );
        setError(failures[0] || '');
      }
    } catch (err) {
      setError(err.message || 'Could not save Clue 2');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = variants.filter((v) => v.active !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · {teamsPerStation === 1 ? '1 team each' : `~${teamsPerStation} teams each`} · shared digit answer
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
        <h2 className="text-base font-semibold text-white">1. Defaults for all {teamCapacity} teams</h2>
        <p className="mt-1 text-xs text-white/50">
          No timer — plant digit slips at green; teams find them and type the answer (+50).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-white/55">
            Points
            <input
              type="number"
              min="0"
              value={settings.basePoints}
              onChange={(e) => setSettings((s) => ({ ...s, basePoints: e.target.value }))}
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
          {busy ? 'Saving…' : 'Save settings only'}
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
        <h2 className="text-base font-semibold text-white">3. Who goes where</h2>
        <p className="mt-1 text-xs text-white/50">
          Second stop = next campus place after Clue 1. Same shared digit answer for every team
          at that place (set under Places → Digit slips) — not a different code per team.
          After they type the joined digits they scan the shared green SECOND SCAN QR once — Clue 3 unlocks.
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
                <p className="rounded-lg bg-black/30 px-2 py-1.5 font-mono text-sm text-[#0ECCEE]">
                  3-digit · {(
                    place.joinedWord
                    || stations.find((s) => s.code === place.code)?.joinedWord
                    || ''
                  ).replace(/\D/g, '').slice(0, 3) || '—'}
                  <span className="ml-2 font-sans text-[11px] text-white/45">
                    (shared · Places → Digit slips)
                  </span>
                </p>
                {place.arrivals.map((row) => (
                  <div
                    key={`${place.code}-${row.teamNumber}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-semibold text-white">T{row.teamNumber}</span>
                    <span className="truncate text-white/55">
                      from{' '}
                      <span className="text-emerald-300">
                        {row.startingPointName || row.waitName}
                      </span>
                    </span>
                  </div>
                ))}
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
          {busy ? 'Saving…' : `Save Clue 2 · bind ${teamCapacity} teams`}
        </button>
        {!orderedPoints.length && (
          <p className="text-xs text-amber-200">Need at least 1 gather point — save setup first.</p>
        )}
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
      <p className="text-[11px] text-white/40">
        Shared digit answer per place (Places → Digit slips). Teams at the same stop share one answer —
        not a different code per team. Green QR unlocks after the number is typed.
      </p>
    </div>
  );
}
