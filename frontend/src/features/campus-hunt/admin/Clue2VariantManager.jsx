import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGetOverview,
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue2,
  adminUpdateEvent,
} from '../services/campusHunt.api';
import {
  CAMPUS_STARTS,
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  TEAM_SLOTS,
  globalTeamNumber,
  resolveStations,
  secondStopArrivalPlan,
  secondStopForLocalTeam,
  threeDigitCodeForTeam,
  waitIndexForStart,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const DEFAULT_SETTINGS = {
  timerStartDelaySeconds: 20,
  timerSeconds: 180,
  maxAttempts: 3,
  hintCost: 15,
  allowLateSubmit: true,
  awardMode: 'time_bands_total',
  basePoints: 0,
  speedBonusBands: [
    { maxSeconds: 60, bonus: 50 },
    { maxSeconds: 120, bonus: 30 },
    { maxSeconds: 180, bonus: 10 },
  ],
};

const SHARED_PROMPT =
  'A staff mark hides in plain sight nearby. '
  + 'Scan the area at eye level — find your team’s 3-digit number.';

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

function resolveSecondCheckpoint(checkpoints, {
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
  onChanged,
}) {
  const stations = useMemo(() => resolveStations(campusStations), [campusStations]);
  const arrivalPlan = useMemo(() => secondStopArrivalPlan(stations), [stations]);

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
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

  const expectedCount = orderedPoints.length * TEAM_SLOTS.length;

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

    const clue2 = overview.data?.event?.scoringConfig?.clue2 || {};
    setSettings({
      ...DEFAULT_SETTINGS,
      ...clue2,
      speedBonusBands: clue2.speedBonusBands?.length
        ? clue2.speedBonusBands
        : DEFAULT_SETTINGS.speedBonusBands,
    });

    const nextCodes = {};
    arrivalPlan.forEach((place) => {
      place.arrivals.forEach((row) => {
        const wait = waitIndexForStart(row.startingPointCode);
        const key = `${row.startingPointCode}-T${row.localTeamNumber}`;
        const existing = list.find((v) => (
          String(v.variantKey || '').toUpperCase()
          === variantKeyFor(row.startingPointCode, `T${row.localTeamNumber}`)
        ));
        nextCodes[key] = existing?.answer || threeDigitCodeForTeam(wait, row.localTeamNumber);
      });
    });
    setCodes(nextCodes);

    const sample = list.find((row) => row.prompt)?.prompt;
    if (sample) setPrompt(sample);
  }, [eventId, arrivalPlan]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 2'));
  }, [refresh]);

  const saveDefaults = async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const overview = await adminGetOverview(eventId);
      const prev = overview.data?.event?.scoringConfig || {};
      await adminUpdateEvent(eventId, {
        scoringConfig: {
          ...prev,
          clue2: {
            ...DEFAULT_SETTINGS,
            ...settings,
            timerStartDelaySeconds: Number(settings.timerStartDelaySeconds) || 20,
            timerSeconds: Number(settings.timerSeconds) || 180,
            maxAttempts: Number(settings.maxAttempts) || 3,
            hintCost: Number(settings.hintCost) || 15,
            allowLateSubmit: settings.allowLateSubmit !== false,
            awardMode: 'time_bands_total',
            basePoints: 0,
            speedBonusBands: settings.speedBonusBands || DEFAULT_SETTINGS.speedBonusBands,
          },
        },
      });
      setMessage('Saved Clue 2 defaults for all 40 teams');
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save defaults');
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    if (!eventId || !roundId) {
      setError('Create Round 1 first');
      return;
    }
    if (orderedPoints.length < 4) {
      setError('Need 4 starting points (A–D)');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Saving all 40 Clue 2 codes…');

    try {
      const clue2Scoring = {
        ...DEFAULT_SETTINGS,
        ...settings,
        timerStartDelaySeconds: Number(settings.timerStartDelaySeconds) || 20,
        timerSeconds: Number(settings.timerSeconds) || 180,
        maxAttempts: Number(settings.maxAttempts) || 3,
        hintCost: Number(settings.hintCost) || 15,
        allowLateSubmit: true,
        awardMode: 'time_bands_total',
        basePoints: 0,
        speedBonusBands: settings.speedBonusBands || DEFAULT_SETTINGS.speedBonusBands,
      };

      const variantsPayload = [];
      const failures = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const waitIndex = waitIndexForStart(code);
        for (const slot of TEAM_SLOTS) {
          const waveId = slot.id;
          const place = secondStopForLocalTeam(slot.localTeamNumber, waitIndex, stations);
          const stationCode = stations.find((s) => s.name === place)?.code;
          const codeKey = `${code}-${waveId}`;
          const answer = String(
            codes[codeKey] || threeDigitCodeForTeam(waitIndex, slot.localTeamNumber),
          ).trim();
          if (!/^\d{3}$/.test(answer)) {
            failures.push(
              `${startLabel(point)} · ${waveId}: Team ${globalTeamNumber(waitIndex, slot.localTeamNumber)} needs a 3-digit code`,
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
        setError(failures[0] || 'No valid codes to save');
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
          `Saved ${saved} Clue 2 codes in one request · bound ${bound} teams.`
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
          {STATION_TARGET_COUNT} places · {TARGET_TEAMS_PER_STATION} teams each · 3-digit codes
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= 40
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/40
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">1. Defaults for all 40 teams</h2>
        <p className="mt-1 text-xs text-white/50">
          20s to read instructions, then the solve timer. Points by speed; late submit = 0.
        </p>
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
        <p className="mt-2 text-[11px] text-white/40">
          Points: ≤1:00 = 50 · ≤2:00 = 30 · ≤3:00 = 10 · after timer = 0 (late OK)
        </p>
        <button
          type="button"
          disabled={busy || !eventId}
          onClick={saveDefaults}
          className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save defaults'}
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
        <h2 className="text-base font-semibold text-white">3. Who goes where · 3-digit codes</h2>
        <p className="mt-1 text-xs text-white/50">
          Second stop = next campus place after Clue 1. Assign each team’s code here.
          After they crack it they scan the SECOND SCAN poster at that place.
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
                      className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-sm"
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
                          const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setCodes((prev) => ({ ...prev, [codeKey]: value }));
                        }}
                        inputMode="numeric"
                        maxLength={3}
                        aria-label={`Code for team ${row.teamNumber}`}
                        className={`${inputClass} py-1.5 text-center font-mono tracking-wider`}
                        placeholder="000"
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
          disabled={busy || !roundId || orderedPoints.length < 4}
          onClick={saveAll}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save Clue 2 · bind 40 teams'}
        </button>
        {!orderedPoints.length && (
          <p className="text-xs text-amber-200">Add 4 starting points first.</p>
        )}
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
      <p className="text-[11px] text-white/40">
        Same flow as Clue 1: update/create SECOND SCAN posters, save each team’s code, then bind dashboards.
        Early SECOND QR scans stay rejected until Clue 2 is solved.
      </p>
    </div>
  );
}
