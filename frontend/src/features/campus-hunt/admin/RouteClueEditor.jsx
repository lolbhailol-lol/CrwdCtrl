import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminUpsertChallenge,
} from '../services/campusHunt.api';
import { syncAfterClueSave } from './clueSaveSync';
import {
  CAMPUS_STARTS,
  buildTeamSlots,
  clue5WordForStart,
  destinationForClue,
  deriveClueGeometry,
  fourthStopArrivalPlan,
  fourthStopForLocalTeam,
  globalTeamNumber,
  propCodeForTeam,
  resolveStations,
  resolveStarts,
  routeClueDefaults,
  secondStopArrivalPlan,
  secondStopForLocalTeam,
  waitIndexForStart,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const TYPE_BY_NUMBER = {
  2: 'timed_search',
  3: 'decode',
  4: 'timed_search',
  5: 'collaborative',
};

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function routeKey(route) {
  return String(route?.routeKey || '').toUpperCase().trim();
}

function variantKeyFor(code, waveId) {
  return `${code}-${waveId}`.toUpperCase();
}

function resolveFourthCheckpoint(checkpoints, { placeName, stationCode }) {
  const code = String(stationCode || '').toUpperCase().trim();
  if (code) {
    const sharedCode = `ST-${code}-4`;
    const byCode = checkpoints.find((cp) => (
      String(cp.code || '').toUpperCase() === sharedCode
      && cp.active !== false
    ));
    if (byCode) return byCode;
  }
  if (placeName) {
    const byPlace = checkpoints.find((cp) => (
      String(cp.progressionKey || '') === '4'
      && String(cp.locationName || '').toLowerCase() === String(placeName).toLowerCase()
      && cp.active !== false
    ));
    if (byPlace) return byPlace;
  }
  return checkpoints.find((cp) => (
    String(cp.progressionKey || '') === '4'
    && cp.active !== false
    && String(cp.stationCode || '').toUpperCase() === code
  )) || null;
}

function pathLabel(route, starts = CAMPUS_STARTS) {
  const key = routeKey(route);
  const start = starts.find((item) => item.code === key)
    || CAMPUS_STARTS.find((item) => item.code === key);
  return start ? `Start ${start.name}` : (route?.name || `Path ${key}`);
}

function blankForm(number, takesTo, teamSize = 4) {
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));
  const defaults = routeClueDefaults(number, takesTo, people);
  return {
    prompt: defaults.prompt,
    answer: number === 2 || number === 4
      ? ''
      : (defaults.answer || takesTo || ''),
    hintText: defaults.hintText || '',
    destinationInstruction: defaults.destinationInstruction
      || (takesTo
        ? `Go to ${takesTo}. Find the shared QR. All ${people} scan, then enter your team code.`
        : ''),
    basePoints: number === 3 || number === 5 ? 50 : 0,
    maxAttempts: 3,
    timerSeconds: number === 2 || number === 4 ? 180 : number === 5 ? 300 : 0,
    hintCost: 15,
    memberPrompts: defaults.memberPrompts || Array.from({ length: people }, () => ''),
    active: true,
  };
}

function isGenericRoutePrompt(prompt, number) {
  const text = String(prompt || '').trim();
  if (!text) return true;
  if (/^Solve this to learn where/i.test(text)) return true;
  if (/^Clue 2 — find the marked code/i.test(text)) return true;
  if (/^Clue 3 at .+ — decode the Caesar/i.test(text)) return true;
  if (/^CRAZY PROP HUNT at /i.test(text)) return true;
  if (/^Final clue at .+ — combine all \d+ pieces/i.test(text)) return true;
  if (number === 5 && /^Combine all \d+ pieces/i.test(text)) return true;
  if (number === 5 && /^Each teammate has a code fragment/i.test(text)) return true;
  return false;
}

/**
 * Edit Clue 2 / 3 / 4 (prop) / Final for each start path — shows where that path takes you.
 */
export default function RouteClueEditor({
  eventId,
  roundId,
  challengeNumber,
  clueLabel = `Clue ${challengeNumber}`,
  campusStations,
  campusStarts,
  onChanged,
  stationCount = null,
  teamCapacity = 40,
  teamSize = 4,
  teamsPerWait,
  teamsPerStation,
}) {
  const number = Number(challengeNumber);
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));
  const geometry = useMemo(
    () => deriveClueGeometry(teamCapacity, teamSize),
    [teamCapacity, teamSize],
  );
  const perWait = Math.max(1, Number(teamsPerWait) || geometry.teamsPerWait);
  const perStation = Math.max(1, Number(teamsPerStation) || geometry.teamsPerStation);
  const teamSlots = useMemo(() => buildTeamSlots(perWait), [perWait]);
  const stations = useMemo(
    () => resolveStations(campusStations, stationCount),
    [campusStations, stationCount],
  );
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const activeStartCodes = useMemo(
    () => new Set(starts.map((s) => String(s.code || '').toUpperCase())),
    [starts],
  );
  const [routes, setRoutes] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [startingPoints, setStartingPoints] = useState([]);
  const [propCodes, setPropCodes] = useState({});
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => blankForm(
    number,
    number === 5 ? clue5WordForStart('A') : destinationForClue('A', number, 1, stations, starts),
    people,
  ));

  const orderedRoutes = useMemo(() => {
    const order = starts.map((s) => s.code);
    return [...routes]
      .filter((route) => (
        !activeStartCodes.size || activeStartCodes.has(routeKey(route))
      ))
      .filter((route) => route.active !== false)
      .sort((a, b) => order.indexOf(routeKey(a)) - order.indexOf(routeKey(b)));
  }, [routes, starts, activeStartCodes]);

  const selectedRoute = orderedRoutes.find((route) => id(route) === selectedRouteId);
  const selectedWait = selectedRoute ? waitIndexForStart(routeKey(selectedRoute)) : 0;
  const takesTo = selectedRoute
    ? destinationForClue(routeKey(selectedRoute), number, 1, stations, starts)
    : destinationForClue('A', number, 1, stations, starts);
  const clue5Word = selectedRoute
    ? clue5WordForStart(routeKey(selectedRoute))
    : clue5WordForStart('A');
  const editorDestination = number === 5 ? clue5Word : takesTo;

  const arrivalPlan = useMemo(
    () => {
      if (number === 2) return secondStopArrivalPlan(stations, perWait, starts);
      if (number === 4) return fourthStopArrivalPlan(stations, perWait, starts);
      return [];
    },
    [number, stations, perWait, starts],
  );

  const returnPlan = useMemo(() => {
    if (number !== 5) return [];
    return starts.map((start) => {
      const waitIndex = waitIndexForStart(start.code);
      return {
        code: start.code,
        name: start.name,
        word: clue5WordForStart(start.code),
        teamCount: perWait,
        arrivals: teamSlots.map((slot) => ({
          teamNumber: globalTeamNumber(waitIndex, slot.localTeamNumber, perWait),
          localTeamNumber: slot.localTeamNumber,
        })),
      };
    });
  }, [number, starts, perWait, teamSlots]);

  const startTeamRows = useMemo(() => {
    if ((number !== 2 && number !== 4) || !selectedRoute) return [];
    return teamSlots.map((slot) => {
      const teamNumber = globalTeamNumber(selectedWait, slot.localTeamNumber, perWait);
      const place = number === 4
        ? fourthStopForLocalTeam(slot.localTeamNumber, selectedWait, stations)
        : secondStopForLocalTeam(slot.localTeamNumber, selectedWait, stations);
      return { ...slot, teamNumber, place };
    });
  }, [number, selectedRoute, selectedWait, stations, teamSlots, perWait]);

  const refresh = useCallback(async () => {
    const [routeResult, challengeResult, checkpointResult, pointResult] = await Promise.all([
      adminListRoutes(eventId),
      adminListChallenges(eventId),
      adminListCheckpoints(eventId),
      adminListStartingPoints(eventId),
    ]);
    const routeList = routeResult.data?.routes || [];
    setRoutes(routeList);
    setCheckpoints(checkpointResult.data?.checkpoints || []);
    setStartingPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    const list = (challengeResult.data?.challenges || []).filter(
      (challenge) => Number(challenge.challengeNumber) === number,
    );
    setChallenges(list);
    if (!selectedRouteId && routeList[0]) {
      const order = starts.map((s) => s.code);
      const sorted = [...routeList]
        .filter((route) => (
          !activeStartCodes.size || activeStartCodes.has(routeKey(route))
        ))
        .filter((route) => route.active !== false)
        .sort((a, b) => order.indexOf(routeKey(a)) - order.indexOf(routeKey(b)));
      if (sorted[0]) setSelectedRouteId(id(sorted[0]));
    }
  }, [eventId, number, selectedRouteId, starts, activeStartCodes]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  useEffect(() => {
    if (!selectedRouteId || number !== 4 || !selectedRoute) return;
    const code = routeKey(selectedRoute);
    const next = {};
    teamSlots.forEach((slot) => {
      const key = `${code}-${slot.id}`;
      const vk = variantKeyFor(code, slot.id);
      const existing = challenges.find((row) => (
        id(row.routeId) === selectedRouteId
        && String(row.variantKey || '').toUpperCase() === vk
      ));
      const place = fourthStopForLocalTeam(slot.localTeamNumber, selectedWait, stations);
      const stationIndex = stations.findIndex((s) => s.name === place);
      next[key] = existing?.answer || propCodeForTeam(stationIndex, slot.localTeamNumber);
    });
    setPropCodes(next);
  }, [selectedRouteId, selectedRoute, challenges, number, teamSlots, selectedWait, stations]);

  useEffect(() => {
    if (!selectedRouteId) return;
    const routeVariants = challenges.filter((row) => (
      id(row.routeId) === selectedRouteId
      && String(row.variantKey || '').toUpperCase() !== 'DEFAULT'
    ));
    const existing = routeVariants[0] || challenges.find(
      (challenge) => id(challenge.routeId) === selectedRouteId,
    );
    const place = editorDestination;
    if (!existing || isGenericRoutePrompt(existing.prompt, number)) {
      const blank = blankForm(number, place, people);
      if (number === 5) {
        blank.destinationInstruction =
          `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`;
        blank.basePoints = 50;
      }
      setForm(blank);
      return;
    }
    const defaults = routeClueDefaults(number, place, people);
    const memberPrompts = Array.from({ length: people }, (_, i) => (
      existing.memberPrompts?.[i] || defaults.memberPrompts?.[i] || ''
    ));
    const membersEmpty = memberPrompts.every((p) => !String(p).trim());
    setForm({
      prompt: existing.prompt || defaults.prompt,
      answer: existing.answer || (number === 2 || number === 4 ? '' : place),
      hintText: existing.hintText || defaults.hintText || '',
      destinationInstruction:
        existing.destinationInstruction
        || (number === 2
          ? (
            'Go to your next location now. Find the shared green SECOND SCAN QR — '
            + `all ${people} members scan, then enter your team code to unlock Clue 3.`
          )
          : number === 3
            ? (
              defaults.destinationInstruction
              || 'Riddle solved — go find the shared blue THIRD SCAN QR at that place. '
                + `All ${people} members scan, then enter your team code to unlock the prop hunt.`
            )
          : number === 4
            ? (
              defaults.destinationInstruction
              || `Prop found — stay at ${place}. Find the shared purple FOURTH SCAN QR. `
                + `All ${people} members scan, then enter your team code to unlock Final.`
            )
          : number === 5
            ? `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`
            : defaults.destinationInstruction
              || `Go to ${place}. Find the shared QR. All ${people} scan, then enter your team code.`),
      basePoints: existing.basePoints ?? (number === 3 || number === 5 ? 50 : 0),
      maxAttempts: existing.maxAttempts ?? 3,
      timerSeconds: existing.timerSeconds
        ?? (number === 2 || number === 4 ? 180 : number === 5 ? 300 : 0),
      hintCost: existing.hintCost ?? 15,
      memberPrompts: number === 5 && membersEmpty
        ? (defaults.memberPrompts || memberPrompts)
        : memberPrompts,
      active: existing.active !== false,
    });
  }, [selectedRouteId, challenges, number, editorDestination, takesTo, people]);

  const save = async (event) => {
    event.preventDefault();
    if (!roundId || !selectedRouteId) {
      setMessage('Pick a starting point path first');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const routeCode = routeKey(selectedRoute);
      const startingPoint = startingPoints.find(
        (point) => String(point.code || '').toUpperCase() === routeCode,
      );

      if (number === 4) {
        const prompt = form.prompt.trim();
        if (!prompt) {
          setMessage('Enter clue text for the prop hunt');
          setBusy(false);
          return;
        }
        let saved = 0;
        const failures = [];
        for (const slot of teamSlots) {
          const vk = variantKeyFor(routeCode, slot.id);
          const codeKey = `${routeCode}-${slot.id}`;
          const place = fourthStopForLocalTeam(slot.localTeamNumber, selectedWait, stations);
          const station = stations.find((s) => s.name === place);
          const answer = String(propCodes[codeKey] || form.answer || '').trim().toUpperCase();
          if (!answer) {
            failures.push(`Team ${globalTeamNumber(selectedWait, slot.localTeamNumber, perWait)}: prop code required`);
            continue;
          }
          const fourthCp = resolveFourthCheckpoint(checkpoints, {
            placeName: place,
            stationCode: station?.code,
          });
          if (!fourthCp) {
            failures.push(`${place}: no purple FOURTH SCAN QR — Update Clue 4 for this setup first`);
            continue;
          }
          await adminUpsertChallenge(eventId, {
            roundId,
            routeId: selectedRouteId,
            challengeNumber: 4,
            type: 'timed_search',
            variantKey: vk,
            startingPointId: id(startingPoint),
            fourthCheckpointId: id(fourthCp),
            prompt,
            answer,
            acceptedAnswers: [answer, answer.toLowerCase()],
            hintText: form.hintText.trim(),
            destinationInstruction: (
              form.destinationInstruction
              || `Prop found — stay at ${place}. Find the shared purple FOURTH SCAN QR. `
                + `All ${people} members scan, then enter your team code to unlock Final.`
            ).trim(),
            basePoints: Number(form.basePoints) || 0,
            maxAttempts: Number(form.maxAttempts) || 3,
            timerSeconds: Number(form.timerSeconds) || 180,
            hintCost: Number(form.hintCost) || 15,
            active: form.active,
          });
          saved += 1;
        }
        if (!saved) {
          setMessage(failures[0] || 'Could not save Clue 4');
          setBusy(false);
          return;
        }
        const sync = await syncAfterClueSave(eventId, { roundId });
        const bound = sync?.data?.updated ?? sync?.data?.teamsUpdated ?? 0;
        setMessage(
          `Saved ${saved} prop codes · ${pathLabel(selectedRoute, starts)} · bound ${bound} teams`
          + (failures.length ? ` (${failures.length} skipped)` : ''),
        );
        await refresh();
        onChanged?.();
        setBusy(false);
        return;
      }

      const answer = (form.answer || editorDestination).trim();
      if (!answer) {
        setMessage(
          number === 5
            ? `Enter the Final word (usually ${clue5Word})`
            : 'Enter the answer',
        );
        setBusy(false);
        return;
      }
      const body = {
        roundId,
        routeId: selectedRouteId,
        challengeNumber: number,
        type: TYPE_BY_NUMBER[number] || 'navigation',
        variantKey: 'DEFAULT',
        prompt: form.prompt.trim(),
        answer,
        acceptedAnswers: [answer].filter(Boolean),
        hintText: form.hintText.trim(),
        destinationInstruction: (
          form.destinationInstruction
          || (number === 5
            ? `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`
            : `Go to ${takesTo}. All ${people} members scan there.`)
        ).trim(),
        basePoints: Number(form.basePoints) || 0,
        maxAttempts: Number(form.maxAttempts) || 3,
        timerSeconds: Number(form.timerSeconds) || 0,
        hintCost: Number(form.hintCost) || 15,
        active: form.active,
      };
      if (number === 5) {
        body.memberPrompts = (form.memberPrompts || [])
          .slice(0, people)
          .map((value) => String(value || '').trim());
        while (body.memberPrompts.length < people) body.memberPrompts.push('');
        body.prompt = body.prompt
          || `Combine all ${people} pieces to form the answer.`;
        body.startingPointId = id(startingPoint);
      }
      await adminUpsertChallenge(eventId, body);
      setMessage(
        number === 5
          ? `Saved · ${pathLabel(selectedRoute, starts)} word ${clue5Word} → return ${takesTo}`
          : `Saved · ${pathLabel(selectedRoute, starts)} → ${takesTo}`,
      );
      await refresh();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Could not save clue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{clueLabel}</h2>
          {number === 2 ? (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                {stations.length} places · ~{perStation} teams each
              </p>
              <p className="mt-1 text-xs text-white/50">
                After Clue 1 scans unlock Clue 2. Leader solves the timed code, then each team
                goes to their second campus place (next stop after first scan).
              </p>
            </>
          ) : number === 4 ? (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                {stations.length} places · crazy prop hunt · ~{perStation} teams each
              </p>
              <p className="mt-1 text-xs text-white/50">
                Timed search for a planted prop code at the fourth campus stop, then purple QR.
              </p>
            </>
          ) : number === 5 ? (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                One word · <span className="font-bold">{clue5Word}</span>
                {' '}→ return to <span className="font-bold">{takesTo}</span>
                {selectedRoute ? ` (${pathLabel(selectedRoute, starts)})` : ''}
              </p>
              <p className="mt-1 text-xs text-white/50">
                All {people} get code fragments. After the word, ~{perWait} teams come back to this
                start — organizer marks each team number reached.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                Takes you to · <span className="font-bold">{takesTo}</span>
                {selectedRoute ? ` (${pathLabel(selectedRoute, starts)})` : ''}
              </p>
              <p className="mt-1 text-xs text-white/50">
                Write the clue for this start path. After they solve, they go to {takesTo} and scan.
              </p>
            </>
          )}
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
          {number === 2 || number === 4
            ? `${challenges.length}/${orderedRoutes.length || starts.length || 1} start clues`
            : `${challenges.length}/${orderedRoutes.length || starts.length || 1} paths ready`}
        </span>
      </div>

      {(number === 2 || number === 4) && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">
            Who goes where · {number === 4 ? 'fourth stop' : 'second stop'}
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Same fan-out as Clue 1: each place gets ~{perStation} teams
            ({number === 4 ? 'three' : 'one'} station{number === 4 ? 's' : ''} after their first stop).
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
      )}

      {number === 5 && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Who returns where · Final</h3>
          <p className="mt-1 text-xs text-white/50">
            After Clue 5 / the one-word Final, teams report back to their own start
            ({starts.length} active). Mark them on Live → Finish desk.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {returnPlan.map((place) => (
              <div
                key={place.code}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{place.name}</p>
                  <p className="text-xs font-semibold text-[#0ECCEE]">
                    {place.word} · {place.teamCount} teams
                  </p>
                </div>
                <p className="mt-2 text-[11px] text-white/45">
                  Teams {place.arrivals.map((a) => a.teamNumber).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {orderedRoutes.map((route) => {
          const routeVariants = challenges.filter((challenge) => (
            id(challenge.routeId) === id(route)
            && String(challenge.variantKey || '').toUpperCase() !== 'DEFAULT'
          ));
          const configured = number === 4
            ? routeVariants.length >= teamSlots.length
            : challenges.some((challenge) => id(challenge.routeId) === id(route));
          const active = selectedRouteId === id(route);
          const wait = waitIndexForStart(routeKey(route));
          const from = globalTeamNumber(wait, 1, perWait);
          const to = globalTeamNumber(wait, perWait, perWait);
          const dest = number === 2 || number === 4
            ? `Teams ${from}–${to}`
            : number === 5
              ? `${clue5WordForStart(routeKey(route))} → ${destinationForClue(routeKey(route), 5, 1, stations, starts)}`
              : destinationForClue(routeKey(route), number, 1, stations, starts);
          return (
            <button
              key={id(route)}
              type="button"
              onClick={() => setSelectedRouteId(id(route))}
              className={`rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                active
                  ? 'bg-[#0ECCEE] text-black'
                  : configured
                    ? 'bg-emerald-500/15 text-emerald-100'
                    : 'bg-white/10 text-white/70'
              }`}
            >
              <span className="block">{pathLabel(route, starts)}{configured ? ' ✓' : ''}</span>
              <span className={`block text-[10px] font-normal ${active ? 'text-black/70' : 'text-white/45'}`}>
                {number === 2 || number === 4 ? dest : `→ ${dest}`}
              </span>
            </button>
          );
        })}
        {!orderedRoutes.length && (
          <p className="text-xs text-amber-200">
            No starting point paths yet — Save setup with at least 1 start, then Update Clue {number}.
          </p>
        )}
      </div>

      {(number === 2 || number === 4) && selectedRoute && startTeamRows.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="mb-2 text-xs text-white/45">
            Starting at{' '}
            <span className="font-semibold text-[#0ECCEE]">
              {starts[selectedWait]?.name || CAMPUS_STARTS[selectedWait]?.name || pathLabel(selectedRoute, starts)}
            </span>
            {' '}— {number === 4 ? 'fourth' : 'second'} stops
            {number === 4 ? ' · prop codes' : ''}:
          </p>
          <div className="space-y-1">
            {startTeamRows.map((row) => {
              const codeKey = `${routeKey(selectedRoute)}-${row.id}`;
              return (
              <div
                key={`${routeKey(selectedRoute)}-${row.id}`}
                className="flex flex-wrap items-center gap-2 border-t border-white/5 py-2 first:border-0"
              >
                <p className="w-20 shrink-0 text-sm font-semibold text-white">
                  Team {row.teamNumber}
                </p>
                <p className="min-w-0 flex-1 text-sm text-white/70">
                  → <span className="font-semibold text-[#0ECCEE]">{row.place}</span>
                </p>
                {number === 4 && (
                  <input
                    value={propCodes[codeKey] || ''}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase().replace(/\s+/g, '');
                      setPropCodes((prev) => ({ ...prev, [codeKey]: value }));
                    }}
                    aria-label={`Prop code for team ${row.teamNumber}`}
                    className={`w-24 ${inputClass} py-1.5 text-center font-mono tracking-wider`}
                    placeholder="WOOF"
                  />
                )}
              </div>
              );
            })}
          </div>
        </section>
      )}

      {selectedRoute && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="rounded-lg border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-3 py-2 text-sm">
            {number === 2 ? (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute, starts)} · timed Clue 2 (3-digit code)
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Same clue text for Teams {globalTeamNumber(selectedWait, 1, perWait)}–
                  {globalTeamNumber(selectedWait, perWait, perWait)}. After they solve, each team
                  goes to their second stop above (not a starting point).
                </p>
              </>
            ) : number === 4 ? (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute, starts)} · crazy prop hunt → {takesTo}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Timed prop code for Teams {globalTeamNumber(selectedWait, 1, perWait)}–
                  {globalTeamNumber(selectedWait, perWait, perWait)}. Then purple FOURTH SCAN.
                </p>
              </>
            ) : number === 5 ? (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute, starts)} · Final word {clue5Word} → return {takesTo}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  {people} code fragments (one per teammate). After the word, teams report to this start.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute, starts)} · Clue {number} campus stop → {takesTo}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Destination is a hunt station, not a starting point.
                </p>
              </>
            )}
          </div>

          {number !== 5 && (
            <label className="block text-xs text-white/55">
              Clue the leader sees
              <textarea
                required
                value={form.prompt}
                onChange={(event) => setForm((value) => ({ ...value, prompt: event.target.value }))}
                className={`mt-1 min-h-24 ${inputClass}`}
                placeholder={
                  number === 4
                    ? 'CRAZY PROP HUNT — find the planted prop code…'
                    : `Clue that leads toward ${takesTo}`
                }
              />
            </label>
          )}
          {number === 5 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {form.memberPrompts.map((prompt, index) => (
                <label key={index} className="block text-xs text-white/55">
                  Piece {index + 1} {index === 0 ? '(leader)' : `(member ${index})`}
                  <input
                    value={prompt}
                    onChange={(event) => {
                      const next = [...form.memberPrompts];
                      next[index] = event.target.value;
                      setForm((value) => ({ ...value, memberPrompts: next }));
                    }}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              ))}
            </div>
          )}
          {number !== 4 && (
          <label className="block text-xs text-white/55">
            {number === 5
              ? `Correct word (usually ${clue5Word})`
              : `Correct answer (usually ${editorDestination})`}
            <input
              required
              value={form.answer}
              onChange={(event) => setForm((value) => ({ ...value, answer: event.target.value }))}
              className={`mt-1 ${inputClass}`}
              placeholder={
                number === 5
                  ? clue5Word
                  : editorDestination
              }
              inputMode="text"
            />
          </label>
          )}
          {number === 4 && (
            <p className="text-[11px] text-white/45">
              Set each team&apos;s prop sticker code in the board above (e.g. WOOF, NEON).
            </p>
          )}
          <label className="block text-xs text-white/55">
            After they solve — go where?
            <input
              value={form.destinationInstruction}
              onChange={(event) => setForm((value) => ({
                ...value,
                destinationInstruction: event.target.value,
              }))}
              placeholder={
                number === 4
                  ? `Stay at your fourth stop. Find the shared purple FOURTH SCAN QR.`
                  : number === 5
                    ? `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`
                    : `Go to ${takesTo}. All ${people} members scan there.`
              }
              className={`mt-1 ${inputClass}`}
            />
            {(number === 4) && (
              <span className="mt-1 block text-[11px] text-white/40">
                Team-specific place is shown in the board above (shared purple QR each).
              </span>
            )}
          </label>
          <label className="block text-xs text-white/55">
            Hint (optional)
            <input
              value={form.hintText}
              onChange={(event) => setForm((value) => ({ ...value, hintText: event.target.value }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-white/55">
              Max attempts
              <input
                type="number"
                min="1"
                value={form.maxAttempts}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  maxAttempts: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs text-white/55">
              {number === 4 ? 'Solve timer (sec)' : 'Timer (sec)'}
              <input
                type="number"
                min="0"
                value={form.timerSeconds}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  timerSeconds: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
              {number === 4 && (
                <span className="mt-1 block text-[11px] text-white/40">
                  Players get a short read window, then this timer starts (default 180 = 3:00).
                </span>
              )}
            </label>
            <label className="block text-xs text-white/55">
              Hint cost
              <input
                type="number"
                min="0"
                value={form.hintCost}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  hintCost: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !selectedRouteId}
            className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {busy
              ? 'Saving…'
              : number === 4
                ? `Save · ${pathLabel(selectedRoute, starts)} prop hunt (${teamSlots.length} teams)`
                : number === 5
                  ? `Save · ${clue5Word} → return ${takesTo}`
                  : `Save · → ${takesTo}`}
          </button>
        </form>
      )}

      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
    </section>
  );
}
