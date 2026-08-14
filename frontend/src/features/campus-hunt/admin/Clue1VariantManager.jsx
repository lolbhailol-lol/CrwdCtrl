import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminBulkSaveClue1,
} from '../services/campusHunt.api';
import {
  CAMPUS_STARTS,
  TARGET_TEAMS_PER_STATION,
  clue1ForPlace,
  TEAMS_PER_WAIT,
  buildCampusStarts,
  buildTeamSlots,
  firstStopArrivalPlan,
  firstStopForLocalTeam,
  globalTeamNumber,
  resolveStations,
  resolveStarts,
  waitIndexForStart,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

function buildCluePacks(stations, stationCount = null) {
  return resolveStations(stations, stationCount).map((station, index) => ({
    id: `pack-${station.code}`,
    index,
    title: station.name,
    place: station.name,
    code: station.code,
  }));
}

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function startCode(pointOrCode) {
  const raw = typeof pointOrCode === 'string'
    ? pointOrCode
    : String(pointOrCode?.code || pointOrCode?.routeKey || '');
  const upper = raw.toUpperCase().trim();
  if (!upper) {
    const byName = typeof pointOrCode === 'object'
      ? CAMPUS_STARTS.find((s) => (
        s.name.toLowerCase() === String(pointOrCode?.name || '').toLowerCase()
      ))
      : null;
    return byName?.code || '';
  }
  if (/^[A-D]$/.test(upper)) return upper;
  const stripped = upper.replace(/^START[-_\s]?/, '');
  if (/^[A-D]$/.test(stripped)) return stripped;
  const match = stripped.match(/^([A-D])/);
  if (match) return match[1];
  const byName = CAMPUS_STARTS.find((s) => s.name.toLowerCase() === String(
    typeof pointOrCode === 'object' ? pointOrCode?.name || '' : '',
  ).toLowerCase());
  return byName?.code || upper.charAt(0);
}

function campusStart(point) {
  return CAMPUS_STARTS.find((start) => start.code === startCode(point)) || null;
}

function startLabel(point) {
  return campusStart(point)?.name || point?.name || startCode(point) || 'Starting point';
}

function routeForStart(routes, point) {
  const code = startCode(point);
  return routes.find((route) => String(route.routeKey || '').toUpperCase() === code)
    || routes.find((route) => startCode(route) === code)
    || null;
}

function variantKeyFor(code, waveId) {
  return `${code}-${waveId}`;
}

function packForPlace(place, packs) {
  const list = packs?.length ? packs : [];
  const needle = String(place || '').toLowerCase().trim();
  return list.find((pack) => pack.place.toLowerCase() === needle) || list[0];
}

function packFromVariant(variant, packs) {
  const list = packs?.length ? packs : [];
  const answer = String(variant?.answer || '').toLowerCase().trim();
  const dest = String(variant?.destinationInstruction || '').toLowerCase();
  const byAnswer = list.find((pack) => pack.place.toLowerCase() === answer);
  if (byAnswer) return byAnswer;
  return list.find((pack) => dest.includes(pack.place.toLowerCase())) || null;
}

function findVariant(variants, code, waveId, startingPointId) {
  const key = variantKeyFor(code, waveId).toUpperCase();
  return variants.find((variant) => (
    String(variant.variantKey || '').toUpperCase() === key
    && (
      !startingPointId
      || !variant.startingPointId
      || id(variant.startingPointId) === id(startingPointId)
    )
  )) || null;
}

function resolveFirstCheckpoint(checkpoints, {
  routeId,
  waveId,
  startingPointId,
  placeName,
}) {
  const key = `1-${waveId}`.toUpperCase();
  const onRoute = checkpoints.filter((cp) => id(cp.routeId) === id(routeId));
  const byStart = onRoute.find(
    (cp) => String(cp.checkpointKey) === key && id(cp.startingPointId) === id(startingPointId),
  );
  if (byStart) return byStart;
  const byWave = onRoute.find((cp) => String(cp.checkpointKey) === key);
  if (byWave) return byWave;
  if (placeName) {
    const byPlace = onRoute.find(
      (cp) => String(cp.locationName || '').toLowerCase() === placeName.toLowerCase(),
    );
    if (byPlace) return byPlace;
  }
  return onRoute.find(
    (cp) => String(cp.checkpointKey || '').includes(waveId),
  ) || null;
}

function expectedFirstStop(point, waveIndex, stations, teamsPerWait = TEAMS_PER_WAIT, starts = CAMPUS_STARTS) {
  const waitIndex = waitIndexForStart(startCode(point));
  const startRows = buildCampusStarts(stations, teamsPerWait, starts);
  const start = startRows.find((item) => item.code === startCode(point));
  return firstStopForLocalTeam(waveIndex + 1, waitIndex, stations)
    || start?.firstStops?.[waveIndex]
    || '';
}

function blankPackContent(place, teamSize = 4) {
  const real = clue1ForPlace(place, teamSize);
  return {
    prompt: real.prompt,
    answer: real.answer,
    destinationInstruction: real.destinationInstruction,
  };
}

function isGenericCluePrompt(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return true;
  if (/^Waiting at\s+/i.test(text)) return true;
  if (/^Look around\. Something here points/i.test(text)) return true;
  if (/Your first stop is\s+/i.test(text)) return true;
  return false;
}

function stripWaitBoilerplate(prompt, place) {
  let text = String(prompt || '').trim();
  text = text.replace(/^Waiting at\s+[^.]+?\.\s*/i, '');
  text = text.replace(/^Your first stop is\s+[^.]+?\.\s*/i, '');
  text = text.replace(/\s*\(teams?\s+[^)]+\)\.?/gi, '');
  text = text.trim();
  if (!text || isGenericCluePrompt(text)) return blankPackContent(place).prompt;
  return text;
}

function uniqueStarts(points, allowedStarts = null) {
  const order = (Array.isArray(allowedStarts) && allowedStarts.length
    ? allowedStarts.map((s) => String(s.code || '').toUpperCase().charAt(0))
    : CAMPUS_STARTS.map((s) => s.code)
  ).filter(Boolean);
  const nameByCode = new Map(
    (Array.isArray(allowedStarts) ? allowedStarts : CAMPUS_STARTS).map((s) => [
      String(s.code || '').toUpperCase().charAt(0),
      s.name,
    ]),
  );
  const byCode = new Map();
  points.forEach((point) => {
    let code = startCode(point);
    if (!order.includes(code)) {
      const byName = CAMPUS_STARTS.find((s) => (
        s.name.toLowerCase() === String(point?.name || '').toLowerCase()
      ));
      if (byName) code = byName.code;
    }
    if (!order.includes(code)) return;
    const existing = byCode.get(code);
    if (!existing || String(point.code || '').toUpperCase() === code) {
      byCode.set(code, {
        ...point,
        code,
        name: nameByCode.get(code)
          || CAMPUS_STARTS.find((s) => s.code === code)?.name
          || point.name,
      });
    }
  });
  return order.map((code) => byCode.get(code)).filter(Boolean);
}

/**
 * Clue 1: write 10 station clues, preview who arrives where, save.
 */
export default function Clue1VariantManager({
  eventId,
  roundId,
  onChanged,
  campusStations,
  campusStarts,
  stationCount = null,
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
  const cluePacks = useMemo(() => buildCluePacks(stations), [stations]);
  const arrivalPlan = useMemo(
    () => firstStopArrivalPlan(stations, teamsPerWait, starts),
    [stations, teamsPerWait, starts],
  );

  const [variants, setVariants] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [packContent, setPackContent] = useState(() => (
    Object.fromEntries(
      buildCluePacks(campusStations, stationCount).map((pack) => [
        pack.id,
        blankPackContent(pack.place, teamSize),
      ]),
    )
  ));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeStartCode, setActiveStartCode] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [challengeResult, routeResult, pointResult, checkpointResult] = await Promise.all([
      adminListChallenges(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId),
      adminListCheckpoints(eventId),
    ]);
    setVariants(
      (challengeResult.data?.challenges || []).filter(
        (challenge) => Number(challenge.challengeNumber) === 1,
      ),
    );
    setRoutes(routeResult.data?.routes || []);
    setPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    setCheckpoints(checkpointResult.data?.checkpoints || []);
    setReady(true);
  }, [eventId]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load clues'));
  }, [refresh]);

  const orderedPoints = useMemo(() => (
    uniqueStarts(points, starts).filter((p) => p.active !== false)
  ), [points, starts]);

  const activePoint = useMemo(
    () => orderedPoints.find((p) => startCode(p) === activeStartCode) || orderedPoints[0] || null,
    [orderedPoints, activeStartCode],
  );

  useEffect(() => {
    if (!orderedPoints.length) return;
    setActiveStartCode((prev) => {
      if (prev && orderedPoints.some((p) => startCode(p) === prev)) return prev;
      return startCode(orderedPoints[0]);
    });
  }, [orderedPoints]);

  useEffect(() => {
    if (!ready || hydrated || !orderedPoints.length) return;

    const nextPacks = Object.fromEntries(
      cluePacks.map((pack) => [pack.id, blankPackContent(pack.place, teamSize)]),
    );

    cluePacks.forEach((pack) => {
      const real = blankPackContent(pack.place, teamSize);
      const match = variants.find((v) => packFromVariant(v, cluePacks)?.id === pack.id);
      if (!match?.prompt || isGenericCluePrompt(match.prompt)) {
        nextPacks[pack.id] = real;
        return;
      }
      nextPacks[pack.id] = {
        prompt: stripWaitBoilerplate(match.prompt, pack.place),
        answer: (match.answer || pack.place).trim(),
        destinationInstruction: (
          match.destinationInstruction
          || `Go to ${pack.place}. All ${teamSize} members scan there.`
        ).trim(),
      };
    });

    setPackContent(nextPacks);
    setHydrated(true);
  }, [ready, hydrated, orderedPoints, variants, cluePacks, teamSize]);

  useEffect(() => {
    setHydrated(false);
  }, [stations, starts, teamSize]);

  const updatePack = (packId, field, value) => {
    setPackContent((prev) => ({
      ...prev,
      [packId]: { ...(prev[packId] || blankPackContent('')), [field]: value },
    }));
  };

  const savedVariantCount = useMemo(() => {
    if (!orderedPoints.length) return 0;
    let count = 0;
    orderedPoints.forEach((point) => {
      const code = startCode(point);
      teamSlots.forEach((wave) => {
        if (findVariant(variants, code, wave.id, id(point))) count += 1;
      });
    });
    return count;
  }, [orderedPoints, variants, teamSlots]);

  const expectedVariantCount = orderedPoints.length * teamSlots.length;

  const saveAll = async () => {
    if (!roundId) {
      setError('Round 1 must exist before saving clues.');
      return;
    }
    if (!orderedPoints.length) {
      setError(`Need at least 1 active starting point. Save setup (starts & places) first.`);
      return;
    }

    const emptyPack = cluePacks.find((pack) => !String(packContent[pack.id]?.prompt || '').trim());
    if (emptyPack) {
      setError(`${emptyPack.title} needs clue text before saving.`);
      return;
    }

    setBusy(true);
    setMessage('Saving all Clue 1 assignments…');
    setError('');

    try {
      const variantsPayload = [];
      const failures = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const route = routeForStart(routes, point);
        if (!route) {
          failures.push(`${startLabel(point)}: no route ${code}`);
          continue;
        }
        for (const wave of teamSlots) {
          const firstStopPlace = expectedFirstStop(
            point,
            wave.index,
            stations,
            teamsPerWait,
            starts,
          );
          const pack = packForPlace(firstStopPlace, cluePacks);
          const content = packContent[pack.id] || blankPackContent(pack.place, teamSize);
          const place = firstStopPlace || pack.place;
          const prompt = stripWaitBoilerplate(content.prompt, place);
          const answer = (content.answer || place).trim();
          if (!prompt || !answer) {
            failures.push(`${startLabel(point)} · ${wave.id}: needs clue text`);
            continue;
          }
          variantsPayload.push({
            startCode: code,
            waveId: wave.id,
            localTeamNumber: wave.localTeamNumber || wave.index + 1,
            prompt,
            answer,
            destinationInstruction: (
              content.destinationInstruction
            || `Go to ${place}. All ${teamSize} members scan there.`
              ).trim(),
            place,
            stationCode: pack.code,
            hintText: `Ask staff for the way to ${place}.`,
            routeId: id(route),
            startingPointId: id(point),
          });
        }
      }

      if (!variantsPayload.length) {
        setError(failures[0] || 'Nothing to save — Bootstrap defaults first.');
        setMessage('');
        return;
      }

      const result = await adminBulkSaveClue1(eventId, {
        roundId,
        variants: variantsPayload,
      });
      const saved = result.data?.saved ?? 0;
      const bound = result.data?.teamsUpdated ?? 0;
      const apiErrors = result.data?.errors || [];

      await refresh();
      setHydrated(false);
      onChanged?.();

      if (saved === 0) {
        setError(apiErrors[0]?.message || failures[0] || 'Clue 1 save failed');
        setMessage('');
      } else {
        setMessage(
          `Saved ${saved} Clue 1 assignments in one request · bound ${bound} teams.`
          + ' Next: Schedule → lock if needed.',
        );
        setError(failures[0] || (apiErrors[0]?.message ? `${apiErrors.length} warnings` : ''));
      }
    } catch (err) {
      setError(err.message || 'Could not save');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${
          orderedPoints.length >= 1
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Starts {orderedPoints.length}/{Math.max(1, starts.length || orderedPoints.length || 1)}
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/55">
          {stations.length} places · ~{teamsPerStation} QRs each · {teamSize}/{teamSize} scans → Clue 2
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedVariantCount >= expectedVariantCount && expectedVariantCount > 0
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedVariantCount}/{expectedVariantCount || teamCapacity}
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">1. Write clues</h2>
        <p className="mt-1 text-xs text-white/50">
          One clue per selected campus place ({stations.length}). Leader reads the clue, types the answer, then the team scans at that place.
          Answer is usually the place name.
        </p>
        <div className="mt-3 divide-y divide-white/10">
          {cluePacks.map((pack) => {
            const content = packContent[pack.id] || blankPackContent(pack.place);
            return (
              <div
                key={pack.id}
                className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_1fr_9rem]"
              >
                <div className="pt-1">
                  <p className="text-sm font-semibold text-white">{pack.title}</p>
                  <p className="text-[10px] text-white/40">~{teamsPerStation} teams</p>
                </div>
                <textarea
                  value={content.prompt}
                  onChange={(e) => updatePack(pack.id, 'prompt', e.target.value)}
                  className={`min-h-14 ${inputClass}`}
                  placeholder={`Clue for ${pack.place}`}
                  aria-label={`Clue for ${pack.place}`}
                />
                <input
                  value={content.answer}
                  onChange={(e) => updatePack(pack.id, 'answer', e.target.value)}
                  className={`${inputClass} self-start`}
                  placeholder="Answer"
                  aria-label={`Answer for ${pack.place}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">2. Assign by starting point</h2>

        {!orderedPoints.length ? (
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No starting points yet. Add them under Locations first.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Starting point">
              {orderedPoints.map((point) => {
                const code = startCode(point);
                const waitIndex = waitIndexForStart(code);
                const startName = campusStart(point)?.name || point.name || code;
                const active = (activeStartCode || startCode(orderedPoints[0])) === code;
                const startSaved = teamSlots.every((wave) => (
                  findVariant(variants, code, wave.id, id(point))
                ));
                const from = globalTeamNumber(waitIndex, 1, teamsPerWait);
                const to = globalTeamNumber(waitIndex, teamsPerWait, teamsPerWait);
                return (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveStartCode(code)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                      active
                        ? 'bg-[#0ECCEE] text-black'
                        : 'bg-white/10 text-white/70 hover:bg-white/15'
                    }`}
                  >
                    <span className="block">
                      {startName}{startSaved ? ' ✓' : ''}
                    </span>
                    <span className={`mt-0.5 block text-[10px] font-normal ${
                      active ? 'text-black/60' : 'text-white/40'
                    }`}>
                      Team {from}–{to}
                    </span>
                  </button>
                );
              })}
            </div>

            {activePoint && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-white/45">
                  Starting at{' '}
                  <span className="font-semibold text-[#0ECCEE]">
                    {campusStart(activePoint)?.name || activePoint.name}
                  </span>
                  {' '}— first stops:
                </p>
                <div className="space-y-1">
                  {teamSlots.map((slot) => {
                    const waitIndex = waitIndexForStart(startCode(activePoint));
                    const teamNumber = globalTeamNumber(waitIndex, slot.localTeamNumber, teamsPerWait);
                    const firstStop = expectedFirstStop(
                      activePoint,
                      slot.index,
                      stations,
                      teamsPerWait,
                      starts,
                    ) || '—';
                    const pack = packForPlace(firstStop, cluePacks);
                    return (
                      <div
                        key={`${startCode(activePoint)}-${slot.id}`}
                        className="flex flex-wrap items-center gap-2 border-t border-white/5 py-2 first:border-0"
                      >
                        <p className="w-20 shrink-0 text-sm font-semibold text-white">
                          Team {teamNumber}
                        </p>
                        <p className="min-w-0 flex-1 text-sm text-white/70">
                          → <span className="font-semibold text-[#0ECCEE]">{firstStop}</span>
                        </p>
                        <span className="rounded-md bg-[#0ECCEE] px-2 py-1 text-[11px] font-semibold text-black">
                          {pack.code}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">3. Who goes where</h2>
        <p className="mt-1 text-xs text-white/50">
          For each selected place: which Team (1–{teamCapacity}) arrives, and which of your{' '}
          {starts.length} start{starts.length === 1 ? '' : 's'} they left.
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
              <div className="mt-2 space-y-1.5">
                {place.arrivals.map((row) => (
                  <div
                    key={`${place.code}-${row.teamNumber}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-semibold text-white">Team {row.teamNumber}</span>
                    <span className="text-right text-white/55">
                      from <span className="text-emerald-300">{row.startingPointName || row.waitName}</span>
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
          disabled={busy || !roundId || !orderedPoints.length}
          onClick={saveAll}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save Clue 1'}
        </button>
        {!orderedPoints.length && (
          <p className="text-xs text-amber-200">Save setup with at least 1 starting point first.</p>
        )}
        {!roundId && (
          <p className="text-xs text-amber-200">Create Round 1 first.</p>
        )}
      </div>
      <p className="text-[11px] text-white/40">
        Save binds all {teamCapacity} teams across {starts.length} start(s) → {stations.length} place(s).
        Then print the {stations.length} shared Orange QR{stations.length === 1 ? '' : 's'} below.
        After {teamSize} members scan and enter the team code, Clue 2 unlocks.
      </p>
      {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
      {error && <p className="text-sm text-amber-200">{error}</p>}
    </div>
  );
}
