import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue3,
} from '../services/campusHunt.api';
import {
  CAMPUS_STARTS,
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  TEAMS_PER_WAIT,
  buildTeamSlots,
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

function resolveThirdCheckpoint(checkpoints, { routeId, waveId, startingPointId }) {
  const key = `3-${String(waveId || '').toUpperCase()}`.toUpperCase();
  const onRoute = checkpoints.filter((cp) => id(cp.routeId) === id(routeId));
  const byStart = onRoute.find(
    (cp) => String(cp.checkpointKey || '').toUpperCase() === key
      && id(cp.startingPointId) === id(startingPointId),
  );
  if (byStart) return byStart;
  return onRoute.find((cp) => String(cp.checkpointKey || '').toUpperCase() === key) || null;
}

/**
 * Clue 3: 10 places × ~4 teams — edit Caesar riddles; shared blue CP3 QR per place.
 */
export default function Clue3VariantManager({
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
    () => thirdStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [variants, setVariants] = useState([]);
  const [packContent, setPackContent] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const orderedPoints = useMemo(() => {
    const order = CAMPUS_STARTS.map((s) => s.code);
    return [...points]
      .filter((p) => p.active !== false)
      .sort((a, b) => order.indexOf(startCode(a)) - order.indexOf(startCode(b)));
  }, [points]);

  const expectedCount = orderedPoints.length * teamSlots.length;

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [challengeResult, routeResult, pointResult, checkpointResult] = await Promise.all([
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

    const nextPacks = {};
    arrivalPlan.forEach((place) => {
      const defaults = routeClueDefaults(3, place.name);
      const sample = list.find((v) => (
        String(v.answer || '').toLowerCase() === place.name.toLowerCase()
        || String(v.destinationInstruction || '').toLowerCase().includes(place.name.toLowerCase())
      ));
      nextPacks[place.code] = {
        prompt: sample?.prompt || defaults.prompt,
        answer: (sample?.answer || defaults.answer || place.name).trim(),
        hintText: sample?.hintText || defaults.hintText,
      };
    });
    setPackContent(nextPacks);
  }, [eventId, arrivalPlan]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Clue 3'));
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
    setMessage('Saving all Clue 3 riddles…');

    try {
      const variantsPayload = [];
      const failures = [];
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
          const place = thirdStopForLocalTeam(slot.localTeamNumber, waitIndex, stations);
          const station = stations.find((s) => s.name === place);
          const stationCode = station?.code;
          const content = packContent[stationCode] || routeClueDefaults(3, place);
          const prompt = String(content.prompt || '').trim();
          const answer = String(content.answer || place).trim();
          if (!prompt || !answer) {
            failures.push(`${startLabel(point)} · ${waveId}: needs riddle text + answer`);
            continue;
          }
          variantsPayload.push({
            startCode: code,
            waveId,
            localTeamNumber: slot.localTeamNumber,
            prompt,
            answer,
            hintText: content.hintText,
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
          `Saved ${saved} Clue 3 riddles in one request · bound ${bound} teams.`,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Blue · riddle first, then scan CP3
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · ~{teamsPerStation} teams each
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= teamCapacity
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{teamCapacity}
        </span>
      </div>

      <p className="text-xs text-white/50">
        After green SECOND SCAN + team code, teams get this Caesar riddle on their phone.
        Decoding it reveals the third place — then they scan the shared blue QR and enter
        their team code to unlock the prop hunt.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {arrivalPlan.map((place) => {
          const content = packContent[place.code] || routeClueDefaults(3, place.name);
          return (
            <div
              key={place.code}
              className={`rounded-xl border px-3 py-3 ${THEME.borderClass} bg-black/20`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-white">{place.name}</p>
                <p className={`text-xs font-semibold ${THEME.textClass}`}>
                  {place.teamCount} teams
                </p>
              </div>
              <p className="mt-1 text-[11px] text-white/45">
                {place.arrivals.map((a) => `T${a.teamNumber}`).join(' · ')}
              </p>
              <label className="mt-2 block text-xs text-white/55">
                Riddle prompt
                <textarea
                  value={content.prompt || ''}
                  onChange={(e) => setPackContent((prev) => ({
                    ...prev,
                    [place.code]: { ...content, prompt: e.target.value },
                  }))}
                  className={`mt-1 min-h-20 ${inputClass}`}
                />
              </label>
              <label className="mt-2 block text-xs text-white/55">
                Answer (decoded word / place)
                <input
                  value={content.answer || ''}
                  onChange={(e) => setPackContent((prev) => ({
                    ...prev,
                    [place.code]: { ...content, answer: e.target.value },
                  }))}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !roundId || orderedPoints.length < 1}
          onClick={saveAll}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
        >
          {busy ? 'Saving…' : `Save Clue 3 · bind ${teamCapacity} teams`}
        </button>
      </div>
      {message && <p className={`text-xs ${THEME.textClass}`}>{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
