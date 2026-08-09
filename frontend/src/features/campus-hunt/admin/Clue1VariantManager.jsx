import { useCallback, useEffect, useState } from 'react';
import {
  adminListChallenges,
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminUpsertChallenge,
} from '../services/campusHunt.api';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const blankForm = {
  routeId: '',
  startingPointId: '',
  firstCheckpointId: '',
  variantKey: '',
  difficulty: 'medium',
  type: 'location_text',
  prompt: '',
  answer: '',
  acceptedAnswers: '',
  destinationInstruction: '',
  basePoints: 25,
  maxAttempts: 3,
  active: true,
};

function id(value) {
  return String(value?._id || value?.id || value || '');
}

export default function Clue1VariantManager({ eventId, roundId, onChanged }) {
  const [variants, setVariants] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [points, setPoints] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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
  }, [eventId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  const fill = (variant) => {
    setForm({
      routeId: id(variant.routeId),
      startingPointId: id(variant.startingPointId),
      firstCheckpointId: id(variant.firstCheckpointId),
      variantKey: variant.variantKey || '',
      difficulty: variant.difficulty || 'medium',
      type: variant.type || 'location_text',
      prompt: variant.prompt || '',
      answer: variant.answer || '',
      acceptedAnswers: (variant.acceptedAnswers || []).join(', '),
      destinationInstruction: variant.destinationInstruction || '',
      basePoints: variant.basePoints ?? 25,
      maxAttempts: variant.maxAttempts ?? 3,
      active: variant.active !== false,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminUpsertChallenge(eventId, {
        ...form,
        roundId,
        challengeNumber: 1,
        variantKey: form.variantKey.trim().toUpperCase(),
        prompt: form.prompt.trim(),
        answer: form.answer.trim(),
        acceptedAnswers: form.acceptedAnswers
          .split(',')
          .map((answer) => answer.trim())
          .filter(Boolean),
        destinationInstruction: form.destinationInstruction.trim(),
        basePoints: Number(form.basePoints),
        maxAttempts: Number(form.maxAttempts),
      });
      setMessage('Clue 1 variant saved');
      setForm(blankForm);
      await refresh();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Could not save variant');
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (items, value, fallback) => {
    const match = items.find((item) => id(item) === id(value));
    return match?.code || match?.routeKey || match?.checkpointKey || match?.name || fallback;
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Clue 1 variants</h2>
            <p className="text-xs text-white/50">
              Map each starting point to a route-safe first checkpoint. Answers remain admin-only.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{variants.length} variants</span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {variants.map((variant) => (
            <button
              type="button"
              key={id(variant)}
              onClick={() => fill(variant)}
              className="rounded-xl border border-white/10 bg-black/25 p-3 text-left text-sm hover:border-[#0ECCEE]/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#0ECCEE]">{variant.variantKey || 'DEFAULT'}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  variant.active === false ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'
                }`}>
                  {variant.active === false ? 'inactive' : 'active'}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-white/75">{variant.prompt || 'No prompt'}</p>
              <p className="mt-2 text-xs text-white/45">
                Start {labelFor(points, variant.startingPointId, '—')} → CP{' '}
                {labelFor(checkpoints, variant.firstCheckpointId, '—')} · Route{' '}
                {labelFor(routes, variant.routeId, '—')} · {variant.difficulty || 'medium'}
              </p>
            </button>
          ))}
          {!variants.length && (
            <p className="text-sm text-amber-100">No Clue 1 variants yet. Create one below.</p>
          )}
        </div>
      </section>

      {(!points.length || !routes.length || !checkpoints.some((checkpoint) => (
        String(checkpoint.progressionKey || checkpoint.checkpointKey) === '1'
      ))) && (
        <section className="space-y-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-amber-100">Finish the event setup first</h3>
          {!points.length && (
            <p className="text-xs text-amber-100/75">
              No starting points found. Add a starting point before assigning who receives a clue.
            </p>
          )}
          {!routes.length && (
            <p className="text-xs text-amber-100/75">
              No routes found. Create a route before making a route-specific clue.
            </p>
          )}
          {!checkpoints.some((checkpoint) => (
            String(checkpoint.progressionKey || checkpoint.checkpointKey) === '1'
          )) && (
            <p className="text-xs text-amber-100/75">
              No Checkpoint 1 destinations found. Add a Checkpoint 1 before saving this clue.
            </p>
          )}
        </section>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Create or update variant</h3>
          <button
            type="button"
            onClick={() => setForm(blankForm)}
            className="text-xs text-white/50 underline"
          >
            Clear form
          </button>
        </div>
        <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <h4 className="text-sm font-semibold">1. Who gets this clue</h4>
            <p className="mt-1 text-xs text-white/45">
              Choose the starting group and route. The variant code is your admin label—for example,
              NORTH_A for the north start on Route A.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/50">
              Variant code
              <input
                required
                value={form.variantKey}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  variantKey: event.target.value.toUpperCase(),
                }))}
                placeholder="NORTH_A"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Starting point
              <select
                required
                value={form.startingPointId}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  startingPointId: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Select starting point</option>
                {points.map((point) => (
                  <option key={id(point)} value={id(point)}>
                    {point.code} — {point.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/50 md:col-span-2">
              Route
              <select
                required
                value={form.routeId}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  routeId: event.target.value,
                  firstCheckpointId: '',
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Select route</option>
                {routes.map((route) => (
                  <option key={id(route)} value={id(route)}>
                    {route.routeKey} — {route.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <h4 className="text-sm font-semibold">2. Clue and accepted answers</h4>
            <p className="mt-1 text-xs text-white/45">
              Players see the clue, but the correct and alternate answers remain admin-only.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/50 md:col-span-2">
              Clue shown to the team leader
              <textarea
                required
                value={form.prompt}
                onChange={(event) => setForm((value) => ({ ...value, prompt: event.target.value }))}
                placeholder="Write the clue exactly as the leader should see it."
                className={`mt-1 min-h-24 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Correct answer (admin-only)
              <input
                required
                value={form.answer}
                onChange={(event) => setForm((value) => ({ ...value, answer: event.target.value }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Other accepted answers (comma separated)
              <input
                value={form.acceptedAnswers}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  acceptedAnswers: event.target.value,
                }))}
                placeholder="library, central library"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Answer type
              <select
                value={form.type}
                onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="location_text">Location text</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </label>
            <label className="text-xs text-white/50">
              Difficulty
              <select
                value={form.difficulty}
                onChange={(event) => setForm((value) => ({ ...value, difficulty: event.target.value }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="text-xs text-white/50">
              Base points
              <input
                type="number"
                min="0"
                value={form.basePoints}
                onChange={(event) => setForm((value) => ({ ...value, basePoints: event.target.value }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Maximum attempts
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
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <h4 className="text-sm font-semibold">3. Where it sends the team</h4>
            <p className="mt-1 text-xs text-white/45">
              Pick the first checkpoint on the selected route and tell players what to do after solving.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/50">
              First checkpoint
              <select
                required
                value={form.firstCheckpointId}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  firstCheckpointId: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Select first checkpoint</option>
                {checkpoints
                  .filter((checkpoint) => (
                    (!form.routeId || id(checkpoint.routeId) === form.routeId)
                    && String(checkpoint.progressionKey || checkpoint.checkpointKey) === '1'
                  ))
                  .map((checkpoint) => (
                    <option key={id(checkpoint)} value={id(checkpoint)}>
                      {checkpoint.code || checkpoint.checkpointKey} — {checkpoint.locationName}
                    </option>
                  ))}
              </select>
              {form.routeId && !checkpoints.some((checkpoint) => (
                id(checkpoint.routeId) === form.routeId
                && String(checkpoint.progressionKey || checkpoint.checkpointKey) === '1'
              )) && (
                <span className="mt-1 block text-amber-200">
                  This route has no Checkpoint 1 yet. Add it in Checkpoints first.
                </span>
              )}
            </label>
            <label className="text-xs text-white/50">
              Instruction shown after a correct answer
              <input
                required
                value={form.destinationInstruction}
                onChange={(event) => setForm((value) => ({
                  ...value,
                  destinationInstruction: event.target.value,
                }))}
                placeholder="Walk there and scan the public station QR."
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
        </section>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((value) => ({ ...value, active: event.target.checked }))}
          />
          Active and available for team assignment
        </label>
        <button
          type="submit"
          disabled={busy || !roundId || !points.length || !routes.length}
          className="rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save Clue 1 variant'}
        </button>
        {!roundId && <p className="text-xs text-amber-200">Create Round 1 before saving variants.</p>}
        {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
      </form>
    </div>
  );
}
