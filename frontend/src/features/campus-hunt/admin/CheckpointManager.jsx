import { useCallback, useEffect, useState } from 'react';
import {
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminRotateCheckpointQr,
  adminSetCheckpointActive,
  adminUpdateCheckpoint,
  adminUpsertCheckpoint,
} from '../services/campusHunt.api';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

const emptyDraft = {
  routeId: '',
  startingPointId: '',
  code: '',
  progressionKey: '1',
  checkpointKey: '',
  checkpointNumber: 1,
  sequence: 1,
  locationName: '',
  publicInstruction: '',
  capacityGuidance: 10,
  concurrencyGuidance: '',
  allowedTeamIds: '',
  compensationPolicyKey: 'skip_and_continue',
  active: true,
};

function id(value) {
  return String(value?._id || value?.id || value || '');
}

export default function CheckpointManager({ eventId, roundId, onChanged }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [startingPoints, setStartingPoints] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [checkpointResult, routeResult, pointResult] = await Promise.all([
      adminListCheckpoints(eventId),
      adminListRoutes(eventId),
      adminListStartingPoints(eventId),
    ]);
    setCheckpoints(checkpointResult.data?.checkpoints || []);
    setRoutes(routeResult.data?.routes || []);
    setStartingPoints(pointResult.data?.startingPoints || []);
  }, [eventId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  const run = async (key, action, success) => {
    setBusy(key);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await refresh();
      onChanged?.();
      return true;
    } catch (error) {
      setMessage(error.message || 'Action failed');
      return false;
    } finally {
      setBusy('');
    }
  };

  const edit = (checkpoint) => {
    setEditingId(id(checkpoint));
    setDraft({
      routeId: id(checkpoint.routeId),
      startingPointId: id(checkpoint.startingPointId),
      code: checkpoint.code || '',
      progressionKey: checkpoint.progressionKey || checkpoint.checkpointKey || '1',
      checkpointKey: checkpoint.checkpointKey || '',
      checkpointNumber: checkpoint.checkpointNumber ?? 1,
      sequence: checkpoint.sequence ?? 1,
      locationName: checkpoint.locationName || '',
      publicInstruction: checkpoint.publicInstruction || '',
      capacityGuidance: checkpoint.capacityGuidance ?? 10,
      concurrencyGuidance: checkpoint.concurrencyGuidance || '',
      allowedTeamIds: (checkpoint.allowedTeamIds || []).map(id).join(', '),
      compensationPolicyKey: checkpoint.compensationPolicyKey || 'skip_and_continue',
      active: checkpoint.active !== false,
    });
  };

  const reset = () => {
    setEditingId('');
    setDraft(emptyDraft);
  };

  const submit = async (event) => {
    event.preventDefault();
    const body = {
      ...draft,
      roundId,
      checkpointKey: draft.checkpointKey.trim().toUpperCase(),
      code: draft.code.trim().toUpperCase(),
      progressionKey: draft.progressionKey,
      startingPointId: draft.startingPointId || null,
      locationName: draft.locationName.trim(),
      publicInstruction: draft.publicInstruction.trim(),
      checkpointNumber: Number(draft.checkpointNumber),
      sequence: Number(draft.sequence),
      capacityGuidance: Number(draft.capacityGuidance) || undefined,
      concurrencyGuidance: draft.concurrencyGuidance.trim(),
      allowedTeamIds: draft.allowedTeamIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    };
    let saved;
    if (editingId) {
      saved = await run(
        `save-${editingId}`,
        () => adminUpdateCheckpoint(editingId, body),
        'Checkpoint updated',
      );
    } else {
      saved = await run(
        'create',
        () => adminUpsertCheckpoint(eventId, body),
        'Checkpoint created',
      );
    }
    if (saved) reset();
  };

  const routeLabel = (routeId) => {
    const route = routes.find((item) => id(item) === id(routeId));
    return route ? `Route ${route.routeKey}` : 'Unassigned route';
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Checkpoint configuration</h2>
            <p className="text-xs text-white/50">
              Configure public arrival instructions and route order. QR secrets are never shown here.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {checkpoints.length} checkpoints
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checkpoints.map((checkpoint) => (
            <div key={id(checkpoint)} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {checkpoint.code || checkpoint.checkpointKey} · {checkpoint.locationName}
                  </p>
                  <p className="text-xs text-white/45">
                    {routeLabel(checkpoint.routeId)} · progression{' '}
                    {checkpoint.progressionKey || checkpoint.checkpointKey} · sequence{' '}
                    {checkpoint.sequence} ·{' '}
                    {checkpoint.active === false ? 'disabled' : 'active'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => edit(checkpoint)}
                  className="rounded bg-white/10 px-2 py-1 text-[11px]"
                >
                  Edit
                </button>
              </div>
              <p className="mt-2 text-xs text-white/65">
                {checkpoint.publicInstruction || 'No public instruction'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => run(
                    `active-${id(checkpoint)}`,
                    () => adminSetCheckpointActive(checkpoint._id, checkpoint.active === false, {
                      compensate: checkpoint.active !== false,
                      reason: checkpoint.active === false
                        ? 'Re-enabled from checkpoint manager'
                        : 'Disabled from checkpoint manager',
                    }),
                    checkpoint.active === false ? 'Checkpoint enabled' : 'Checkpoint disabled',
                  )}
                  className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100"
                >
                  {checkpoint.active === false ? 'Enable' : 'Disable + compensate'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (!window.confirm('Rotate this station QR? Existing printed codes will stop working.')) return;
                    run(
                      `rotate-${id(checkpoint)}`,
                      () => adminRotateCheckpointQr(id(checkpoint), 'Rotated from checkpoint manager'),
                      'Station QR rotated; reprint the station poster',
                    );
                  }}
                  className="rounded bg-red-500/15 px-2 py-1 text-[11px] text-red-200"
                >
                  Rotate station QR
                </button>
              </div>
            </div>
          ))}
          {!checkpoints.length && (
            <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50 md:col-span-2 xl:col-span-3">
              No checkpoints yet. Use the form below to add the first event-day station.
            </p>
          )}
        </div>
      </section>

      {!routes.length && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-amber-100">Create a route first</h3>
          <p className="mt-1 text-xs text-amber-100/75">
            Every checkpoint belongs to a route. Add one in Game setup → Routes before continuing.
          </p>
        </section>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{editingId ? 'Edit checkpoint' : 'Add checkpoint'}</h3>
          {editingId && (
            <button type="button" onClick={reset} className="text-xs text-white/50 underline">
              Cancel edit
            </button>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Event-day essentials</p>
          <p className="mt-1 text-xs text-white/45">
            These are the details operators and players need at the physical station.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-white/50">
            Route
            <select
              required
              disabled={Boolean(editingId)}
              value={draft.routeId}
              onChange={(event) => setDraft((value) => ({ ...value, routeId: event.target.value }))}
              className={`mt-1 ${inputClass} disabled:opacity-60`}
            >
              <option value="">Select route</option>
              {routes.map((route) => (
                <option key={id(route)} value={id(route)}>
                  {route.routeKey} — {route.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/50">
            Public checkpoint code
            <input
              required
              value={draft.code}
              onChange={(event) => setDraft((value) => ({
                ...value,
                code: event.target.value.toUpperCase(),
              }))}
              placeholder="CP-A1-LIBRARY"
              className={`mt-1 ${inputClass}`}
            />
            <span className="mt-1 block text-white/40">
              A readable label shown to staff and players; this is not the secret QR value.
            </span>
          </label>
          <label className="text-xs text-white/50">
            Location name
            <input
              required
              value={draft.locationName}
              onChange={(event) => setDraft((value) => ({
                ...value,
                locationName: event.target.value,
              }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs text-white/50 md:col-span-2">
            Public player instruction
            <textarea
              required
              value={draft.publicInstruction}
              onChange={(event) => setDraft((value) => ({
                ...value,
                publicInstruction: event.target.value,
              }))}
              placeholder="Tell players exactly where to stand, who to meet, or what to scan."
              className={`mt-1 min-h-20 ${inputClass}`}
            />
            <span className="mt-1 block text-white/40">
              Keep this short and recognizable on-site, for example: “Meet the volunteer beside the library entrance.”
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft((value) => ({ ...value, active: event.target.checked }))}
            />
            Active
          </label>
        </div>
        <details className="rounded-xl border border-white/10 bg-black/20 p-3">
          <summary className="cursor-pointer text-sm font-medium text-white/75">
            Advanced settings
          </summary>
          <p className="mt-2 text-xs text-white/45">
            Ordering, targeting, capacity, and fallback controls. Defaults work for most stations.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/50">
              Checkpoint internal key
              <input
                required
                disabled={Boolean(editingId)}
                value={draft.checkpointKey}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  checkpointKey: event.target.value.toUpperCase(),
                }))}
                placeholder="1 or FINISH"
                className={`mt-1 ${inputClass} disabled:opacity-60`}
              />
            </label>
            <label className="text-xs text-white/50">
              Checkpoint number
              <input
                type="number"
                min="1"
                value={draft.checkpointNumber}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  checkpointNumber: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Route sequence
              <input
                type="number"
                min="1"
                value={draft.sequence}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  sequence: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Progression step
              <select
                value={draft.progressionKey}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  progressionKey: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="1">Checkpoint 1</option>
                <option value="2">Checkpoint 2</option>
                <option value="3">Checkpoint 3</option>
                <option value="FINISH">Finish</option>
              </select>
            </label>
            <label className="text-xs text-white/50">
              Starting point relationship
              <select
                value={draft.startingPointId}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  startingPointId: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Any starting point</option>
                {startingPoints.map((point) => (
                  <option key={id(point)} value={id(point)}>
                    {point.code} — {point.name}
                  </option>
                ))}
              </select>
              {!startingPoints.length && (
                <span className="mt-1 block text-amber-200">
                  No starting points exist yet; this checkpoint will apply to any start.
                </span>
              )}
            </label>
            <label className="text-xs text-white/50">
              Capacity guidance
              <input
                type="number"
                min="1"
                value={draft.capacityGuidance}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  capacityGuidance: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Concurrency guidance
              <input
                value={draft.concurrencyGuidance}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  concurrencyGuidance: event.target.value,
                }))}
                placeholder="Maximum two teams at the desk"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50 md:col-span-2">
              Allowed team IDs (optional, comma separated)
              <input
                value={draft.allowedTeamIds}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  allowedTeamIds: event.target.value,
                }))}
                placeholder="Leave blank to allow every assigned route team"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-white/50">
              Disabled-checkpoint compensation policy
              <select
                value={draft.compensationPolicyKey}
                onChange={(event) => setDraft((value) => ({
                  ...value,
                  compensationPolicyKey: event.target.value,
                }))}
                className={`mt-1 ${inputClass}`}
              >
                <option value="skip_and_continue">Skip and continue</option>
                <option value="award_and_continue">Award and continue</option>
                <option value="manual_review">Manual review</option>
              </select>
            </label>
          </div>
        </details>
        <button
          type="submit"
          disabled={Boolean(busy) || !roundId || !routes.length}
          className="rounded-lg bg-[#0ECCEE] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {busy ? 'Saving…' : editingId ? 'Save checkpoint' : 'Create checkpoint'}
        </button>
        {!roundId && <p className="text-xs text-amber-200">Create Round 1 before adding checkpoints.</p>}
        {message && <p className="text-sm text-[#0ECCEE]">{message}</p>}
      </form>
    </div>
  );
}
