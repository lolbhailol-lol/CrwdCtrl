import { useCallback, useEffect, useState } from 'react';
import {
  adminCreateVolunteer,
  adminListCheckpoints,
  adminListVolunteers,
} from '../services/campusHunt.api';

const inputClass = 'w-full rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

function id(value) {
  return String(value?._id || value?.id || value || '');
}

export default function VolunteerSetupPanel({ eventId, onChanged }) {
  const [volunteers, setVolunteers] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [form, setForm] = useState({ code: '', label: '', password: '', checkpointId: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [volunteerResult, checkpointResult] = await Promise.all([
      adminListVolunteers(eventId),
      adminListCheckpoints(eventId),
    ]);
    setVolunteers(volunteerResult.data?.volunteers || []);
    setCheckpoints(checkpointResult.data?.checkpoints || []);
  }, [eventId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminCreateVolunteer(eventId, {
        code: form.code.trim().toUpperCase(),
        label: form.label.trim(),
        password: form.password,
        checkpointIds: [form.checkpointId],
      });
      setForm({ code: '', label: '', password: '', checkpointId: '' });
      setMessage('Volunteer login created. Share the code and password only with that station.');
      await refresh();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Could not create volunteer login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-semibold">Checkpoint volunteers</h2>
      <p className="text-xs text-white/50">
        Create one login per staffed checkpoint. Volunteers verify attendance but cannot see clues or scores.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {volunteers.map((volunteer) => {
          const checkpoint = checkpoints.find((item) => (
            (volunteer.checkpointIds || []).some((checkpointId) => id(checkpointId) === id(item))
          ));
          return (
            <div key={id(volunteer)} className="rounded-lg bg-black/25 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{volunteer.label || volunteer.code}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  volunteer.enabled
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-red-500/15 text-red-200'
                }`}>
                  {volunteer.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="font-mono text-xs text-[#0ECCEE]">{volunteer.code}</p>
              <p className="mt-1 text-xs text-white/50">
                {checkpoint
                  ? `${checkpoint.code || checkpoint.checkpointKey} — ${checkpoint.locationName}`
                  : 'No checkpoint assigned'}
              </p>
            </div>
          );
        })}
      </div>
      {!checkpoints.length ? (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Create checkpoints first. A volunteer login must be tied to a physical station.
        </p>
      ) : (
        <form onSubmit={create} className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            required
            value={form.code}
            onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))}
            placeholder="Login code, e.g. LIBRARY01"
            className={inputClass}
          />
          <input
            required
            value={form.label}
            onChange={(event) => setForm((value) => ({ ...value, label: event.target.value }))}
            placeholder="Volunteer or station label"
            className={inputClass}
          />
          <input
            required
            type="password"
            value={form.password}
            onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
            placeholder="Create a station password"
            className={inputClass}
          />
          <select
            required
            value={form.checkpointId}
            onChange={(event) => setForm((value) => ({
              ...value,
              checkpointId: event.target.value,
            }))}
            className={inputClass}
          >
            <option value="">Assign checkpoint</option>
            {checkpoints.map((checkpoint) => (
              <option key={id(checkpoint)} value={id(checkpoint)}>
                {checkpoint.code || checkpoint.checkpointKey} — {checkpoint.locationName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Create volunteer login
          </button>
        </form>
      )}
      {message && <p className="mt-2 text-sm text-[#0ECCEE]">{message}</p>}
    </section>
  );
}
