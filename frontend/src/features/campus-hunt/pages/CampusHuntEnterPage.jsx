import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchCampusHuntProfileEntries } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import { normalizeTeamCode } from '../utils/teamCode';
import CampusHuntBackLink from '../components/CampusHuntBackLink';

/**
 * Profile → Campus Hunt login hub.
 * Requires CrwdCtrl Google session (same pattern as Runs / Treks).
 * Then pick an event + team code → team password screen.
 */
export default function CampusHuntEnterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState([]);
  const [slug, setSlug] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCampusHuntProfileEntries();
        if (cancelled) return;
        const list = res.data?.login || [];
        setEvents(list);
        if (list[0]?.slug) setSlug(list[0].slug);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Checking Google sign-in…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: CAMPUS_HUNT_PATHS.profileLogin } }}
      />
    );
  }

  const onContinue = (e) => {
    e.preventDefault();
    const code = normalizeTeamCode(teamCode);
    if (!slug) {
      setError('Pick your college event');
      return;
    }
    if (!code) {
      setError('Enter your team code (e.g. CC001)');
      return;
    }
    navigate(CAMPUS_HUNT_PATHS.teamLogin(slug, code));
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <CampusHuntBackLink to="/" label="Back" />
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">
            Campus Hunt
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Enter hunt</h1>
          <p className="mt-2 text-sm text-white/55">
            You&apos;re signed in with Google. Choose your event and team code to continue.
          </p>
        </header>

        {loading ? (
          <p className="text-center text-white/50">Loading events…</p>
        ) : !events.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/60">
            No Campus Hunt login is live on Profile yet.
            <p className="mt-2 text-xs text-white/40">Ask an organizer to enable “Login on Profile”.</p>
          </div>
        ) : (
          <form onSubmit={onContinue} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="block text-xs uppercase tracking-wide text-white/50">
              Event
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-[#0ECCEE]"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.slug}>
                    {ev.college} · {ev.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs uppercase tracking-wide text-white/50">
              Team code
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="CC001"
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-center font-mono text-xl tracking-[0.2em] outline-none focus:border-[#0ECCEE]"
                autoComplete="off"
              />
            </label>

            {error && <p className="text-center text-sm text-red-300">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-[#0ECCEE] py-3 text-sm font-bold uppercase tracking-wide text-black"
            >
              Continue to team login
            </button>
          </form>
        )}

        <p className="text-center text-xs text-white/40">
          <Link to={CAMPUS_HUNT_PATHS.leaderboard} className="underline hover:text-[#0ECCEE]">
            View leaderboard
          </Link>
        </p>
      </div>
    </div>
  );
}
