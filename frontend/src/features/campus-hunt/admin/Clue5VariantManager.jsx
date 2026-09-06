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
  TEAMS_PER_WAIT,
  buildTeamSlots,
  clue5WordForStart,
  globalTeamNumber,
  resolveStarts,
  routeClueDefaults,
} from './campusHuntFormat';
import { STAGE_THEMES } from '../types/stageTheme';

const THEME = STAGE_THEMES.final;
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

function blankRouteForm(code, teamSize, startName) {
  const word = clue5WordForStart(code);
  const defaults = routeClueDefaults(5, word, teamSize);
  return {
    prompt: defaults.prompt,
    answer: word,
    memberPrompts: [...(defaults.memberPrompts || [])],
    destinationInstruction:
      `Report to your start — ${startName}. Ask the organizer to mark your team reached.`,
  };
}

export default function Clue5VariantManager({
  eventId,
  roundId,
  campusStarts,
  onChanged,
  teamCapacity = 40,
  teamSize = 4,
  teamsPerWait = TEAMS_PER_WAIT,
}) {
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const teamSlots = useMemo(() => buildTeamSlots(teamsPerWait), [teamsPerWait]);
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));

  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [routeForms, setRouteForms] = useState({});
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

    const nextForms = {};
    ordered.forEach((point) => {
      const code = startCode(point);
      const route = routeForStart(routeList, point);
      const existing = list.find((row) => id(row.routeId) === id(route));
      const name = startLabel(point);
      if (existing) {
        const memberPrompts = Array.from({ length: people }, (_, i) => (
          existing.memberPrompts?.[i] || ''
        ));
        nextForms[code] = {
          prompt: existing.prompt || blankRouteForm(code, people, name).prompt,
          answer: existing.answer || clue5WordForStart(code),
          memberPrompts,
          destinationInstruction: existing.destinationInstruction
            || blankRouteForm(code, people, name).destinationInstruction,
        };
      } else {
        nextForms[code] = blankRouteForm(code, people, name);
      }
    });
    setRouteForms(nextForms);
  }, [eventId, people]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message || 'Could not load Final clue'));
  }, [refresh]);

  const updateForm = (code, patch) => {
    setRouteForms((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...patch },
    }));
  };

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
      setMessage('Saved Final clue timer & hint settings');
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save settings');
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    if (!eventId || !roundId) {
      setError('Create Round 1 first');
      return;
    }
    if (orderedPoints.length < 1) {
      setError('Need at least 1 active starting point.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Saving all Final clues…');

    try {
      const routesPayload = [];
      for (const point of orderedPoints) {
        const code = startCode(point);
        const form = routeForms[code] || blankRouteForm(code, people, startLabel(point));
        const answer = String(form.answer || clue5WordForStart(code)).trim().toUpperCase();
        if (!answer) {
          setError(`${startLabel(point)}: Final word required`);
          setMessage('');
          setBusy(false);
          return;
        }
        routesPayload.push({
          startCode: code,
          prompt: String(form.prompt || '').trim(),
          answer,
          memberPrompts: (form.memberPrompts || []).slice(0, people),
          destinationInstruction: String(form.destinationInstruction || '').trim(),
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
        setError(apiErrors[0]?.message || 'Final clue save failed');
        setMessage('');
      } else {
        setMessage(`Saved ${saved} Final clue(s) in one request · all start paths updated.`);
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Could not save Final clue');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const savedCount = challenges.filter((c) => c.active !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${THEME.bgClass} ${THEME.textClass}`}>
          Final · collaborative one-word
        </span>
        <span className={`rounded-full px-2.5 py-1 ${
          savedCount >= orderedPoints.length && orderedPoints.length > 0
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          Saved {savedCount}/{orderedPoints.length || starts.length} starts
        </span>
      </div>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <h2 className="text-base font-semibold text-white">Defaults for all teams</h2>
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

      <p className="text-xs text-white/50">
        Each start path has one Final word. All {people} teammates get code fragments on their phones.
        After the word, teams report back to their own start.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {orderedPoints.map((point) => {
          const code = startCode(point);
          const form = routeForms[code] || blankRouteForm(code, people, startLabel(point));
          const word = clue5WordForStart(code);
          const teamNums = teamSlots.map((slot) => (
            globalTeamNumber(
              CAMPUS_STARTS.findIndex((s) => s.code === code),
              slot.localTeamNumber,
              teamsPerWait,
            )
          ));
          return (
            <section
              key={code}
              className="rounded-2xl border border-white/15 bg-white/5 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-white">{startLabel(point)}</h3>
                <span className="text-xs font-semibold text-[#0ECCEE]">
                  {word} · teams {teamNums.join(', ')}
                </span>
              </div>
              <label className="mt-3 block text-xs text-white/55">
                Leader instructions
                <textarea
                  value={form.prompt}
                  onChange={(e) => updateForm(code, { prompt: e.target.value })}
                  className={`mt-1 min-h-16 ${inputClass}`}
                />
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(form.memberPrompts || []).slice(0, people).map((piece, index) => (
                  <label key={index} className="block text-xs text-white/55">
                    Piece {index + 1}
                    <input
                      value={piece}
                      onChange={(e) => {
                        const next = [...(form.memberPrompts || [])];
                        next[index] = e.target.value;
                        updateForm(code, { memberPrompts: next });
                      }}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                ))}
              </div>
              <label className="mt-2 block text-xs text-white/55">
                Correct word
                <input
                  value={form.answer}
                  onChange={(e) => updateForm(code, { answer: e.target.value.toUpperCase() })}
                  className={`mt-1 ${inputClass}`}
                  placeholder={word}
                />
              </label>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !roundId || orderedPoints.length < 1}
          onClick={saveAll}
          className="rounded-xl bg-[#0ECCEE] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : `Save Final · all ${orderedPoints.length} start paths`}
        </button>
      </div>
      {message && <p className="text-xs text-[#0ECCEE]">{message}</p>}
      {error && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  );
}
