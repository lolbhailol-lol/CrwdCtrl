import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListChallenges,
  adminListRoutes,
  adminListStartingPoints,
  adminUpdateEvent,
  adminUpsertChallenge,
} from '../services/campusHunt.api';
import {
  DESTINATION_PLACE,
  resolveStarts,
} from './campusHuntFormat';
import { STAGE_THEMES } from '../types/stageTheme';

const THEME = STAGE_THEMES.destination || STAGE_THEMES.final;
const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';
const DEFAULT_FINISH = 'MSFINISH';

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

function routeForStart(routes, point) {
  const code = startCode(point);
  return routes.find((route) => String(route.routeKey || '').toUpperCase() === code) || null;
}

/**
 * Clue 6 — MindSpark Lobby finish: teams type the organizer finish code.
 */
export default function Clue6VariantManager({
  eventId,
  roundId,
  campusStarts,
  onChanged,
  destinationName = DESTINATION_PLACE.name,
  organizerFinishCode = DEFAULT_FINISH,
}) {
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    prompt:
      `Your path is done. Go to ${destinationName} as a full team.\n`
      + 'Ask the organizer for the finish code, then type it here to lock your score.',
    answer: String(organizerFinishCode || DEFAULT_FINISH).toUpperCase(),
    destinationInstruction:
      `At ${destinationName}: ask the organizer for the finish code and type it on this phone.`,
    hintText: `Meet at ${destinationName}. The organizer will tell you the finish code.`,
  });

  const refresh = useCallback(async () => {
    const [challengeResult, routeResult, pointResult] = await Promise.all([
      adminListChallenges(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId),
    ]);
    setRoutes(routeResult.data?.routes || []);
    setPoints(pointResult.data?.startingPoints || pointResult.data?.points || []);
    const existing = (challengeResult.data?.challenges || []).find(
      (c) => Number(c.challengeNumber) === 6 && String(c.variantKey || 'DEFAULT') === 'DEFAULT',
    );
    if (existing?.prompt) {
      setForm({
        prompt: existing.prompt,
        answer: existing.answer || String(organizerFinishCode || DEFAULT_FINISH).toUpperCase(),
        destinationInstruction:
          existing.destinationInstruction
          || `At ${destinationName}: ask the organizer for the finish code and type it on this phone.`,
        hintText: existing.hintText || `Meet at ${destinationName}. The organizer will tell you the finish code.`,
      });
    }
  }, [eventId, destinationName, organizerFinishCode]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const finish = String(form.answer || DEFAULT_FINISH).trim().toUpperCase();
      await adminUpdateEvent(eventId, {
        destinationName,
        organizerFinishCode: finish,
      });

      const targets = points.length
        ? points
        : starts.map((s) => ({ code: s.code, name: s.name }));
      const base = {
        prompt: form.prompt.trim(),
        answer: finish,
        acceptedAnswers: [
          finish,
          destinationName,
          String(destinationName || '').toLowerCase(),
          'mindspark lobby',
        ].filter(Boolean),
        destinationInstruction: form.destinationInstruction.trim(),
        hintText: form.hintText.trim(),
        type: 'navigation',
        challengeNumber: 6,
        variantKey: 'DEFAULT',
        active: true,
        roundId,
      };

      await Promise.all(targets.map(async (point) => {
        const route = routeForStart(routes, point);
        if (!route) return;
        await adminUpsertChallenge(eventId, {
          ...base,
          routeId: id(route),
          startingPointId: id(point) || undefined,
        });
      }));

      // Shared DEFAULT route row (no start) when routes exist without points
      if (!targets.length && routes[0]) {
        await adminUpsertChallenge(eventId, {
          ...base,
          routeId: id(routes[0]),
        });
      }

      setMessage('Saved — teams type this finish code at MindSpark Lobby.');
      onChanged?.();
      await refresh();
    } catch (err) {
      setMessage(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-4 rounded-2xl border p-4 ${THEME.borderClass} ${THEME.bgClass}`}>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${THEME.textClass}`}>
          Clue 6 · MindSpark Lobby
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">Finish code</h3>
        <p className="mt-1 text-sm text-white/60">
          Same destination for every team after Clues 1–5.
          Tell them the finish code at the lobby — they type it to lock score.
        </p>
      </div>

      <label className="block space-y-1 text-sm text-white/70">
        Prompt
        <textarea
          rows={3}
          value={form.prompt}
          onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          className={inputClass}
        />
      </label>

      <label className="block space-y-1 text-sm text-white/70">
        Finish code (tell teams this)
        <input
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value.toUpperCase() }))}
          className={`${inputClass} font-mono tracking-wider`}
          placeholder={DEFAULT_FINISH}
        />
      </label>

      <label className="block space-y-1 text-sm text-white/70">
        After submit / desk note
        <textarea
          rows={2}
          value={form.destinationInstruction}
          onChange={(e) => setForm((f) => ({ ...f, destinationInstruction: e.target.value }))}
          className={inputClass}
        />
      </label>

      <label className="block space-y-1 text-sm text-white/70">
        Hint
        <input
          value={form.hintText}
          onChange={(e) => setForm((f) => ({ ...f, hintText: e.target.value }))}
          className={inputClass}
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => save()}
        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
      >
        {busy ? 'Saving…' : 'Save finish code'}
      </button>
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}
