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
 * Clue 6 — start code + finish code (lean).
 */
export default function Clue6VariantManager({
  eventId,
  roundId,
  campusStarts,
  onChanged,
  destinationName = DESTINATION_PLACE.name,
  organizerFinishCode = DEFAULT_FINISH,
  organizerStartCode = 'GO',
}) {
  const starts = useMemo(() => resolveStarts(campusStarts), [campusStarts]);
  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [startWord, setStartWord] = useState(String(organizerStartCode || 'GO').toUpperCase());
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
    setStartWord(String(organizerStartCode || 'GO').toUpperCase());
  }, [eventId, destinationName, organizerFinishCode, organizerStartCode]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const finish = String(form.answer || DEFAULT_FINISH).trim().toUpperCase();
      const go = String(startWord || 'GO').trim().toUpperCase() || 'GO';
      await adminUpdateEvent(eventId, {
        destinationName,
        organizerFinishCode: finish,
        organizerStartCode: go,
      });

      const pointList = points.length ? points : starts;
      await Promise.all(pointList.map(async (point) => {
        const route = routeForStart(routes, point);
        if (!route) return;
        await adminUpsertChallenge(eventId, {
          roundId,
          routeId: id(route),
          challengeNumber: 6,
          variantKey: 'DEFAULT',
          challengeType: 'NAVIGATION',
          active: true,
          prompt: form.prompt,
          answer: finish,
          destinationInstruction: form.destinationInstruction,
          hintText: form.hintText,
          timerSeconds: 0,
          hintCost: 0,
        });
      }));

      setMessage('Saved start code + finish code');
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
          Clue 6 · Lobby
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">Start + finish codes</h3>
      </div>

      <label className="block space-y-1 text-sm text-white/70">
        Start code (gather point)
        <input
          value={startWord}
          onChange={(e) => setStartWord(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
          className={`${inputClass} font-mono tracking-wider`}
          placeholder="GO"
        />
      </label>

      <label className="block space-y-1 text-sm text-white/70">
        Finish code (lobby)
        <input
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value.toUpperCase() }))}
          className={`${inputClass} font-mono tracking-wider`}
          placeholder={DEFAULT_FINISH}
        />
      </label>

      <details className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <summary className="cursor-pointer text-xs text-white/45">Advanced copy (optional)</summary>
        <div className="mt-3 space-y-3">
          <label className="block space-y-1 text-sm text-white/70">
            Prompt
            <textarea
              rows={2}
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-white/70">
            Desk note
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
        </div>
      </details>

      <button
        type="button"
        disabled={busy}
        onClick={() => save()}
        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
      >
        {busy ? 'Saving…' : 'Save codes'}
      </button>
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}
