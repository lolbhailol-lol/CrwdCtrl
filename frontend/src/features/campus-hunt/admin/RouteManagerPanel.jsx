import { useCallback, useEffect, useState } from 'react';
import {
  adminCreateRoute,
  adminListRoutes,
  adminListTeams,
  adminUpdateRoute,
} from '../services/campusHunt.api';

const inputClass = 'rounded-lg border border-white/15 bg-[#161718] px-3 py-2 text-sm text-white';

export default function RouteManagerPanel({ eventId, onChanged }) {
  const [routes, setRoutes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [draft, setDraft] = useState({ routeKey: '', name: '', teamSlots: 10 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [routeResult, teamResult] = await Promise.all([
      adminListRoutes(eventId),
      adminListTeams(eventId),
    ]);
    setRoutes(routeResult.data?.routes || []);
    setTeams(teamResult.data?.teams || []);
  }, [eventId]);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminCreateRoute(eventId, {
        routeKey: draft.routeKey.trim().toUpperCase(),
        name: draft.name.trim(),
        teamSlots: Number(draft.teamSlots),
      });
      setDraft({ routeKey: '', name: '', teamSlots: 10 });
      setMessage('Route created');
      await refresh();
      onChanged?.();
    } catch (error) {
      setMessage(error.message || 'Could not create route');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <h2 className="font-semibold">Routes</h2>
        <p className="text-xs text-white/50">
          A route is the game path followed after release. Route capacity must cover all teams.
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {routes.map((route) => {
          const used = teams.filter((team) => String(team.routeId) === String(route._id)).length;
          return (
            <div key={route._id} className="rounded-xl bg-black/25 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">Route {route.routeKey}</p>
                  <p className="text-xs text-white/50">{route.name}</p>
                  <p className="mt-1 text-xs">{used}/{route.teamSlots} teams assigned</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  route.active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'
                }`}>
                  {route.active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await adminUpdateRoute(route._id, { active: !route.active });
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-2 rounded bg-white/10 px-2 py-1 text-xs"
              >
                {route.active ? 'Disable route' : 'Enable route'}
              </button>
            </div>
          );
        })}
      </div>
      {!routes.length && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          No routes yet. Create the first route below.
        </p>
      )}
      <form onSubmit={create} className="mt-3 grid gap-2 md:grid-cols-4">
        <input
          required
          value={draft.routeKey}
          onChange={(event) => setDraft((value) => ({ ...value, routeKey: event.target.value }))}
          placeholder="Short code, e.g. A"
          className={inputClass}
        />
        <input
          required
          value={draft.name}
          onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
          placeholder="Route name, e.g. Library loop"
          className={inputClass}
        />
        <input
          type="number"
          min="1"
          required
          value={draft.teamSlots}
          onChange={(event) => setDraft((value) => ({ ...value, teamSlots: event.target.value }))}
          aria-label="Maximum teams on route"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          Create route
        </button>
      </form>
      {message && <p className="mt-2 text-sm text-[#0ECCEE]">{message}</p>}
    </section>
  );
}
