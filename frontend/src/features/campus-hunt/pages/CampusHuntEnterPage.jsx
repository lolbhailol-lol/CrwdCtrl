import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CAMPUS_HUNT_PATHS } from '../config';
import { normalizeTeamCode } from '../utils/teamCode';
import { fetchCampusHuntColleges } from '../services/campusHunt.api';
import CampusHuntBackLink from '../components/CampusHuntBackLink';

/**
 * Public Campus Hunt login hub — no Google required.
 * Pick college → team code → team password screen.
 */
export default function CampusHuntEnterPage() {
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [college, setCollege] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCampusHuntColleges();
        if (cancelled) return;
        const list = (res.data?.colleges || []).filter((c) =>
          (c.events || []).some((ev) => ev.loginLive === true),
        );
        setColleges(list);
        const first = list[0];
        setCollege(first?.college || '');
        const firstEv = first?.events?.find((ev) => ev.loginLive === true) || first?.events?.[0];
        setEventSlug(firstEv?.slug || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load colleges');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const events = useMemo(() => {
    const row = colleges.find((c) => c.college === college);
    return (row?.events || []).filter((ev) => ev.loginLive === true);
  }, [colleges, college]);

  const onCollegeChange = (value) => {
    setCollege(value);
    const evs = (colleges.find((c) => c.college === value)?.events || [])
      .filter((ev) => ev.loginLive === true);
    setEventSlug(evs[0]?.slug || '');
  };

  const onContinue = (e) => {
    e.preventDefault();
    const code = normalizeTeamCode(teamCode);
    if (!eventSlug) {
      setError('Pick your college');
      return;
    }
    if (!code) {
      setError('Enter your team code (e.g. CC001)');
      return;
    }
    navigate(CAMPUS_HUNT_PATHS.teamLogin(eventSlug, code));
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <CampusHuntBackLink to="/" label="Back" />
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">
            Campus Hunt
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Hunt login</h1>
          <p className="mt-2 text-sm text-white/55">
            Choose your college and enter your team code. No Google sign-in needed.
          </p>
        </header>

        {loading && colleges.length === 0 ? (
          <p className="text-center text-white/50">Loading colleges…</p>
        ) : !colleges.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/60">
            No Campus Hunt login is live yet.
            <p className="mt-2 text-xs text-white/40">Ask an organizer to enable “Login on Profile”.</p>
          </div>
        ) : (
          <form onSubmit={onContinue} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="block text-xs uppercase tracking-wide text-white/50">
              College
              <select
                value={college}
                onChange={(e) => onCollegeChange(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#111213] px-3 py-3 text-sm text-white outline-none focus:border-[#0ECCEE] [color-scheme:dark]"
              >
                {colleges.map((c) => (
                  <option key={c.college} value={c.college} className="bg-[#111213] text-white">
                    {c.college}
                  </option>
                ))}
              </select>
            </label>

            {events.length > 1 && (
              <label className="block text-xs uppercase tracking-wide text-white/50">
                Event
                <select
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#111213] px-3 py-3 text-sm text-white outline-none focus:border-[#0ECCEE] [color-scheme:dark]"
                >
                  {events.map((ev) => (
                    <option key={ev.id || ev.slug} value={ev.slug} className="bg-[#111213] text-white">
                      {ev.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-xs uppercase tracking-wide text-white/50">
              Team code
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="CC001"
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#111213] px-3 py-3 text-center font-mono text-xl tracking-[0.2em] text-white outline-none focus:border-[#0ECCEE] [color-scheme:dark]"
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
