import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListCheckpoints,
  adminListRoutes,
  adminListStartingPoints,
  adminRotateCheckpointQr,
  adminSetCheckpointActive,
  adminUpdateCheckpoint,
  adminUpsertCheckpoint,
} from '../services/campusHunt.api';
import {
  STATION_TARGET_COUNT,
  TARGET_TEAMS_PER_STATION,
  firstStopArrivalPlan,
  resolveStations,
  uniqueStationNames,
  WAIT_POINTS,
} from './campusHuntFormat';

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
  capacityGuidance: 4,
  concurrencyGuidance: 'Target 4 teams per campus station. Starting points are gather spots only.',
  allowedTeamIds: '',
  compensationPolicyKey: 'skip_and_continue',
  active: true,
};

function id(value) {
  return String(value?._id || value?.id || value || '');
}

export default function CheckpointManager({
  eventId,
  roundId,
  onChanged,
  progressionFilter = null,
  title = 'Checkpoint configuration',
  reloadKey = 0,
  groupFirstStopsByStation = false,
  campusStations,
  stageTheme = null,
  teamCapacity = 40,
  teamsPerStation = TARGET_TEAMS_PER_STATION,
  teamsPerWait,
}) {
  const perWait = Math.max(
    1,
    Number(teamsPerWait) || Math.ceil((Number(teamCapacity) || 40) / 4),
  );
  const accent = stageTheme;
  const [checkpoints, setCheckpoints] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [startingPoints, setStartingPoints] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const stations = useMemo(() => resolveStations(campusStations), [campusStations]);

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
  }, [refresh, reloadKey]);

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
      capacityGuidance: checkpoint.capacityGuidance ?? TARGET_TEAMS_PER_STATION,
      concurrencyGuidance: checkpoint.concurrencyGuidance || '',
      allowedTeamIds: (checkpoint.allowedTeamIds || []).map(id).join(', '),
      compensationPolicyKey: checkpoint.compensationPolicyKey || 'skip_and_continue',
      active: checkpoint.active !== false,
    });
  };

  const reset = () => {
    setEditingId('');
    const firstKey = Array.isArray(progressionFilter) && progressionFilter[0]
      ? String(progressionFilter[0])
      : '1';
    const num = firstKey === 'FINISH' ? 4 : Number(firstKey) || 1;
    setDraft({
      ...emptyDraft,
      progressionKey: firstKey,
      checkpointKey: firstKey === 'FINISH' ? 'FINISH' : String(num),
      checkpointNumber: num,
      sequence: num,
    });
  };

  const matchesFilter = (checkpoint) => {
    if (!progressionFilter || !progressionFilter.length) return true;
    const progression = String(checkpoint.progressionKey || '').toUpperCase();
    const key = String(checkpoint.checkpointKey || '').toUpperCase();
    const num = String(checkpoint.checkpointNumber ?? '');
    return progressionFilter.some((item) => {
      const filter = String(item).toUpperCase();
      return filter === progression || filter === key || filter === num;
    });
  };

  const visibleCheckpoints = useMemo(() => {
    const filtered = checkpoints.filter(matchesFilter);
    // Never treat the 4 wait holds as hunt scan locations in the UI
    const waits = new Set(WAIT_POINTS.map((w) => w.name.toLowerCase()));
    return filtered.filter(
      (cp) => !waits.has(String(cp.locationName || '').trim().toLowerCase()),
    );
  }, [checkpoints, progressionFilter]);
  const uniqueLocations = useMemo(
    () => uniqueStationNames(visibleCheckpoints),
    [visibleCheckpoints],
  );
  const waitNames = useMemo(
    () => new Set(WAIT_POINTS.map((w) => w.name.toLowerCase())),
    [],
  );
  const exampleStations = stations.map((s) => s.name).join(' · ');

  /** First Scan: exactly 10 places — team count + which wait each team comes from */
  const firstStopPlan = useMemo(
    () => (groupFirstStopsByStation ? firstStopArrivalPlan(stations, perWait) : null),
    [groupFirstStopsByStation, stations, perWait],
  );

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

  return (
    <div className="space-y-5">
      <section className={`rounded-2xl border bg-white/5 p-4 ${accent?.borderClass || 'border-white/10'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {accent && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${accent.solidClass} ${accent.solidTextClass}`}>
                  {accent.colorName}
                </span>
              )}
              <h2 className="font-semibold">{title}</h2>
            </div>
            <p className="text-xs text-white/50">
              {groupFirstStopsByStation
                ? `${STATION_TARGET_COUNT} campus places only · ~${teamsPerStation} teams each`
                : `Campus hunt stops — not the 4 starting points. Free location names (e.g. ${exampleStations}).`}
            </p>
          </div>
          {!groupFirstStopsByStation && (
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs ${
                uniqueLocations >= STATION_TARGET_COUNT
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-amber-500/15 text-amber-100'
              }`}>
                Unique places {uniqueLocations}/{STATION_TARGET_COUNT}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                Target ~{teamsPerStation} teams / place
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {visibleCheckpoints.length} checkpoint rows
              </span>
            </div>
          )}
        </div>

        {firstStopPlan ? (
          <div className="mt-3 space-y-2">
            {firstStopPlan.map((place) => (
              <div
                key={place.code}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{place.name}</p>
                  <p className="text-sm font-semibold text-[#0ECCEE]">
                    {place.teamCount} teams
                  </p>
                </div>
                <ul className="mt-2 space-y-1">
                  {place.arrivals.map((row) => (
                    <li
                      key={`${place.code}-${row.waitCode}-${row.waveId}`}
                      className="text-sm text-white/75"
                    >
                      <span className="font-medium text-white">{row.teamLabel}</span>
                      {' from '}
                      <span className="text-emerald-300">{row.startingPointName || row.waitName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleCheckpoints.map((checkpoint) => (
              <div key={id(checkpoint)} className="rounded-xl bg-black/25 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {checkpoint.locationName || 'Station'}
                    </p>
                    <p className="text-xs text-white/45">
                      {checkpoint.active === false ? 'Off' : 'On'}
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
            {!visibleCheckpoints.length && (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50 md:col-span-2 xl:col-span-3">
                No checkpoints yet. Use the form below to add the first event-day station.
              </p>
            )}
          </div>
        )}
      </section>

      {!routes.length && (
        <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-amber-100">Create a route first</h3>
          <p className="mt-1 text-xs text-amber-100/75">
            Every checkpoint belongs to a route. Add one in Game setup → Routes before continuing.
          </p>
        </section>
      )}

      {groupFirstStopsByStation ? null : (
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
            Campus location name
            <input
              required
              list="campus-hunt-station-names"
              value={draft.locationName}
              onChange={(event) => setDraft((value) => ({
                ...value,
                locationName: event.target.value,
              }))}
              placeholder={`e.g. ${stations[0]?.name || 'Campus place'} — not a starting point name`}
              className={`mt-1 ${inputClass}`}
            />
            <datalist id="campus-hunt-station-names">
              {stations.map((station) => (
                <option key={station.code} value={station.name} />
              ))}
            </datalist>
            {waitNames.has(String(draft.locationName || '').trim().toLowerCase()) && (
              <span className="mt-1 block text-amber-200">
                That name is a starting point. Prefer a different campus scan spot.
              </span>
            )}
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
              Capacity guidance (teams per place)
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
              <span className="mt-1 block text-white/40">
                Default {teamsPerStation || TARGET_TEAMS_PER_STATION} — {(teamCapacity || 40)} teams ÷ {STATION_TARGET_COUNT} stations.
              </span>
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
      )}
      {groupFirstStopsByStation && message && (
        <p className="text-sm text-[#0ECCEE]">{message}</p>
      )}
    </div>
  );
}
