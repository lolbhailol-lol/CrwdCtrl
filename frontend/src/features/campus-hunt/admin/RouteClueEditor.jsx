import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListChallenges,
  adminListRoutes,
  adminUpsertChallenge,
} from '../services/campusHunt.api';
import {
  CAMPUS_STARTS,
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  TEAM_SLOTS,
  TEAMS_PER_WAIT,
  clue4WordForStart,
  destinationForClue,
  globalTeamNumber,
  resolveStations,
  routeClueDefaults,
  secondStopArrivalPlan,
  secondStopForLocalTeam,
  waitIndexForStart,
} from './campusHuntFormat';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const TYPE_BY_NUMBER = {
  2: 'timed_search',
  3: 'decode',
  4: 'collaborative',
};

function id(value) {
  return String(value?._id || value?.id || value || '');
}

function routeKey(route) {
  return String(route?.routeKey || '').toUpperCase().trim();
}

function pathLabel(route) {
  const key = routeKey(route);
  const start = CAMPUS_STARTS.find((item) => item.code === key);
  return start ? `Start ${start.name}` : (route?.name || `Path ${key}`);
}

function blankForm(number, takesTo) {
  const defaults = routeClueDefaults(number, takesTo);
  return {
    prompt: defaults.prompt,
    answer: number === 2
      ? ''
      : (defaults.answer || takesTo || ''),
    hintText: defaults.hintText || '',
    destinationInstruction: number === 2
      ? (defaults.destinationInstruction
        || 'Go to your next location now. Find your team’s green SECOND SCAN QR — '
          + 'all 4 members scan to unlock Clue 3.')
      : (defaults.destinationInstruction
        || (takesTo ? `Go to ${takesTo}. All four members scan there.` : '')),
    basePoints: number === 2 || number === 3 || number === 4 ? 50 : 0,
    maxAttempts: 3,
    timerSeconds: number === 2 ? 180 : number === 4 ? 300 : 0,
    hintCost: 15,
    memberPrompts: defaults.memberPrompts || ['', '', '', ''],
    active: true,
  };
}

function isGenericRoutePrompt(prompt, number) {
  const text = String(prompt || '').trim();
  if (!text) return true;
  if (/^Solve this to learn where/i.test(text)) return true;
  if (/^Clue 2 — find the marked code/i.test(text)) return true;
  if (/^Clue 3 at .+ — decode the Caesar/i.test(text)) return true;
  if (/^Final clue at .+ — combine all four pieces/i.test(text)) return true;
  if (number === 4 && /^Combine all four pieces/i.test(text)) return true;
  return false;
}

/**
 * Edit Clue 2 / 3 / Final for each start path — shows where that path takes you.
 */
export default function RouteClueEditor({
  eventId,
  roundId,
  challengeNumber,
  clueLabel = `Clue ${challengeNumber}`,
  campusStations,
  onChanged,
}) {
  const number = Number(challengeNumber);
  const stations = useMemo(() => resolveStations(campusStations), [campusStations]);
  const [routes, setRoutes] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => blankForm(
    number,
    number === 4 ? clue4WordForStart('A') : destinationForClue('A', number, 1, stations),
  ));

  const orderedRoutes = useMemo(() => {
    const order = CAMPUS_STARTS.map((s) => s.code);
    return [...routes].sort(
      (a, b) => order.indexOf(routeKey(a)) - order.indexOf(routeKey(b)),
    );
  }, [routes]);

  const selectedRoute = orderedRoutes.find((route) => id(route) === selectedRouteId);
  const selectedWait = selectedRoute ? waitIndexForStart(routeKey(selectedRoute)) : 0;
  const takesTo = selectedRoute
    ? destinationForClue(routeKey(selectedRoute), number, 1, stations)
    : destinationForClue('A', number, 1, stations);
  const clue4Word = selectedRoute
    ? clue4WordForStart(routeKey(selectedRoute))
    : clue4WordForStart('A');
  const editorDestination = number === 4 ? clue4Word : takesTo;

  const arrivalPlan = useMemo(
    () => (number === 2 ? secondStopArrivalPlan(stations) : []),
    [number, stations],
  );

  const startTeamRows = useMemo(() => {
    if (number !== 2 || !selectedRoute) return [];
    return TEAM_SLOTS.map((slot) => {
      const teamNumber = globalTeamNumber(selectedWait, slot.localTeamNumber);
      const place = secondStopForLocalTeam(slot.localTeamNumber, selectedWait, stations);
      return { ...slot, teamNumber, place };
    });
  }, [number, selectedRoute, selectedWait, stations]);

  const refresh = useCallback(async () => {
    const [routeResult, challengeResult] = await Promise.all([
      adminListRoutes(eventId),
      adminListChallenges(eventId),
    ]);
    const routeList = routeResult.data?.routes || [];
    setRoutes(routeList);
    const list = (challengeResult.data?.challenges || []).filter(
      (challenge) => Number(challenge.challengeNumber) === number,
    );
    setChallenges(list);
    if (!selectedRouteId && routeList[0]) {
      const order = CAMPUS_STARTS.map((s) => s.code);
      const sorted = [...routeList].sort(
        (a, b) => order.indexOf(routeKey(a)) - order.indexOf(routeKey(b)),
      );
      setSelectedRouteId(id(sorted[0]));
    }
  }, [eventId, number, selectedRouteId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  useEffect(() => {
    if (!selectedRouteId) return;
    const existing = challenges.find(
      (challenge) => id(challenge.routeId) === selectedRouteId,
    );
    const place = editorDestination;
    if (!existing || isGenericRoutePrompt(existing.prompt, number)) {
      const blank = blankForm(number, place);
      if (number === 4) {
        blank.destinationInstruction =
          `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`;
        blank.basePoints = 50;
      }
      setForm(blank);
      return;
    }
    const defaults = routeClueDefaults(number, place);
    const memberPrompts = [
      existing.memberPrompts?.[0] || '',
      existing.memberPrompts?.[1] || '',
      existing.memberPrompts?.[2] || '',
      existing.memberPrompts?.[3] || '',
    ];
    const membersEmpty = memberPrompts.every((p) => !String(p).trim());
    setForm({
      prompt: existing.prompt || defaults.prompt,
      answer: existing.answer || (number === 2 ? '' : place),
      hintText: existing.hintText || defaults.hintText || '',
      destinationInstruction:
        existing.destinationInstruction
        || (number === 2
          ? (
            'Go to your next location now. Find your team’s green SECOND SCAN QR — '
            + 'all 4 members scan to unlock Clue 3.'
          )
          : number === 3
            ? (
              defaults.destinationInstruction
              || 'Riddle solved — go find your blue Checkpoint 3 card at that place. '
                + 'All 4 members scan to unlock Final.'
            )
          : number === 4
            ? `Report to your start — ${takesTo}. Ask the organizer to mark your team reached.`
            : defaults.destinationInstruction
              || `Go to ${place}. All four members scan there.`),
      basePoints: existing.basePoints ?? (number === 2 || number === 3 || number === 4 ? 50 : 0),
      maxAttempts: existing.maxAttempts ?? 3,
      timerSeconds: existing.timerSeconds ?? (number === 2 ? 180 : number === 4 ? 300 : 0),
      hintCost: existing.hintCost ?? 15,
      memberPrompts: number === 4 && membersEmpty
        ? (defaults.memberPrompts || memberPrompts)
        : memberPrompts,
      active: existing.active !== false,
    });
  }, [selectedRouteId, challenges, number, editorDestination, takesTo]);

  const save = async (event) => {
    event.preventDefault();
    if (!roundId || !selectedRouteId) {
      setMessage('Pick a starting point path first');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const answer = (form.answer || (number === 2 ? '' : editorDestination)).trim();
      if (!answer) {
        setMessage(number === 2 ? 'Enter the 3-digit code answer' : 'Enter the answer');
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
          || (number === 2
            ? 'Go to your next assigned campus place. All four members scan there.'
            : `Go to ${takesTo}. All four members scan there.`)
        ).trim(),
        basePoints: Number(form.basePoints) || 0,
        maxAttempts: Number(form.maxAttempts) || 3,
        timerSeconds: Number(form.timerSeconds) || 0,
        hintCost: Number(form.hintCost) || 15,
        active: form.active,
      };
      if (number === 4) {
        body.memberPrompts = form.memberPrompts.map((value) => value.trim());
        body.prompt = body.prompt || 'Combine all four pieces to form the answer.';
      }
      await adminUpsertChallenge(eventId, body);
      setMessage(
        number === 2
          ? `Saved · ${pathLabel(selectedRoute)} timed clue (${STATION_TARGET_COUNT} second stops fan out by team)`
          : number === 4
            ? `Saved · ${pathLabel(selectedRoute)} word ${clue4Word} → return ${takesTo}`
            : `Saved · ${pathLabel(selectedRoute)} → ${takesTo}`,
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
                {STATION_TARGET_COUNT} places · {TARGET_TEAMS_PER_STATION} teams each
              </p>
              <p className="mt-1 text-xs text-white/50">
                After Clue 1 scans unlock Clue 2. Leader solves the timed code, then each team
                goes to their second campus place (next stop after first scan).
              </p>
            </>
          ) : number === 4 ? (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                One word · <span className="font-bold">{clue4Word}</span>
                {' '}→ return to <span className="font-bold">{takesTo}</span>
                {selectedRoute ? ` (${pathLabel(selectedRoute)})` : ''}
              </p>
              <p className="mt-1 text-xs text-white/50">
                All 4 get code fragments. After the word, {TEAMS_PER_WAIT} teams come back to this
                start — organizer marks each team number reached.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#0ECCEE]">
                Takes you to · <span className="font-bold">{takesTo}</span>
                {selectedRoute ? ` (${pathLabel(selectedRoute)})` : ''}
              </p>
              <p className="mt-1 text-xs text-white/50">
                Write the clue for this start path. After they solve, they go to {takesTo} and scan.
              </p>
            </>
          )}
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
          {number === 2
            ? `${challenges.length}/${orderedRoutes.length || 4} start clues`
            : `${challenges.length}/${orderedRoutes.length || 4} paths ready`}
        </span>
      </div>

      {number === 2 && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Who goes where · second stop</h3>
          <p className="mt-1 text-xs text-white/50">
            Same fan-out as Clue 1: each place gets exactly {TARGET_TEAMS_PER_STATION} teams
            (one station after their first stop).
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

      <div className="flex flex-wrap gap-2">
        {orderedRoutes.map((route) => {
          const configured = challenges.some((challenge) => id(challenge.routeId) === id(route));
          const active = selectedRouteId === id(route);
          const wait = waitIndexForStart(routeKey(route));
          const from = globalTeamNumber(wait, 1);
          const to = globalTeamNumber(wait, TEAMS_PER_WAIT);
          const dest = number === 2
            ? `Teams ${from}–${to}`
            : destinationForClue(routeKey(route), number, 1, stations);
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
              <span className="block">{pathLabel(route)}{configured ? ' ✓' : ''}</span>
              <span className={`block text-[10px] font-normal ${active ? 'text-black/70' : 'text-white/45'}`}>
                {number === 2 ? dest : `→ ${dest}`}
              </span>
            </button>
          );
        })}
        {!orderedRoutes.length && (
          <p className="text-xs text-amber-200">
            No starting point paths yet — add the four starting points under Locations first.
          </p>
        )}
      </div>

      {number === 2 && selectedRoute && startTeamRows.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="mb-2 text-xs text-white/45">
            Starting at{' '}
            <span className="font-semibold text-[#0ECCEE]">
              {CAMPUS_STARTS[selectedWait]?.name || pathLabel(selectedRoute)}
            </span>
            {' '}— second stops:
          </p>
          <div className="space-y-1">
            {startTeamRows.map((row) => (
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
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedRoute && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="rounded-lg border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-3 py-2 text-sm">
            {number === 2 ? (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute)} · timed Clue 2 (3-digit code)
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Same clue text for Teams {globalTeamNumber(selectedWait, 1)}–
                  {globalTeamNumber(selectedWait, TEAMS_PER_WAIT)}. After they solve, each team
                  goes to their second stop above (not a starting point).
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[#0ECCEE]">
                  {pathLabel(selectedRoute)} · Clue {number} campus stop → {takesTo}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Destination is a hunt station, not a starting point.
                </p>
              </>
            )}
          </div>

          {number !== 4 && (
            <label className="block text-xs text-white/55">
              Clue the leader sees
              <textarea
                required
                value={form.prompt}
                onChange={(event) => setForm((value) => ({ ...value, prompt: event.target.value }))}
                className={`mt-1 min-h-24 ${inputClass}`}
                placeholder={
                  number === 2
                    ? 'Find the hidden 3-digit number…'
                    : `Clue that leads toward ${takesTo}`
                }
              />
            </label>
          )}
          {number === 4 && (
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
          <label className="block text-xs text-white/55">
            {number === 2 ? 'Correct 3-digit code' : `Correct answer (usually ${takesTo})`}
            <input
              required
              value={form.answer}
              onChange={(event) => setForm((value) => ({ ...value, answer: event.target.value }))}
              className={`mt-1 ${inputClass}`}
              placeholder={number === 2 ? 'e.g. 482' : takesTo}
              inputMode={number === 2 ? 'numeric' : 'text'}
            />
          </label>
          <label className="block text-xs text-white/55">
            After they solve — go where?
            <input
              value={form.destinationInstruction}
              onChange={(event) => setForm((value) => ({
                ...value,
                destinationInstruction: event.target.value,
              }))}
              placeholder={
                number === 2
                  ? 'Go to your next assigned campus place. All four members scan there.'
                  : `Go to ${takesTo}. All four members scan there.`
              }
              className={`mt-1 ${inputClass}`}
            />
            {number === 2 && (
              <span className="mt-1 block text-[11px] text-white/40">
                Team-specific place is shown in the boards above (10 places × 4 teams).
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
              {number === 2 ? 'Solve timer (sec)' : 'Timer (sec)'}
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
              {number === 2 && (
                <span className="mt-1 block text-[11px] text-white/40">
                  Players get 20s to read instructions, then this timer starts (default 180 = 3:00).
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
              : number === 2
                ? `Save · ${pathLabel(selectedRoute)} timed clue`
                : `Save · → ${takesTo}`}
          </button>
        </form>
      )}

      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
    </section>
  );
}
